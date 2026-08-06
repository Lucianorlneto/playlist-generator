/**
 * Migração do esquema v1 (001) para o v2 (002) — contracts/storage.md §4, FR-042.
 *
 * Executada **uma vez** na inicialização, antes de qualquer leitura de estado. O
 * Princípio de armazenamento exige "migração ou descarte seguro, nunca leitura
 * de dado com formato antigo como se fosse novo", e FR-042 escolhe a migração:
 * um rascunho da versão anterior volta como fluxo Spotify de destino único, na
 * etapa em que foi gravado, sem aviso além do banner de recuperação existente.
 *
 * Regra que governa toda cópia: **a chave v1 só é removida depois da gravação v2
 * bem-sucedida.** Falha de gravação preserva o original — perder o trabalho do
 * usuário porque o armazenamento encheu no meio da migração seria o pior
 * desfecho possível.
 */

import type { ProviderId } from '@/domain/providers';
import type {
  CreationProgress,
  ExecutionQueue,
  InputLine,
  MatchItem,
  RunPhase,
  ServiceRun,
  WizardStep,
  WorkDraft,
} from '@/domain/types';

import { validateCreation as validateV2Creation, validateItem, saveDraft } from './draftRepo';
import {
  asBoolean,
  asFiniteNumber,
  asNonEmptyString,
  asObject,
  asString,
  asStringArray,
  discard,
  emitStorageWarning,
  hasKey,
  LEGACY_KEYS,
  LEGACY_SCHEMA_VERSION,
  peekRaw,
  STORAGE_KEYS,
  writeVersioned,
} from './schema';

/** O único destino que existia na 001. */
const LEGACY_PROVIDER: ProviderId = 'spotify';
/** Lote da 001: é o fator que converte lotes confirmados em itens. */
const LEGACY_BATCH_SIZE = 100;

export interface MigrationReport {
  ran: boolean;
  credential: boolean;
  session: boolean;
  authRequest: boolean;
  draft: boolean;
  /** Rascunho v1 ilegível, descartado com aviso. */
  draftDiscarded: boolean;
}

const EMPTY: MigrationReport = {
  ran: false,
  credential: false,
  session: false,
  authRequest: false,
  draft: false,
  draftDiscarded: false,
};

function isLegacy(raw: Record<string, unknown> | null): raw is Record<string, unknown> {
  return raw !== null && raw['schemaVersion'] === LEGACY_SCHEMA_VERSION;
}

// ---------------------------------------------------------------------------
// Credencial, sessão e registro de autorização
// ---------------------------------------------------------------------------

function migrateCredential(): boolean {
  const raw = peekRaw('local', LEGACY_KEYS.credential);
  if (!isLegacy(raw)) return false;

  const clientId = asNonEmptyString(raw['clientId']);
  if (clientId === null) {
    discard('local', LEGACY_KEYS.credential);
    return false;
  }

  const outcome = writeVersioned('local', STORAGE_KEYS.credential(LEGACY_PROVIDER), { clientId });
  if (outcome !== 'ok') return false;

  discard('local', LEGACY_KEYS.credential);
  return true;
}

function migrateSession(): boolean {
  const raw = peekRaw('local', LEGACY_KEYS.session);
  if (!isLegacy(raw)) return false;

  const accessToken = asNonEmptyString(raw['accessToken']);
  const refreshToken = asNonEmptyString(raw['refreshToken']);
  const expiresAt = asFiniteNumber(raw['expiresAt']);
  const scopes = asStringArray(raw['scopes']);
  const user = asObject(raw['user']);
  const userId = user === null ? null : asNonEmptyString(user['id']);

  if (
    accessToken === null ||
    refreshToken === null ||
    expiresAt === null ||
    scopes === null ||
    userId === null
  ) {
    discard('local', LEGACY_KEYS.session);
    return false;
  }

  const displayName = asString(user?.['displayName']) ?? '';
  const outcome = writeVersioned('local', STORAGE_KEYS.session(LEGACY_PROVIDER), {
    provider: LEGACY_PROVIDER,
    accessToken,
    refreshToken,
    expiresAt,
    scopes,
    user: { id: userId, displayName: displayName === '' ? userId : displayName },
  });
  if (outcome !== 'ok') return false;

  discard('local', LEGACY_KEYS.session);
  return true;
}

/** Efêmero: pode ser descartado sem perda se a cópia não couber. */
function migrateAuthRequest(): boolean {
  const raw = peekRaw('session', LEGACY_KEYS.pkce);
  if (raw === null) return false;

  const state = asNonEmptyString(raw['state']);
  const codeVerifier = asNonEmptyString(raw['codeVerifier']);
  const createdAt = asFiniteNumber(raw['createdAt']);

  if (state === null || codeVerifier === null || createdAt === null) {
    discard('session', LEGACY_KEYS.pkce);
    return false;
  }

  const outcome = writeVersioned(
    'session',
    STORAGE_KEYS.authRequest(LEGACY_PROVIDER),
    { provider: LEGACY_PROVIDER, state, codeVerifier, createdAt },
    { versioned: false },
  );
  discard('session', LEGACY_KEYS.pkce);
  return outcome === 'ok';
}

// ---------------------------------------------------------------------------
// Rascunho
// ---------------------------------------------------------------------------

/**
 * `credential` e `input` continuam iguais; `review` e `result` viram a etapa
 * `service`, porque na v2 as duas são fases do ciclo de um serviço.
 */
