/**
 * Cliente HTTP da Spotify Web API.
 *
 * Concentra tudo o que o contrato exige e que não deve ser repetido em cada
 * chamada: `Authorization: Bearer`, renovação em `401` (uma tentativa, com as
 * renovações concorrentes coalescidas em uma única promessa), espera pelo
 * `Retry-After` em `429`, backoff exponencial em `5xx` e propagação do
 * `AbortSignal`.
 *
 * A função de renovação é **injetada** por `auth.ts` em vez de importada. Não é
 * indireção gratuita: `auth.ts` precisa do cliente para as chamadas autenticadas,
 * e importar de volta criaria um ciclo.
 */

import type { Session } from '@/domain/types';
import { isExpired } from '@/services/storage/sessionRepo';
import { waitAnnounced, type WaitReason } from '@/services/rate-limiter';

import { AppError, fromHttpStatus, fromNetworkError, toAppError } from './errors';
import { apiUrl } from './hosts';

/** Tentativas totais para falhas transitórias (`5xx` e rede) — research §4. */
export const MAX_TRANSIENT_ATTEMPTS = 3;
/** Tentativas totais para `429`. */
export const MAX_RATE_LIMIT_ATTEMPTS = 4;
/** Teto do backoff exponencial quando o `429` não traz `Retry-After`. */
export const MAX_BACKOFF_MS = 30_000;

export interface SpotifyClientDeps {
  getSession: () => Session | null;
  saveSession: (session: Session) => void;
  clearSession: () => void;
  /** Injetada por `auth.ts`; devolve a sessão renovada. */
  refresh: (session: Session) => Promise<Session>;
}

let deps: SpotifyClientDeps | null = null;
let refreshInFlight: Promise<Session> | null = null;

export function configureSpotifyClient(next: SpotifyClientDeps): void {
  deps = next;
  refreshInFlight = null;
}

/** Apenas para testes: derruba a configuração e a renovação em voo. */
export function resetSpotifyClient(): void {
  deps = null;
  refreshInFlight = null;
}

function requireDeps(): SpotifyClientDeps {
  if (deps === null) {
    throw new AppError('unexpected', { cause: new Error('Cliente Spotify não configurado') });
  }
  return deps;
}

/**
 * Renovação coalescida: 4 buscas paralelas que recebem `401` ao mesmo tempo
 * disparam **uma** renovação, não quatro (research §9).
 */
export async function ensureFreshSession(force = false): Promise<Session> {
  const { getSession, saveSession, clearSession, refresh } = requireDeps();

  const current = getSession();
  if (current === null) throw new AppError('session_expired');

  if (!force && !isExpired(current)) return current;

  if (refreshInFlight === null) {
    refreshInFlight = refresh(current)
      .then((renewed) => {
        saveSession(renewed);
        return renewed;
      })
      .catch((error: unknown) => {
        // Falha de renovação encerra a sessão — mas jamais toca no rascunho
        // (FR-044, SC-006): `clearSession` só conhece a chave da sessão.
        clearSession();
        throw error instanceof AppError ? error : new AppError('session_expired', { cause: error });
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }

  return refreshInFlight;
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  params?: Record<string, string | number | undefined>;
  /** Erro específico a lançar quando as tentativas se esgotam. */
  onExhausted?: (error: AppError) => AppError;
}

function parseRetryAfter(response: Response): number | undefined {
  const header = response.headers.get('Retry-After');
  if (header === null) return undefined;
  const seconds = Number.parseInt(header, 10);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text().catch(() => '');
  if (text === '') return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function backoffMs(attempt: number): number {
  return Math.min(MAX_BACKOFF_MS, 2 ** attempt * 1000);
}

async function waitBefore(ms: number, reason: WaitReason, signal?: AbortSignal): Promise<void> {
  await waitAnnounced(ms, reason, signal);
}

/**
 * Executa uma requisição autenticada, aplicando todas as políticas de repetição
 * do contrato. Devolve o corpo já desserializado.
 */
export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal, params, onExhausted } = options;

  let transientAttempts = 0;
  let rateLimitAttempts = 0;
  let refreshed = false;

  for (;;) {
    const session = await ensureFreshSession();

    let response: Response;
    try {
      response = await fetch(apiUrl(path, params), {
        method,
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        ...(signal === undefined ? {} : { signal }),
      });
    } catch (error) {
      if (signal?.aborted === true) throw error;
      transientAttempts += 1;
      const appError = fromNetworkError(error);
      if (transientAttempts >= MAX_TRANSIENT_ATTEMPTS) {
        throw onExhausted === undefined ? appError : onExhausted(appError);
      }
      await waitBefore(backoffMs(transientAttempts), 'retry_after', signal);
      continue;
    }

    if (response.ok) {
      if (response.status === 204) return undefined as T;
      return (await readBody(response)) as T;
    }

    // 401: uma renovação e uma repetição. Um segundo 401 significa que o
    // problema não é a validade do token — insistir só esconderia a causa.
    if (response.status === 401 && !refreshed) {
      refreshed = true;
      await ensureFreshSession(true);
      continue;
    }

    if (response.status === 429) {
      rateLimitAttempts += 1;
      const retryAfterSeconds = parseRetryAfter(response);
      const appError = fromHttpStatus(429, { retryAfterSeconds, body: await readBody(response) });
      if (rateLimitAttempts >= MAX_RATE_LIMIT_ATTEMPTS) {
        throw onExhausted === undefined ? appError : onExhausted(appError);
      }
      const waitMs =
        retryAfterSeconds === undefined ? backoffMs(rateLimitAttempts) : retryAfterSeconds * 1000;
      await waitBefore(waitMs, 'retry_after', signal);
      continue;
    }

    if (response.status >= 500) {
      transientAttempts += 1;
      const appError = fromHttpStatus(response.status, { body: await readBody(response) });
      if (transientAttempts >= MAX_TRANSIENT_ATTEMPTS) {
        throw onExhausted === undefined ? appError : onExhausted(appError);
      }
      await waitBefore(backoffMs(transientAttempts), 'retry_after', signal);
      continue;
    }

    const appError = fromHttpStatus(response.status, { body: await readBody(response) });
    throw onExhausted === undefined ? appError : onExhausted(appError);
  }
}

/** Wrapper que normaliza qualquer coisa lançada, preservando cancelamentos. */
export async function apiRequestSafe<T>(path: string, options?: ApiRequestOptions): Promise<T> {
  try {
    return await apiRequest<T>(path, options);
  } catch (error) {
    throw toAppError(error);
  }
}
