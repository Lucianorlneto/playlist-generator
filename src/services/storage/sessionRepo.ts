/**
 * Repositório da sessão, uma chave por provedor (`tp.v2.session.{id}`).
 *
 * Invariante que este módulo protege (S2): encerrar a sessão de um serviço apaga
 * **apenas** a chave dele. A credencial, o rascunho e a sessão do outro serviço
 * sobrevivem a desconexão, expiração e falha de renovação (FR-036).
 *
 * `refreshToken` admite `null`: o implicit flow do Google não emite refresh
 * token, e essa ausência é dado válido — não motivo para recusar a sessão
 * (invariante S1, FR-035).
 */

import type { ProviderId } from '@/domain/providers';
import { PROVIDER_ORDER, isProviderId } from '@/domain/providers';
import type { ProviderSession, ProviderUser } from '@/domain/types';

import {
  asFiniteNumber,
  asNonEmptyString,
  asObject,
  asString,
  asStringArray,
  discard,
  readVersioned,
  STORAGE_KEYS,
  writeVersioned,
  type WriteOutcome,
} from './schema';

/** Margem de renovação proativa: a sessão é tratada como expirada 60 s antes. */
export const EXPIRY_MARGIN_MS = 60_000;

function validateUser(raw: unknown): ProviderUser | null {
  const obj = asObject(raw);
  if (obj === null) return null;
  const id = asNonEmptyString(obj['id']);
  if (id === null) return null;
  const displayName = asString(obj['displayName']);
  return { id, displayName: displayName !== null && displayName !== '' ? displayName : id };
}

function validateFor(provider: ProviderId) {
  return (raw: Record<string, unknown>): ProviderSession | null => {
    const accessToken = asNonEmptyString(raw['accessToken']);
    const expiresAt = asFiniteNumber(raw['expiresAt']);
    const scopes = asStringArray(raw['scopes']);
    const user = validateUser(raw['user']);

    // Ausência de refresh token é válida; string vazia não é.
    const rawRefresh = raw['refreshToken'];
    const refreshToken = rawRefresh === null ? null : asNonEmptyString(rawRefresh);
    if (rawRefresh !== null && refreshToken === null) return null;

    // A chave já identifica o provedor; um `provider` divergente no corpo é
    // sinal de conteúdo adulterado ou de chave trocada — recusar é o correto.
    const stored = raw['provider'];
    if (!isProviderId(stored) || stored !== provider) return null;

    if (accessToken === null || expiresAt === null || scopes === null || user === null) {
      return null;
    }

    return { provider, accessToken, refreshToken, expiresAt, scopes, user };
  };
}

export function loadSession(provider: ProviderId): ProviderSession | null {
  return readVersioned('local', STORAGE_KEYS.session(provider), validateFor(provider));
}

export function loadAllSessions(): Record<ProviderId, ProviderSession | null> {
  const result = {} as Record<ProviderId, ProviderSession | null>;
  for (const provider of PROVIDER_ORDER) result[provider] = loadSession(provider);
  return result;
}

export function saveSession(session: ProviderSession): WriteOutcome {
  return writeVersioned('local', STORAGE_KEYS.session(session.provider), {
    provider: session.provider,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresAt: session.expiresAt,
    scopes: session.scopes,
    user: { id: session.user.id, displayName: session.user.displayName },
  });
}

/** Encerra a sessão de **um** serviço. Por construção não alcança nenhuma outra chave. */
export function clearSession(provider: ProviderId): void {
  discard('local', STORAGE_KEYS.session(provider));
}

/** `true` quando falta menos que a margem de renovação proativa. */
export function isExpired(session: ProviderSession, now: number = Date.now()): boolean {
  return session.expiresAt - now < EXPIRY_MARGIN_MS;
}
