/**
 * Repositório do registro de autorização em voo (`tp.v2.authreq.{provider}`,
 * `sessionStorage`).
 *
 * Fica em `sessionStorage` — não em `localStorage` — para morrer junto com a
 * aba. O `codeVerifier` (só existe no PKCE do Spotify) é destruído assim que o
 * retorno é consumido, com ou sem sucesso: {@link takeAuthRequest} lê e apaga na
 * mesma operação, de modo que não exista caminho em que ele sobreviva à troca.
 *
 * O YouTube usa implicit flow e grava apenas `state`: não há verifier porque não
 * há segunda requisição para protegê-lo.
 */

import type { ProviderId } from '@/domain/providers';
import { isProviderId } from '@/domain/providers';
import type { AuthRequest } from '@/domain/types';

import {
  asFiniteNumber,
  asNonEmptyString,
  discard,
  readVersioned,
  STORAGE_KEYS,
  writeVersioned,
  type WriteOutcome,
} from './schema';

/** Registro efêmero: não carrega `schemaVersion` (contracts/storage.md §1). */
const EPHEMERAL = { versioned: false } as const;

function validateFor(provider: ProviderId) {
  return (raw: Record<string, unknown>): AuthRequest | null => {
    const state = asNonEmptyString(raw['state']);
    const createdAt = asFiniteNumber(raw['createdAt']);
    const stored = raw['provider'];
    if (state === null || createdAt === null || !isProviderId(stored) || stored !== provider) {
      return null;
    }

    const codeVerifier = asNonEmptyString(raw['codeVerifier']);
    return {
      provider,
      state,
      createdAt,
      ...(codeVerifier === null ? {} : { codeVerifier }),
    };
  };
}

export function saveAuthRequest(record: AuthRequest): WriteOutcome {
  return writeVersioned(
    'session',
    STORAGE_KEYS.authRequest(record.provider),
    {
      provider: record.provider,
      state: record.state,
      createdAt: record.createdAt,
      ...(record.codeVerifier === undefined ? {} : { codeVerifier: record.codeVerifier }),
    },
    EPHEMERAL,
  );
}

/** Lê e destrói o registro. Sempre apaga, mesmo quando o conteúdo é inválido. */
export function takeAuthRequest(provider: ProviderId): AuthRequest | null {
  const record = readVersioned(
    'session',
    STORAGE_KEYS.authRequest(provider),
    validateFor(provider),
    EPHEMERAL,
  );
  discard('session', STORAGE_KEYS.authRequest(provider));
  return record;
}

/** Leitura sem consumo — usada apenas em teste e diagnóstico. */
export function peekAuthRequest(provider: ProviderId): AuthRequest | null {
  return readVersioned(
    'session',
    STORAGE_KEYS.authRequest(provider),
    validateFor(provider),
    EPHEMERAL,
  );
}

export function clearAuthRequest(provider: ProviderId): void {
  discard('session', STORAGE_KEYS.authRequest(provider));
}
