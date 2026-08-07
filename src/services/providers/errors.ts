/**
 * Tradução de cada falha dos dois provedores para uma mensagem acionável em
 * pt-BR — causa provável e próximo passo (FR-046).
 *
 * Duas mudanças em relação à 001:
 *
 * 1. **Toda `AppError` carrega o provedor** (invariante E1). Com dois destinos,
 *    "a sessão expirou" sem dizer qual serviço é uma mensagem inútil. O nome do
 *    serviço é interpolado nos textos por `{service}`.
 * 2. **`reauth_required` e `quota_exhausted` entram no catálogo.** Não são
 *    variações de `session_expired` e `rate_limited`: a primeira é o estado
 *    previsto de um provedor sem renovação silenciosa (FR-035) e a segunda
 *    **nunca** pode entrar no caminho de repetição (FR-031, SC-009).
 *
 * O erro carrega a **chave** da mensagem, não o texto: os textos vivem em
 * `src/i18n/pt-BR.ts`.
 */

import type { ProviderId } from '@/domain/providers';
import type { AppErrorInfo } from '@/domain/types';
import { format, t, type ActionableMessage } from '@/i18n/pt-BR';
import { isAbortError } from '@/services/rate-limiter';

export type AppErrorKind =
  | 'auth_invalid_client'
  | 'auth_redirect_uri_mismatch'
  | 'auth_access_denied'
  | 'auth_state_mismatch'
  | 'auth_invalid_grant'
  | 'auth_not_verified'
  | 'auth_generic'
  | 'session_expired'
  | 'reauth_required'
  | 'quota_exhausted'
  | 'forbidden'
  | 'not_found'
  | 'rate_limited'
  | 'server_error'
  | 'offline'
  | 'network'
  | 'playlist_list_failed'
  | 'create_playlist_failed'
  | 'add_items_failed'
  | 'search_line_failed'
  | 'unexpected';

const MESSAGE_BY_KIND: Record<AppErrorKind, ActionableMessage> = {
  auth_invalid_client: t.errors.authInvalidClient,
  auth_redirect_uri_mismatch: t.errors.authRedirectUriMismatch,
  auth_access_denied: t.errors.authAccessDenied,
  auth_state_mismatch: t.errors.authStateMismatch,
  auth_invalid_grant: t.errors.authInvalidGrant,
  auth_not_verified: t.errors.authNotVerified,
  auth_generic: t.errors.authGeneric,
  session_expired: t.errors.sessionExpired,
  reauth_required: t.errors.reauthRequired,
  quota_exhausted: t.errors.quotaExhausted,
  forbidden: t.errors.forbidden,
  not_found: t.errors.notFound,
  rate_limited: t.errors.rateLimited,
  server_error: t.errors.serverError,
  offline: t.errors.offline,
  network: t.errors.network,
  playlist_list_failed: t.errors.playlistListFailed,
  create_playlist_failed: t.errors.createPlaylistFailed,
  add_items_failed: t.errors.addItemsFailed,
  search_line_failed: t.errors.searchLineFailed,
  unexpected: t.errors.unexpected,
};

/** Falhas que fazem sentido repetir sem intervenção do usuário. */
const RETRYABLE: ReadonlySet<AppErrorKind> = new Set<AppErrorKind>([
  'rate_limited',
  'server_error',
  'offline',
  'network',
]);

/**
 * Falhas que **encerram** a execução daquele serviço sem repetir. `quota_exhausted`
 * está aqui por exigência de SC-009: repetir contra uma cota esgotada é o laço
 * que o critério proíbe.
 */
const TERMINAL: ReadonlySet<AppErrorKind> = new Set<AppErrorKind>([
  'quota_exhausted',
  'reauth_required',
]);

/**
 * Falhas em que a **execução inteira** perdeu autorização, não uma linha
 * (`004/E1` a `E3`).
 */
const SESSION_LEVEL: ReadonlySet<AppErrorKind> = new Set<AppErrorKind>([
  'reauth_required',
  'session_expired',
]);

