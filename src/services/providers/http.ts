/**
 * Cliente HTTP genérico, parametrizado por provedor.
 *
 * Concentra tudo o que os dois contratos exigem e que não deve ser repetido em
 * cada chamada: `Authorization: Bearer`, tratamento do `401`, espera pelo
 * `Retry-After` em `429`, backoff exponencial em `5xx` e propagação do
 * `AbortSignal` — inclusive durante a espera.
 *
 * Duas coisas o distinguem do cliente da 001:
 *
 * 1. **O `401` bifurca por capacidade, não por provedor.** Com
 *    `canRefreshSilently`, renova e repete uma vez. Sem ele — o caso do YouTube,
 *    cujo implicit flow não emite refresh token — o erro vira `reauth_required`
 *    imediatamente: insistir só produziria um segundo `401` e esconderia que o
 *    usuário precisa autorizar de novo (FR-035).
 * 2. **A classificação do corpo de erro é injetada.** O `403` do YouTube
 *    significa coisas opostas conforme o `error.errors[0].reason` — cota
 *    esgotada encerra sem repetir, limitação de taxa repete com backoff — e essa
 *    distinção só existe no corpo, então pertence ao adaptador (research §6).
 *
 * A função de renovação é injetada em vez de importada: o módulo de autorização
 * precisa do cliente para as chamadas autenticadas, e importar de volta criaria
 * um ciclo.
 */

import type { ProviderId, QuotaOperation } from '@/domain/providers';
import { capabilitiesOf } from '@/domain/providers';
import type { ProviderSession } from '@/domain/types';
import { waitAnnounced, type WaitReason } from '@/services/rate-limiter';
import { isExpired } from '@/services/storage/sessionRepo';

import { AppError, fromHttpStatus, fromNetworkError, toAppError } from './errors';
import { apiUrlFor, type UrlParams } from './hosts';

/** Tentativas totais para falhas transitórias (`5xx` e rede). */
export const MAX_TRANSIENT_ATTEMPTS = 3;
/** Tentativas totais para limitação de taxa (`429` e `403 rateLimitExceeded`). */
export const MAX_RATE_LIMIT_ATTEMPTS = 4;
/** Teto do backoff exponencial quando a resposta não traz `Retry-After`. */
export const MAX_BACKOFF_MS = 30_000;

export interface ProviderHttpDeps {
  getSession: () => ProviderSession | null;
  saveSession: (session: ProviderSession) => void;
  clearSession: () => void;
  /** Obrigatória quando `capabilities.canRefreshSilently`; ignorada sem ela. */
  refresh?: (session: ProviderSession) => Promise<ProviderSession>;
  /** Registra consumo de cota após cada resposta do provedor (research §5). */
  recordConsumption?: (operation: QuotaOperation) => void;
  /**
   * Traduz status + corpo em `AppError`. Devolver `null` deixa a classificação
   * genérica por status valer.
   */
  classifyError?: (status: number, body: unknown) => AppError | null;
}

interface ClientState {
  deps: ProviderHttpDeps;
  refreshInFlight: Promise<ProviderSession> | null;
}

const clients = new Map<ProviderId, ClientState>();

export function configureProviderClient(provider: ProviderId, deps: ProviderHttpDeps): void {
  clients.set(provider, { deps, refreshInFlight: null });
}

/** Apenas para testes: derruba a configuração e as renovações em voo. */
export function resetProviderClients(provider?: ProviderId): void {
  if (provider === undefined) clients.clear();
  else clients.delete(provider);
}

export function isProviderClientConfigured(provider: ProviderId): boolean {
  return clients.has(provider);
}

function requireClient(provider: ProviderId): ClientState {
  const client = clients.get(provider);
  if (client === undefined) {
    throw new AppError('unexpected', {
      provider,
      cause: new Error(`Cliente do provedor ${provider} não configurado`),
    });
  }
  return client;
}

/**
 * Renovação coalescida: quatro buscas paralelas que recebem `401` ao mesmo tempo
 * disparam **uma** renovação, não quatro.
 *
 * Sem `canRefreshSilently`, uma sessão expirada não é erro de renovação e sim o
 * estado previsto de `reauth_required` — o rascunho é preservado e a interface
 * pede autorização de novo.
 */
