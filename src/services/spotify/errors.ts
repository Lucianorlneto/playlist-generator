/**
 * Tradução de cada falha de contracts/spotify-api.md para uma mensagem acionável
 * em pt-BR — causa provável e próximo passo (FR-042).
 *
 * O erro carrega a **chave** da mensagem, não o texto: os textos vivem em
 * `src/i18n/pt-BR.ts` (FR-048). Assim a camada de serviço continua sem literais
 * de interface e a mensagem pode ser revisada em um lugar só.
 */

import { t, type ActionableMessage } from '@/i18n/pt-BR';
import { isAbortError } from '@/services/rate-limiter';

export type AppErrorKind =
  | 'auth_invalid_client'
  | 'auth_redirect_uri_mismatch'
  | 'auth_access_denied'
  | 'auth_state_mismatch'
  | 'auth_invalid_grant'
  | 'auth_generic'
  | 'session_expired'
  | 'forbidden'
  | 'not_found'
  | 'rate_limited'
  | 'server_error'
  | 'offline'
  | 'network'
  | 'playlist_list_failed'
  | 'create_playlist_failed'
  | 'add_tracks_failed'
  | 'search_line_failed'
  | 'unexpected';

const MESSAGE_BY_KIND: Record<AppErrorKind, ActionableMessage> = {
  auth_invalid_client: t.errors.authInvalidClient,
  auth_redirect_uri_mismatch: t.errors.authRedirectUriMismatch,
  auth_access_denied: t.errors.authAccessDenied,
  auth_state_mismatch: t.errors.authStateMismatch,
  auth_invalid_grant: t.errors.authInvalidGrant,
  auth_generic: t.errors.authGeneric,
  session_expired: t.errors.sessionExpired,
  forbidden: t.errors.forbidden,
  not_found: t.errors.notFound,
  rate_limited: t.errors.rateLimited,
  server_error: t.errors.serverError,
  offline: t.errors.offline,
  network: t.errors.network,
  playlist_list_failed: t.errors.playlistListFailed,
  create_playlist_failed: t.errors.createPlaylistFailed,
  add_tracks_failed: t.errors.addTracksFailed,
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

export interface AppErrorOptions {
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
  readonly info: ActionableMessage;
  readonly status: number | undefined;
  readonly rawCode: string | undefined;
  readonly retryAfterSeconds: number | undefined;

  constructor(kind: AppErrorKind, options: AppErrorOptions = {}) {
    const info = MESSAGE_BY_KIND[kind];
    super(info.title, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'AppError';
    this.kind = kind;
    this.info = info;
    this.status = options.status;
    this.rawCode = options.rawCode;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }

  get retryable(): boolean {
    return RETRYABLE.has(this.kind);
  }
}

// ---------------------------------------------------------------------------
// Construtores a partir de cada superfície de falha do contrato
// ---------------------------------------------------------------------------

/** Erro devolvido na query string do retorno de `/authorize` (contrato §1). */
export function fromAuthorizeError(rawCode: string): AppError {
  const normalized = rawCode.toLowerCase();

  if (normalized.includes('redirect_uri') || normalized.includes('invalid redirect uri')) {
    return new AppError('auth_redirect_uri_mismatch', { rawCode });
  }
  if (normalized.includes('access_denied')) {
    return new AppError('auth_access_denied', { rawCode });
  }
  if (normalized.includes('invalid_client')) {
    return new AppError('auth_invalid_client', { rawCode });
  }
  return new AppError('auth_generic', { rawCode });
}

/** Erro da troca ou renovação de código em `/api/token` (contrato §2 e §3). */
export function fromTokenError(status: number, body: unknown): AppError {
  const code = extractErrorCode(body);

  if (code === 'invalid_grant')
    return new AppError('auth_invalid_grant', { status, rawCode: code });
  if (code === 'invalid_client') {
    return new AppError('auth_invalid_client', { status, rawCode: code });
  }
  if (code !== null && code.includes('redirect_uri')) {
    return new AppError('auth_redirect_uri_mismatch', { status, rawCode: code });
  }
  if (status >= 500) return new AppError('server_error', { status, rawCode: code ?? undefined });
  return new AppError('auth_generic', { status, rawCode: code ?? undefined });
}

/** Erro de qualquer endpoint de `api.spotify.com` (contrato §4 a §8). */
export function fromHttpStatus(
  status: number,
  options: { retryAfterSeconds?: number; body?: unknown } = {},
): AppError {
  const rawCode = extractErrorCode(options.body) ?? undefined;

  if (status === 401) return new AppError('session_expired', { status, rawCode });
  if (status === 403) return new AppError('forbidden', { status, rawCode });
  if (status === 404) return new AppError('not_found', { status, rawCode });
  if (status === 429) {
    return new AppError('rate_limited', {
      status,
      rawCode,
      retryAfterSeconds: options.retryAfterSeconds,
    });
  }
  if (status >= 500) return new AppError('server_error', { status, rawCode });
  return new AppError('unexpected', { status, rawCode });
}

/** Falha de transporte: `fetch` rejeitado, DNS, offline. */
export function fromNetworkError(cause: unknown): AppError {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  return new AppError(offline ? 'offline' : 'network', { cause });
}

/**
 * Normaliza qualquer coisa lançada em um `AppError`, preservando cancelamentos —
 * cancelar não é erro e não deve virar mensagem de falha.
 */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (isAbortError(error)) throw error;
  if (error instanceof TypeError) return fromNetworkError(error);
  return new AppError('unexpected', { cause: error });
}

export function describe(error: unknown): ActionableMessage {
  if (error instanceof AppError) return error.info;
  return t.errors.unexpected;
}

function extractErrorCode(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const record = body as Record<string, unknown>;

  // Formato do serviço de contas: { error: "invalid_grant", error_description: "…" }
  if (typeof record['error'] === 'string') return record['error'];

  // Formato da Web API: { error: { status: 401, message: "…" } }
  const nested = record['error'];
  if (typeof nested === 'object' && nested !== null) {
    const message = (nested as Record<string, unknown>)['message'];
    if (typeof message === 'string') return message;
  }
  return null;
}
