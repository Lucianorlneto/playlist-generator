/**
 * Repositório da credencial (`tp.v1.credential`).
 *
 * Guarda **apenas** o Client ID. Não existe caminho de código capaz de gravar um
 * segredo de cliente aqui: o tipo não tem o campo e a serialização é explícita
 * campo a campo (FR-005).
 */

import type { Credential } from '@/domain/types';

import {
  asNonEmptyString,
  discard,
  readVersioned,
  STORAGE_KEYS,
  writeVersioned,
  type WriteOutcome,
} from './schema';

function validate(raw: Record<string, unknown>): Credential | null {
  const clientId = asNonEmptyString(raw['clientId']);
  if (clientId === null) return null;
  return { clientId };
}

export function loadCredential(): Credential | null {
  return readVersioned('local', STORAGE_KEYS.credential, validate);
}

/** O `trim()` é aplicado na gravação: espaços colados junto são erro comum. */
export function saveCredential(clientId: string): WriteOutcome {
  return writeVersioned('local', STORAGE_KEYS.credential, { clientId: clientId.trim() });
}

/** Ação explícita de "Remover credencial" (FR-004). Não toca em sessão nem rascunho. */
export function clearCredential(): void {
  discard('local', STORAGE_KEYS.credential);
}
