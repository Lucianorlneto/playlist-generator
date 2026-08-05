/**
 * Repositório do registro PKCE (`tp.v1.pkce`, `sessionStorage`).
 *
 * Fica em `sessionStorage` — não em `localStorage` — para morrer junto com a aba
 * (research §8). O `code_verifier` é destruído assim que o `code` é consumido,
 * com ou sem sucesso: {@link takePkce} lê e apaga na mesma operação, de modo que
 * não existe caminho em que o verifier sobreviva à troca.
 */

import type { PkceRecord } from '@/domain/types';

import {
  asFiniteNumber,
  asNonEmptyString,
  discard,
  readVersioned,
  STORAGE_KEYS,
  writeVersioned,
  type WriteOutcome,
} from './schema';

function validate(raw: Record<string, unknown>): PkceRecord | null {
  const codeVerifier = asNonEmptyString(raw['codeVerifier']);
  const state = asNonEmptyString(raw['state']);
  const createdAt = asFiniteNumber(raw['createdAt']);
  if (codeVerifier === null || state === null || createdAt === null) return null;
  return { codeVerifier, state, createdAt };
}

export function savePkce(record: PkceRecord): WriteOutcome {
  return writeVersioned('session', STORAGE_KEYS.pkce, {
    codeVerifier: record.codeVerifier,
    state: record.state,
    createdAt: record.createdAt,
  });
}

/** Lê e destrói o registro. Sempre apaga, mesmo quando o conteúdo é inválido. */
export function takePkce(): PkceRecord | null {
  const record = readVersioned('session', STORAGE_KEYS.pkce, validate);
  discard('session', STORAGE_KEYS.pkce);
  return record;
}

/** Leitura sem consumo — usada apenas em teste e diagnóstico. */
export function peekPkce(): PkceRecord | null {
  return readVersioned('session', STORAGE_KEYS.pkce, validate);
}

export function clearPkce(): void {
  discard('session', STORAGE_KEYS.pkce);
}