export async function ensureFreshSession(
  provider: ProviderId,
  force = false,
): Promise<ProviderSession> {
  const client = requireClient(provider);
  const { getSession, saveSession, clearSession, refresh } = client.deps;

  const current = getSession();
  if (current === null) throw new AppError('reauth_required', { provider });

  const canRefresh = capabilitiesOf(provider).canRefreshSilently && refresh !== undefined;

  if (!force && !isExpired(current)) return current;
  if (!canRefresh) throw new AppError('reauth_required', { provider });

  if (client.refreshInFlight === null) {
    client.refreshInFlight = (refresh as (s: ProviderSession) => Promise<ProviderSession>)(current)
      .then((renewed) => {
        saveSession(renewed);
        return renewed;
      })
      .catch((error: unknown) => {
        // Falha de renovação encerra a sessão daquele serviço — mas jamais toca
        // no rascunho nem na sessão do outro (FR-036, invariante S2).
        clearSession();
        throw error instanceof AppError
          ? error.withProvider(provider)
          : new AppError('session_expired', { provider, cause: error });
      })
      .finally(() => {
        client.refreshInFlight = null;
      });
  }

  return client.refreshInFlight;
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  params?: UrlParams;
  /** Operação de cota a contabilizar após a resposta (research §5). */
  operation?: QuotaOperation;
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
export async function apiRequest<T>(
  provider: ProviderId,
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, signal, params, operation, onExhausted } = options;
  const { deps } = requireClient(provider);

  let transientAttempts = 0;
  let rateLimitAttempts = 0;
  let refreshed = false;

  for (;;) {
    const session = await ensureFreshSession(provider);

    let response: Response;
    try {
      response = await fetch(apiUrlFor(provider, path, params), {
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
      const appError = fromNetworkError(error, provider);
      // Requisição que não chegou ao provedor não consome cota (research §5).
      if (transientAttempts >= MAX_TRANSIENT_ATTEMPTS) {
        throw onExhausted === undefined ? appError : onExhausted(appError);
      }
      await waitBefore(backoffMs(transientAttempts), 'retry_after', signal);
      continue;
    }

    // A resposta chegou: o provedor contabilizou a operação, então nós também.
    //
    // **Menos no `401`** (`004/Q1`, provider-contract §4). A premissa acima é
    // verdadeira para `403` e `5xx` — a requisição foi processada e cobrada — e
    // falsa para credencial inválida: o provedor a rejeita antes de executá-la e
    // não a debita. Registrar aqui gravava 100 unidades por linha em uma lista
    // inteira que nunca chegou a ser buscada, e o usuário reconectava para ser
    // barrado por um esgotamento que não provocou.
    if (operation !== undefined && response.status !== 401) {
      deps.recordConsumption?.(operation);
    }

    if (response.ok) {
      if (response.status === 204) return undefined as T;
      return (await readBody(response)) as T;
    }

    const payload = await readBody(response);

    // Classificação específica do provedor primeiro: é ela que distingue os
    // `403` de significado oposto do YouTube.
    const classified = deps.classifyError?.(response.status, payload) ?? null;

    if (classified !== null && classified.terminal) {
      // `quota_exhausted` **nunca** entra no caminho de repetição (SC-009).
      throw classified;
    }

    if (response.status === 401 && !refreshed) {
      if (!capabilitiesOf(provider).canRefreshSilently) {
        throw classified ?? new AppError('reauth_required', { provider, status: 401 });
      }
      refreshed = true;
      await ensureFreshSession(provider, true);
      continue;
    }

    const rateLimited =
      response.status === 429 || (classified !== null && classified.kind === 'rate_limited');

    if (rateLimited) {
      rateLimitAttempts += 1;
      const retryAfterSeconds = parseRetryAfter(response);
      const appError =
        classified ??
        fromHttpStatus(429, {
          provider,
          body: payload,
          ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
        });
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
      const appError = classified ?? fromHttpStatus(response.status, { provider, body: payload });
      if (transientAttempts >= MAX_TRANSIENT_ATTEMPTS) {
        throw onExhausted === undefined ? appError : onExhausted(appError);
      }
      await waitBefore(backoffMs(transientAttempts), 'retry_after', signal);
      continue;
    }

    const appError = classified ?? fromHttpStatus(response.status, { provider, body: payload });
    throw onExhausted === undefined ? appError : onExhausted(appError);
  }
}

/** Wrapper que normaliza qualquer coisa lançada, preservando cancelamentos. */
export async function apiRequestSafe<T>(
  provider: ProviderId,
  path: string,
  options?: ApiRequestOptions,
): Promise<T> {
  try {
    return await apiRequest<T>(provider, path, options);
  } catch (error) {
    throw toAppError(error, provider);
  }
}