/**
 * A regra que separa "esta linha falhou" de "a execução perdeu a sessão"
 * (`004/provider-contract §2`).
 *
 * > Falha de linha vira item. Falha de sessão derruba a execução.
 *
 * Sem essa distinção, `searchOne` engolia o `401` como se fosse um resultado
 * ruim e escrevia "Não encontrada" em cem fileiras — a mensagem certa existia,
 * enterrada no detalhe de cada linha, enquanto o cabeçalho seguia mostrando a
 * conta como conectada.
 *
 * A lista é **fechada e afirmativa**: um `kind` novo devolve `false` e continua
 * sendo falha de linha, que é o comportamento de hoje e o menos destrutivo.
 * `quota_exhausted` fica fora por decisão estrutural (E2) — reconectar não
 * devolve orçamento, e a precedência de cota já encerra por outro caminho.
 *
 * Genérica, sem `ProviderId` (E3): a distinção não é do catálogo de vídeo.
 */
export function isSessionLevel(error: AppError): boolean {
  return SESSION_LEVEL.has(error.kind);
}

export const PROVIDER_LABEL: Record<ProviderId, string> = {
  spotify: t.providers.spotify.name,
  youtube: t.providers.youtube.name,
};

/** Resolve `{service}` nos três campos da mensagem. */
function resolve(message: ActionableMessage, provider: ProviderId | null): ActionableMessage {
  const service = provider === null ? t.providers.generic : PROVIDER_LABEL[provider];
  return {
    title: format(message.title, { service }),
    cause: format(message.cause, { service }),
    nextStep: format(message.nextStep, { service }),
  };
}

export interface AppErrorOptions {
  /** Serviço a que a falha pertence. `null` só antes de haver provedor. */
  provider?: ProviderId | null;
  /** Status HTTP, quando houve resposta. */
  status?: number;
  /** Código bruto devolvido pela plataforma, preservado para diagnóstico. */
  rawCode?: string;
  /** Segundos pedidos no header `Retry-After`. */
  retryAfterSeconds?: number;
  cause?: unknown;
}

export class AppError extends Error {
  readonly kind: AppErrorKind;
  readonly provider: ProviderId | null;
  readonly info: ActionableMessage;
  readonly status: number | undefined;
  readonly rawCode: string | undefined;
  readonly retryAfterSeconds: number | undefined;

