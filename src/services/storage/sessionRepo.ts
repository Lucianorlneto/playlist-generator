/**
 * Repositório da sessão (`tp.v1.session`).
 *
 * Invariante que este módulo protege: encerrar a sessão apaga **apenas** esta
 * chave. A credencial e o rascunho sobrevivem a desconexão, expiração e falha de
 * renovação (FR-044, SC-006) — por isso `clearSession` não conhece as outras
 * chaves e não tem como apagá-las.
 */

import type { Session, SpotifyUser } from '@/domain/types';

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

function validateUser(raw: unknown): SpotifyUser | null {
  const obj = asObject(raw);
  if (obj === null) return null;
  const id = asNonEmptyString(obj['id']);
  if (id === null) return null;
  const displayName = asString(obj['displayName']);
  return { id, displayName: displayName !== null && displayName !== '' ? displayName : id };
}

function validate(raw: Record<string, unknown>): Session | null {
  const accessToken = asNonEmptyString(raw['accessToken']);
  const refreshToken = asNonEmptyString(raw['refreshToken']);
  const expiresAt = asFiniteNumber(raw['expiresAt']);
  const scopes = asStringArray(raw['scopes']);
  const user = validateUser(raw['user']);

  if (
    accessToken === null ||
    refreshToken === null ||
    expiresAt === null ||
    scopes === null ||
    user === null
  ) {
    return null;
  }

  return { accessToken, refreshToken, expiresAt, scopes, user };
}

export function loadSession(): Session | null {
  return readVersioned('local', STORAGE_KEYS.session, validate);
}

export function saveSession(session: Session): WriteOutcome {
  return writeVersioned('local', STORAGE_KEYS.session, {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresAt: session.expiresAt,
    scopes: session.scopes,
    user: { id: session.user.id, displayName: session.user.displayName },
  });
}

/** Encerra a sessão. Por construção não alcança `tp.v1.credential` nem `tp.v1.draft`. */
export function clearSession(): void {
  discard('local', STORAGE_KEYS.session);
}

/** `true` quando falta menos que a margem de renovação proativa (research §9). */
export function isExpired(session: Session, now: number = Date.now()): boolean {
  return session.expiresAt - now < EXPIRY_MARGIN_MS;
}
