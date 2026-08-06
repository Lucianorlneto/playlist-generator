/**
 * Repositório da credencial, uma chave por provedor (`tp.v2.credential.{id}`).
 *
 * Guarda **apenas** o Client ID. Não existe caminho de código capaz de gravar um
 * segredo de cliente aqui: o tipo não tem o campo e a serialização é explícita
 * campo a campo (invariantes C1 e 4).
 *
 * Toda operação recebe o `ProviderId`. É essa assinatura — e não uma verificação
 * em tempo de execução — que garante FR-006: remover a credencial de um serviço
 * não tem como alcançar a chave de outro, porque a função só conhece uma chave.
 */

import type { ProviderId } from '@/domain/providers';
import { PROVIDER_ORDER } from '@/domain/providers';
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

export function loadCredential(provider: ProviderId): Credential | null {
  return readVersioned('local', STORAGE_KEYS.credential(provider), validate);
}

/** Credenciais de todos os provedores, na ordem fixa (FR-010). */
export function loadAllCredentials(): Record<ProviderId, Credential | null> {
  const result = {} as Record<ProviderId, Credential | null>;
  for (const provider of PROVIDER_ORDER) result[provider] = loadCredential(provider);
  return result;
}

/** O `trim()` é aplicado na gravação: espaços colados junto são erro comum. */
export function saveCredential(provider: ProviderId, clientId: string): WriteOutcome {
  return writeVersioned('local', STORAGE_KEYS.credential(provider), {
    clientId: clientId.trim(),
  });
}

/** Ação explícita de "Remover credencial" (FR-006). Não toca em sessão nem rascunho. */
export function clearCredential(provider: ProviderId): void {
  discard('local', STORAGE_KEYS.credential(provider));
}