function migrateStep(legacyStep: unknown): { step: WizardStep; phase: RunPhase } | null {
  switch (legacyStep) {
    case 'credential':
      return { step: 'credential', phase: 'pending' };
    case 'input':
      return { step: 'input', phase: 'pending' };
    case 'review':
      return { step: 'service', phase: 'review' };
    case 'result':
      // Um rascunho v1 em `result` só existe quando a criação não concluiu — a
      // 001 apagava o rascunho no sucesso. Voltar como `creating` é o que
      // permite retomar a adição de onde parou.
      return { step: 'service', phase: 'creating' };
    default:
      return null;
  }
}

/** `committedBatches × 100 = committedItems` — a retomada continua exata (regra 2). */
function migrateCreation(raw: unknown): CreationProgress | null {
  const obj = asObject(raw);
  if (obj === null) return null;

  const playlistId = asNonEmptyString(obj['playlistId']);
  const playlistUrl = asString(obj['playlistUrl']);
  const orderedUris = asStringArray(obj['orderedUris']);
  const committedBatches = asFiniteNumber(obj['committedBatches']);
  const failedAt = obj['failedAt'] === null ? null : asFiniteNumber(obj['failedAt']);
  const batchSize = asFiniteNumber(obj['batchSize']) ?? LEGACY_BATCH_SIZE;

  if (playlistId === null || playlistUrl === null || orderedUris === null) return null;

  // Já em itens: um rascunho v2 chegando aqui por engano não é reinterpretado.
  if (committedBatches === null) return validateV2Creation(raw);

  const size = batchSize > 0 ? batchSize : LEGACY_BATCH_SIZE;
  return {
    playlistId,
    playlistUrl,
    orderedUris,
    batchSize: size,
    committedItems: Math.min(orderedUris.length, Math.max(0, committedBatches) * size),
    failedAt: failedAt ?? null,
  };
}

function buildRun(
  items: MatchItem[],
  lines: InputLine[],
  phase: RunPhase,
  creation: CreationProgress | null,
): ServiceRun {
  return {
    provider: LEGACY_PROVIDER,
    phase,
    lineIds: lines.map((line) => line.id),
    items,
    frozenLines: null,
    estimate: null,
    creation,
    result: null,
    outcome: null,
    error: null,
  };
}

function migrateDraft(): { migrated: boolean; discarded: boolean } {
  const raw = peekRaw('local', LEGACY_KEYS.draft);
  if (!isLegacy(raw)) return { migrated: false, discarded: false };

  const savedAt = asFiniteNumber(raw['savedAt']);
  const rawText = asString(raw['rawText']);
  const steps = migrateStep(raw['step']);
  const configRaw = asObject(raw['playlistConfig']);
  const itemsRaw = raw['items'];

  if (savedAt === null || rawText === null || steps === null || configRaw === null) {
    discard('local', LEGACY_KEYS.draft);
    emitStorageWarning({ key: LEGACY_KEYS.draft, reason: 'invalid_shape' });
    return { migrated: false, discarded: true };
  }

  const name = asString(configRaw['name']);
  const description = asString(configRaw['description']);
  const isPublic = asBoolean(configRaw['isPublic']);
  if (name === null || description === null || isPublic === null || !Array.isArray(itemsRaw)) {
    discard('local', LEGACY_KEYS.draft);
    emitStorageWarning({ key: LEGACY_KEYS.draft, reason: 'invalid_shape' });
    return { migrated: false, discarded: true };
  }

  const items: MatchItem[] = [];
  for (const entry of itemsRaw) {
    const item = validateItem(entry);
    if (item === null) {
      discard('local', LEGACY_KEYS.draft);
      emitStorageWarning({ key: LEGACY_KEYS.draft, reason: 'invalid_shape' });
      return { migrated: false, discarded: true };
    }
    items.push(item);
  }

  // A fonte única de linhas nasce dos itens, na ordem de `index`.
  const lines = [...items].sort((a, b) => a.line.index - b.line.index).map((item) => item.line);
  const creation = raw['creation'] === null ? null : migrateCreation(raw['creation']);

  const queue: ExecutionQueue = {
    order: [LEGACY_PROVIDER],
    currentIndex: steps.phase === 'pending' ? -1 : 0,
    runs: { [LEGACY_PROVIDER]: buildRun(items, lines, steps.phase, creation) } as Record<
      ProviderId,
      ServiceRun
    >,
  };

  const draft: WorkDraft = {
    schemaVersion: 2,
    savedAt,
    step: steps.step,
    rawText,
    lines,
    playlistConfig: { name, description, isPublic },
    // A criação já iniciada trava a seleção, como travaria na v2 (FR-012).
    destinations: { selected: [LEGACY_PROVIDER], locked: creation !== null },
    queue,
  };

  if (saveDraft(draft) === 'failed') return { migrated: false, discarded: false };

  discard('local', LEGACY_KEYS.draft);
  return { migrated: true, discarded: false };
}

// ---------------------------------------------------------------------------
// Ponto de entrada
// ---------------------------------------------------------------------------

/** `true` quando existe qualquer chave da v1 a converter. */
export function needsMigration(): boolean {
  return (
    hasKey('local', LEGACY_KEYS.credential) ||
    hasKey('local', LEGACY_KEYS.session) ||
    hasKey('local', LEGACY_KEYS.draft) ||
    hasKey('session', LEGACY_KEYS.pkce)
  );
}

/**
 * Converte tudo o que houver da v1. Idempotente: rodar de novo sem chaves v1 não
 * faz nada e não toca no estado v2 (invariante M1).
 */
export function migrateToV2(): MigrationReport {
  if (!needsMigration()) return EMPTY;

  const credential = migrateCredential();
  const session = migrateSession();
  const authRequest = migrateAuthRequest();
  const draft = migrateDraft();

  return {
    ran: true,
    credential,
    session,
    authRequest,
    draft: draft.migrated,
    draftDiscarded: draft.discarded,
  };
}
