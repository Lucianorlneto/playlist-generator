/**
 * Leitura e gravação versionadas do armazenamento local (contracts/storage.md).
 *
 * Regra central: **nunca lança**. Armazenamento indisponível (modo privado do
 * Safari), JSON corrompido, forma inesperada ou `schemaVersion` desconhecida
 * resultam em `null` mais um aviso — nunca em uma exceção que derrube a
 * aplicação. Conteúdo de versão desconhecida é descartado, jamais migrado às
 * cegas.
 */

import { SCHEMA_VERSION } from '@/domain/types';

export const STORAGE_KEYS = {
  credential: 'tp.v1.credential',
  session: 'tp.v1.session',
  draft: 'tp.v1.draft',
  pkce: 'tp.v1.pkce',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

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

/**
 * Lê e valida uma chave versionada.
 *
 * Descarta e avisa quando: o armazenamento não existe, o JSON não parseia, o
 * conteúdo não é objeto, a `schemaVersion` diverge de {@link SCHEMA_VERSION}, ou
 * o validador de forma recusa o conteúdo.
 */
export function readVersioned<T>(
  area: StorageArea,
  key: StorageKey,
  validate: ShapeValidator<T>,
): T | null {
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

  // O registro do PKCE é efêmero e não carrega versão (contracts/storage.md).
  if (key !== STORAGE_KEYS.pkce) {
    if (parsed['schemaVersion'] !== SCHEMA_VERSION) {
      discard(area, key);
      emitStorageWarning({ key, reason: 'unknown_version' });
      return null;
    }
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
 * Grava uma chave versionada. Devolve o desfecho em vez de lançar — quem chama
 * decide se degrada (rascunho) ou apenas avisa.
 */
export function writeVersioned(
  area: StorageArea,
  key: StorageKey,
  payload: Record<string, unknown>,
): WriteOutcome {
  const storage = storageFor(area);
  if (storage === null) {
    emitStorageWarning({ key, reason: 'unavailable' });
    return 'unavailable';
  }

  const body = key === STORAGE_KEYS.pkce ? payload : { schemaVersion: SCHEMA_VERSION, ...payload };

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
export function discard(area: StorageArea, key: StorageKey): void {
  const storage = storageFor(area);
  if (storage === null) return;
  try {
    storage.removeItem(key);
  } catch {
    // Nada a fazer: apagar o que não pode ser lido nem escrito é inócuo.
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
