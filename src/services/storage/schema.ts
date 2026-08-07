/**
 * Leitura e gravação versionadas do armazenamento local (contracts/storage.md).
 *
 * Regra central: **nunca lança**. Armazenamento indisponível (modo privado do
 * Safari), JSON corrompido, forma inesperada ou `schemaVersion` desconhecida
 * resultam em `null` mais um aviso — nunca em uma exceção que derrube a
 * aplicação. Conteúdo de versão desconhecida é descartado, jamais migrado às
 * cegas (invariante 3).
 *
 * **Isolamento por provedor** (invariante 1): as chaves de credencial, sessão,
 * autorização em voo e consumo de cota são **funções** de `ProviderId`. Não é
 * estilo: é o que torna estruturalmente impossível remover a credencial de um
 * serviço e alcançar a de outro (FR-006). O repositório recebe o provedor e só
 * conhece a chave daquele.
 */

import type { ProviderId } from '@/domain/providers';

/**
 * Versão das estruturas **planas** — credencial, sessão e consumo de cota.
 *
 * Estável desde a 002 e deliberadamente separada de `SCHEMA_VERSION`, que
 * governa só o rascunho (`003/contracts/storage.md §2`). Amarrar as duas faria
 * cada mudança no formato do rascunho invalidar a credencial e a sessão do
 * usuário — desconectá-lo do serviço por uma razão que não tem nada a ver com
 * ele.
 */
export const RECORD_SCHEMA_VERSION = 2;

export const STORAGE_KEYS = {
  credential: (provider: ProviderId): string => `tp.v2.credential.${provider}`,
  session: (provider: ProviderId): string => `tp.v2.session.${provider}`,
  /** Efêmero, em `sessionStorage`: morre junto com a aba. */
  authRequest: (provider: ProviderId): string => `tp.v2.authreq.${provider}`,
  quota: (provider: ProviderId): string => `tp.v2.quota.${provider}`,
  draft: 'tp.v2.draft',
} as const;

/** Chaves da 001, lidas **apenas** pela migração (contracts/storage.md §4). */
export const LEGACY_KEYS = {
  credential: 'tp.v1.credential',
  session: 'tp.v1.session',
  draft: 'tp.v1.draft',
  pkce: 'tp.v1.pkce',
} as const;

export const LEGACY_SCHEMA_VERSION = 1;

export type StorageArea = 'local' | 'session';

export type WarningReason =
  | 'unavailable'
  | 'corrupted'
  | 'invalid_shape'
  | 'unknown_version'
  | 'quota_exceeded'
  | 'write_failed';

export interface StorageWarning {
  key: string;
  reason: WarningReason;
}

export type WriteOutcome = 'ok' | 'quota_exceeded' | 'unavailable';

/** Guarda de forma: recebe o objeto cru e devolve o valor tipado ou `null`. */
export type ShapeValidator<T> = (value: Record<string, unknown>) => T | null;

// ---------------------------------------------------------------------------
// Avisos
// ---------------------------------------------------------------------------

type WarningListener = (warning: StorageWarning) => void;

const listeners = new Set<WarningListener>();

/** Assina os avisos de armazenamento. Devolve a função de cancelamento. */
export function onStorageWarning(listener: WarningListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitStorageWarning(warning: StorageWarning): void {
  for (const listener of listeners) {
    try {
      listener(warning);
    } catch {
      // Um assinante quebrado não pode impedir os demais de serem avisados.
    }
  }
}

// ---------------------------------------------------------------------------
// Acesso bruto, tolerante a falhas
// ---------------------------------------------------------------------------

function storageFor(area: StorageArea): Storage | null {
  try {
    const storage = area === 'local' ? globalThis.localStorage : globalThis.sessionStorage;
    // O simples acesso pode lançar em contextos com armazenamento bloqueado.
    return storage ?? null;
  } catch {
    return null;
  }
}

function isQuotaError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === 'QuotaExceededError') return true;
  // Firefox antigo e alguns WebViews usam nomes/códigos próprios.
  return error.name === 'NS_ERROR_DOM_QUOTA_REACHED';
}

