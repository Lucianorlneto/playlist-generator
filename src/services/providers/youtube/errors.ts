/**
 * Desambiguação obrigatória do `403` do YouTube (contracts/youtube-api.md §8,
 * research §6).
 *
 * Cota esgotada e limitação de taxa chegam com o **mesmo status HTTP** e exigem
 * comportamentos opostos: a primeira encerra a execução sem repetir (FR-031,
 * SC-009) e a segunda repete com backoff. A distinção só existe em
 * `error.errors[0].reason`, no corpo — por isso vive aqui, no adaptador, e não
 * no cliente HTTP genérico.
 *
 * Tratar todo `403` como terminal abortaria execuções recuperáveis por uma
 * rajada; tratar todo `403` como transitório produziria o laço de repetição
 * contra uma cota esgotada que SC-009 proíbe.
 */

import { AppError } from '@/services/providers/errors';

const PROVIDER = 'youtube' as const;

/** Encerram o serviço sem repetir. */
const QUOTA_REASONS = new Set(['quotaExceeded', 'dailyLimitExceeded']);
/** Repetem com backoff, no mesmo caminho do `429` do Spotify. */
const RATE_REASONS = new Set(['rateLimitExceeded', 'userRateLimitExceeded']);
/** Erro de escopo ou consentimento — mensagem acionável, sem repetição. */
const PERMISSION_REASONS = new Set(['forbidden', 'insufficientPermissions', 'authError']);
/** Falha **da linha**, não da execução. */
const ITEM_REASONS = new Set([
  'playlistItemsNotAccessible',
  'videoNotFound',
  'playlistNotFound',
  'playlistOperationUnsupported',
]);

export function reasonOf(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const error = (body as Record<string, unknown>)['error'];
  if (typeof error !== 'object' || error === null) return null;
  const errors = (error as Record<string, unknown>)['errors'];
  if (!Array.isArray(errors) || errors.length === 0) return null;
  const reason = (errors[0] as Record<string, unknown> | undefined)?.['reason'];
  return typeof reason === 'string' ? reason : null;
}

/**
 * Traduz status + corpo em `AppError`. Devolver `null` deixa a classificação
 * genérica por status valer — é o caso dos `5xx`, idênticos nos dois provedores.
 */
export function classifyYouTubeError(status: number, body: unknown): AppError | null {
  const reason = reasonOf(body);
  const rawCode = reason ?? undefined;

  if (status === 401) {
    // Sem renovação silenciosa, um 401 é sempre pedido de reautorização (FR-035).
    return new AppError('reauth_required', { provider: PROVIDER, status, rawCode });
  }

  if (status === 403) {
    if (reason !== null && QUOTA_REASONS.has(reason)) {
      return new AppError('quota_exhausted', { provider: PROVIDER, status, rawCode });
    }
    if (reason !== null && RATE_REASONS.has(reason)) {
      return new AppError('rate_limited', { provider: PROVIDER, status, rawCode });
    }
    if (reason !== null && PERMISSION_REASONS.has(reason)) {
      return new AppError('forbidden', { provider: PROVIDER, status, rawCode });
    }
    // `403` sem `reason` reconhecido: permissão é a leitura mais provável e a
    // mais acionável. Não é repetível de qualquer modo.
    return new AppError('forbidden', { provider: PROVIDER, status, rawCode });
  }

  if (status === 404 || (reason !== null && ITEM_REASONS.has(reason))) {
    return new AppError('not_found', { provider: PROVIDER, status, rawCode });
  }

  return null;
}

/** `true` quando a falha é da linha e não deve derrubar a execução inteira. */
export function isItemLevel(error: AppError): boolean {
  return error.kind === 'not_found';
}
