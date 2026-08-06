/**
 * Limitador de vazão próprio (research §4).
 *
 * Três camadas: token bucket de 5 req/s com rajada 10, pool de concorrência 4 e
 * esperas canceláveis. O ponto não negociável é o cancelamento: o `AbortSignal`
 * interrompe **inclusive durante a espera** — de token, de fila ou de
 * `Retry-After`. É disso que dependem `001/FR-026` e SC-011.
 */

import type { ProviderId } from '@/domain/providers';

export const DEFAULT_RATE_PER_SECOND = 5;
export const DEFAULT_BURST = 10;
export const DEFAULT_CONCURRENCY = 4;

export class AbortError extends Error {
  constructor(message = 'Operação cancelada') {
    super(message);
    this.name = 'AbortError';
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

// ---------------------------------------------------------------------------
// Estado de espera observável — alimenta a interface de "aguardando limite"
// ---------------------------------------------------------------------------

export type WaitReason = 'rate_limit' | 'retry_after';

export interface WaitState {
  reason: WaitReason;
  /** Epoch ms em que a espera deve terminar. */
  resumesAt: number;
}

type WaitListener = (state: WaitState | null) => void;

const waitListeners = new Set<WaitListener>();
let activeWaits = 0;
let currentWait: WaitState | null = null;

export function onWaitStateChange(listener: WaitListener): () => void {
  waitListeners.add(listener);
  listener(currentWait);
  return () => {
    waitListeners.delete(listener);
  };
}

function publishWait(state: WaitState | null): void {
  currentWait = state;
  for (const listener of waitListeners) {
    try {
      listener(state);
    } catch {
      // Um assinante quebrado não pode travar a operação em andamento.
    }
  }
}

/** Apenas para testes: zera o estado global de espera entre casos. */
export function resetWaitState(): void {
  activeWaits = 0;
  publishWait(null);
}

// ---------------------------------------------------------------------------
// Espera cancelável
// ---------------------------------------------------------------------------

/**
 * `setTimeout` que respeita `AbortSignal`. Sem isto, cancelar durante um backoff
 * de 30 s deixaria a interface presa até o timer disparar.
 */
export function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted === true) {
      reject(new AbortError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort(): void {
      clearTimeout(timer);
      reject(new AbortError());
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Espera anunciada: publica o estado para a interface e o retira ao terminar,
 * inclusive quando a espera é interrompida por cancelamento.
 */
export async function waitAnnounced(
  ms: number,
  reason: WaitReason,
  signal?: AbortSignal,
): Promise<void> {
  if (ms <= 0) return;

  activeWaits += 1;
  publishWait({ reason, resumesAt: Date.now() + ms });
  try {
    await abortableDelay(ms, signal);
  } finally {
    activeWaits -= 1;
    if (activeWaits <= 0) {
      activeWaits = 0;
      publishWait(null);
    }
  }
}

// ---------------------------------------------------------------------------
// Limitador
// ---------------------------------------------------------------------------

export interface LimiterOptions {
  ratePerSecond?: number;
  burst?: number;
  concurrency?: number;
}

export interface Limiter {
  /** Executa `fn` respeitando vazão e concorrência. Rejeita com `AbortError` se cancelado. */
  run<T>(fn: () => Promise<T>, signal?: AbortSignal): Promise<T>;
  /** Requisições em voo, para diagnóstico e teste. */
  readonly inFlight: number;
  /** Ajuste de calibração (T099) sem recriar o limitador. */
  configure(options: LimiterOptions): void;
}

interface QueueEntry {
  resolve: () => void;
  reject: (error: unknown) => void;
  signal?: AbortSignal;
  onAbort?: () => void;
}

export function createLimiter(options: LimiterOptions = {}): Limiter {
  let ratePerSecond = options.ratePerSecond ?? DEFAULT_RATE_PER_SECOND;
  let burst = options.burst ?? DEFAULT_BURST;
  let concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;

  let tokens = burst;
  let lastRefill = Date.now();
  let running = 0;
  const queue: QueueEntry[] = [];

  function refill(): void {
    const now = Date.now();
    const elapsedSeconds = Math.max(0, now - lastRefill) / 1000;
    if (elapsedSeconds > 0) {
      tokens = Math.min(burst, tokens + elapsedSeconds * ratePerSecond);
      lastRefill = now;
    }
  }

  function acquireSlot(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted === true) return Promise.reject(new AbortError());
    if (running < concurrency) {
      running += 1;
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      const entry: QueueEntry = { resolve, reject, signal };
      // Cancelar enquanto se está na fila tem de tirar a entrada da fila, senão
      // a vaga liberada seria entregue a uma operação que ninguém espera mais.
      if (signal !== undefined) {
        entry.onAbort = () => {
          const index = queue.indexOf(entry);
          if (index >= 0) queue.splice(index, 1);
          reject(new AbortError());
        };
        signal.addEventListener('abort', entry.onAbort, { once: true });
      }
      queue.push(entry);
    });
  }

  function releaseSlot(): void {
    const next = queue.shift();
    if (next === undefined) {
      running -= 1;
      return;
    }
    if (next.signal !== undefined && next.onAbort !== undefined) {
      next.signal.removeEventListener('abort', next.onAbort);
    }
    // `running` permanece: a vaga passa direto para o próximo da fila.
    next.resolve();
  }

  async function takeToken(signal?: AbortSignal): Promise<void> {
    for (;;) {
      if (signal?.aborted === true) throw new AbortError();
      refill();
      if (tokens >= 1) {
        tokens -= 1;
        return;
      }
      const deficit = 1 - tokens;
      const waitMs = Math.max(1, Math.ceil((deficit / ratePerSecond) * 1000));
      await waitAnnounced(waitMs, 'rate_limit', signal);
    }
  }

  return {
    get inFlight() {
      return running;
    },

    configure(next: LimiterOptions) {
      if (next.ratePerSecond !== undefined) ratePerSecond = next.ratePerSecond;
      if (next.burst !== undefined) {
        burst = next.burst;
        tokens = Math.min(tokens, burst);
      }
      if (next.concurrency !== undefined) concurrency = next.concurrency;
    },

    async run<T>(fn: () => Promise<T>, signal?: AbortSignal): Promise<T> {
      await acquireSlot(signal);
      try {
        await takeToken(signal);
        return await fn();
      } finally {
        releaseSlot();
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Uma instância por provedor
// ---------------------------------------------------------------------------

/**
 * Cada serviço tem seu próprio orçamento de vazão (research §16). Um limitador
 * global compartilhado faria a busca no segundo destino herdar os tokens gastos
 * pelo primeiro, atrasando-a sem que nenhum provedor tivesse pedido pausa.
 *
 * Spotify: 5 req/s · YouTube: 4 req/s — mais conservador porque `403
 * rateLimitExceeded` custa um backoff mais caro do que o ganho de velocidade.
 */
const LIMITER_OPTIONS: Record<ProviderId, LimiterOptions> = {
  spotify: { ratePerSecond: 5, burst: 10, concurrency: 4 },
  youtube: { ratePerSecond: 4, burst: 8, concurrency: 4 },
};

const limiters = new Map<ProviderId, Limiter>();

export function limiterFor(provider: ProviderId): Limiter {
  const existing = limiters.get(provider);
  if (existing !== undefined) return existing;
  const created = createLimiter(LIMITER_OPTIONS[provider]);
  limiters.set(provider, created);
  return created;
}

/** Apenas para testes: descarta os limitadores acumulados entre casos. */
export function resetLimiters(): void {
  limiters.clear();
}