// ---------------------------------------------------------------------------
// API versionada
// ---------------------------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export interface VersionedOptions {
  /**
   * `false` para registros efêmeros que não carregam `schemaVersion` — o
   * registro de autorização em voo é o único caso.
   */
  versioned?: boolean;
  /** Versão esperada. A migração usa {@link LEGACY_SCHEMA_VERSION}. */
  expectedVersion?: number;
}

/**
 * Lê e valida uma chave.
 *
 * Descarta e avisa quando: o armazenamento não existe, o JSON não parseia, o
 * conteúdo não é objeto, a `schemaVersion` diverge da esperada, ou o validador
 * de forma recusa o conteúdo.
 */
export function readVersioned<T>(
  area: StorageArea,
  key: string,
  validate: ShapeValidator<T>,
  options: VersionedOptions = {},
): T | null {
  const { versioned = true, expectedVersion = RECORD_SCHEMA_VERSION } = options;

  const storage = storageFor(area);
  if (storage === null) {
    emitStorageWarning({ key, reason: 'unavailable' });
    return null;
  }

  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    emitStorageWarning({ key, reason: 'unavailable' });
    return null;
  }
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    discard(area, key);
    emitStorageWarning({ key, reason: 'corrupted' });
    return null;
  }

  if (!isPlainObject(parsed)) {
    discard(area, key);
    emitStorageWarning({ key, reason: 'invalid_shape' });
    return null;
  }

  if (versioned && parsed['schemaVersion'] !== expectedVersion) {
    discard(area, key);
    emitStorageWarning({ key, reason: 'unknown_version' });
    return null;
  }

  let value: T | null;
  try {
    value = validate(parsed);
  } catch {
    value = null;
  }

  if (value === null) {
    discard(area, key);
    emitStorageWarning({ key, reason: 'invalid_shape' });
    return null;
  }

  return value;
}

/**
 * Lê sem descartar em caso de recusa. A migração precisa disso: um rascunho v1
 * que ela não consiga converter só pode ser apagado depois de uma decisão
 * explícita, nunca como efeito colateral da leitura (contracts/storage.md §4).
 */
export function peekRaw(area: StorageArea, key: string): Record<string, unknown> | null {
  const storage = storageFor(area);
  if (storage === null) return null;
  try {
    const raw = storage.getItem(key);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Grava uma chave versionada. Devolve o desfecho em vez de lançar — quem chama
 * decide se degrada (rascunho) ou apenas avisa.
 */
export function writeVersioned(
  area: StorageArea,
  key: string,
  payload: Record<string, unknown>,
  options: VersionedOptions = {},
): WriteOutcome {
  const { versioned = true, expectedVersion = RECORD_SCHEMA_VERSION } = options;

  const storage = storageFor(area);
  if (storage === null) {
    emitStorageWarning({ key, reason: 'unavailable' });
    return 'unavailable';
  }

  const body = versioned ? { schemaVersion: expectedVersion, ...payload } : payload;

  try {
    storage.setItem(key, JSON.stringify(body));
    return 'ok';
  } catch (error) {
    if (isQuotaError(error)) {
      emitStorageWarning({ key, reason: 'quota_exceeded' });
      return 'quota_exceeded';
    }
    emitStorageWarning({ key, reason: 'write_failed' });
    return 'unavailable';
  }
}

/** Apaga uma chave. Silencioso e seguro mesmo sem armazenamento disponível. */
export function discard(area: StorageArea, key: string): void {
  const storage = storageFor(area);
  if (storage === null) return;
  try {
    storage.removeItem(key);
  } catch {
    // Nada a fazer: apagar o que não pode ser lido nem escrito é inócuo.
  }
}

export function hasKey(area: StorageArea, key: string): boolean {
  const storage = storageFor(area);
  if (storage === null) return false;
  try {
    return storage.getItem(key) !== null;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Primitivos de validação de forma, reutilizados pelos repositórios
// ---------------------------------------------------------------------------

export function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

export function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.every((entry) => typeof entry === 'string') ? (value as string[]) : null;
}

export function asObject(value: unknown): Record<string, unknown> | null {
  return isPlainObject(value) ? value : null;
}