  constructor(kind: AppErrorKind, options: AppErrorOptions = {}) {
    const provider = options.provider ?? null;
    const info = resolve(MESSAGE_BY_KIND[kind], provider);
    super(info.title, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'AppError';
    this.kind = kind;
    this.provider = provider;
    this.info = info;
    this.status = options.status;
    this.rawCode = options.rawCode;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }

  get retryable(): boolean {
    return RETRYABLE.has(this.kind);
  }

  /** `true` quando repetir é proibido, não apenas inútil (SC-009, FR-031). */
  get terminal(): boolean {
    return TERMINAL.has(this.kind);
  }

  /** Mesma falha, agora atribuída a um serviço. */
  withProvider(provider: ProviderId): AppError {
    if (this.provider === provider) return this;
    return new AppError(this.kind, {
      provider,
      ...(this.status === undefined ? {} : { status: this.status }),
      ...(this.rawCode === undefined ? {} : { rawCode: this.rawCode }),
      ...(this.retryAfterSeconds === undefined ? {} : { retryAfterSeconds: this.retryAfterSeconds }),
      cause: this.cause,
    });
  }
}

// ---------------------------------------------------------------------------
// Construtores a partir de cada superfície de falha
// ---------------------------------------------------------------------------

/** Erro devolvido na query ou no fragmento do retorno de autorização. */
export function fromAuthorizeError(rawCode: string, provider: ProviderId): AppError {
  const normalized = rawCode.toLowerCase();

  if (normalized.includes('redirect_uri') || normalized.includes('invalid redirect uri')) {
    return new AppError('auth_redirect_uri_mismatch', { provider, rawCode });
  }
  if (normalized.includes('access_denied')) {
    return new AppError('auth_access_denied', { provider, rawCode });
  }
  if (normalized.includes('invalid_client')) {
    return new AppError('auth_invalid_client', { provider, rawCode });
  }
  if (normalized.includes('admin_policy_enforced') || normalized.includes('org_internal')) {
    return new AppError('auth_not_verified', { provider, rawCode });
  }
  return new AppError('auth_generic', { provider, rawCode });
}

/** Erro da troca ou renovação de código no endpoint de token. */
export function fromTokenError(status: number, body: unknown, provider: ProviderId): AppError {
  const code = extractErrorCode(body);

  if (code === 'invalid_grant') {
    return new AppError('auth_invalid_grant', { provider, status, rawCode: code });
  }
  if (code === 'invalid_client') {
    return new AppError('auth_invalid_client', { provider, status, rawCode: code });
  }
  if (code !== null && code.includes('redirect_uri')) {
    return new AppError('auth_redirect_uri_mismatch', { provider, status, rawCode: code });
  }
  if (status >= 500) {
    return new AppError('server_error', { provider, status, rawCode: code ?? undefined });
  }
  return new AppError('auth_generic', { provider, status, rawCode: code ?? undefined });
}

/**
 * Erro de um endpoint de API. O tratamento por status é comum aos provedores; a
 * desambiguação do `403` do YouTube pelo `reason` fica no adaptador dele, porque
 * só existe no corpo da resposta (research §6).
 */
export function fromHttpStatus(
  status: number,
  options: { retryAfterSeconds?: number; body?: unknown; provider?: ProviderId } = {},
): AppError {
  const rawCode = extractErrorCode(options.body) ?? undefined;
  const provider = options.provider ?? null;

  if (status === 401) return new AppError('session_expired', { provider, status, rawCode });
  if (status === 403) return new AppError('forbidden', { provider, status, rawCode });
  if (status === 404) return new AppError('not_found', { provider, status, rawCode });
  if (status === 429) {
    return new AppError('rate_limited', {
      provider,
      status,
      rawCode,
      ...(options.retryAfterSeconds === undefined
        ? {}
        : { retryAfterSeconds: options.retryAfterSeconds }),
    });
  }
  if (status >= 500) return new AppError('server_error', { provider, status, rawCode });
  return new AppError('unexpected', { provider, status, rawCode });
}

/** Falha de transporte: `fetch` rejeitado, DNS, offline. */
export function fromNetworkError(cause: unknown, provider?: ProviderId): AppError {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  return new AppError(offline ? 'offline' : 'network', {
    ...(provider === undefined ? {} : { provider }),
    cause,
  });
}

/**
 * Normaliza qualquer coisa lançada em um `AppError`, preservando cancelamentos —
 * cancelar não é erro e não deve virar mensagem de falha.
 */
export function toAppError(error: unknown, provider?: ProviderId): AppError {
  if (error instanceof AppError) {
    return provider === undefined ? error : error.withProvider(provider);
  }
  if (isAbortError(error)) throw error;
  if (error instanceof TypeError) return fromNetworkError(error, provider);
  return new AppError('unexpected', { ...(provider === undefined ? {} : { provider }), cause: error });
}

export function describe(error: unknown): ActionableMessage {
  if (error instanceof AppError) return error.info;
  return t.errors.unexpected;
}

/** Forma serializável que entra em `ServiceRun.error` e no rascunho. */
export function toErrorInfo(error: AppError, fallbackProvider: ProviderId): AppErrorInfo {
  const provider = error.provider ?? fallbackProvider;
  const info = error.provider === null ? resolve(MESSAGE_BY_KIND[error.kind], provider) : error.info;
  return {
    provider,
    kind: error.kind,
    title: info.title,
    cause: info.cause,
    nextStep: info.nextStep,
  };
}

function extractErrorCode(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const record = body as Record<string, unknown>;

  // Serviço de contas do Spotify: { error: "invalid_grant", … }
  if (typeof record['error'] === 'string') return record['error'];

  const nested = record['error'];
  if (typeof nested === 'object' && nested !== null) {
    const obj = nested as Record<string, unknown>;

    // YouTube: { error: { errors: [{ reason: "quotaExceeded" }], … } }
    const errors = obj['errors'];
    if (Array.isArray(errors) && errors.length > 0) {
      const reason = (errors[0] as Record<string, unknown> | undefined)?.['reason'];
      if (typeof reason === 'string') return reason;
    }

    // Web API do Spotify: { error: { status: 401, message: "…" } }
    if (typeof obj['message'] === 'string') return obj['message'];
  }
  return null;
}
