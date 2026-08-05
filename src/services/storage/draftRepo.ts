/**
 * Repositório do rascunho de trabalho (`tp.v1.draft`).
 *
 * A serialização é explícita campo a campo. Isso não é cerimônia: é o que
 * garante que nenhum token ou Client ID possa vazar para o rascunho, mesmo que
 * alguém acidentalmente coloque um objeto de sessão dentro do estado do store
 * (invariante 2 de contracts/storage.md).
 *
 * Em `QuotaExceededError` a gravação degrada em dois passos (research §8):
 * primeiro descarta as candidatas alternativas e mantém só a escolhida; se ainda
 * assim não couber, devolve `failed` para que a interface avise o usuário — nunca
 * falha em silêncio.
 */

import type {
  CreationProgress,
  InputLine,
  MatchItem,
  MatchStatus,
  PlaylistConfig,
  TrackCandidate,
  WizardStep,
  WorkDraft,
} from '@/domain/types';
import { BATCH_SIZE, WIZARD_STEPS } from '@/domain/types';

import {
  asBoolean,
  asFiniteNumber,
  asNonEmptyString,
  asObject,
  asString,
  asStringArray,
  discard,
  readVersioned,
  STORAGE_KEYS,
  writeVersioned,
} from './schema';

export type SaveDraftOutcome = 'ok' | 'degraded' | 'failed';

const MATCH_STATUSES: readonly MatchStatus[] = [
  'pending',
  'searching',
  'confident',
  'uncertain',
  'not_found',
  'unparsed',
  'discarded',
];

// ---------------------------------------------------------------------------
// Serialização
// ---------------------------------------------------------------------------

function serializeCandidate(candidate: TrackCandidate) {
  return {
    uri: candidate.uri,
    id: candidate.id,
    title: candidate.title,
    artists: candidate.artists,
    album: candidate.album,
    durationMs: candidate.durationMs,
    coverUrl: candidate.coverUrl,
    externalUrl: candidate.externalUrl,
    score: candidate.score,
  };
}

function serializeLine(line: InputLine) {
  return {
    id: line.id,
    index: line.index,
    raw: line.raw,
    title: line.title,
    artist: line.artist,
    featuredArtists: line.featuredArtists,
    parseStatus: line.parseStatus,
  };
}

function serializeItem(item: MatchItem, keepAlternatives: boolean) {
  const candidates = keepAlternatives
    ? item.candidates
    : item.candidates.filter((candidate) => candidate.uri === item.selectedUri);

  return {
    line: serializeLine(item.line),
    status: item.status,
    candidates: candidates.map(serializeCandidate),
    selectedUri: item.selectedUri,
    included: item.included,
    duplicateOf: item.duplicateOf,
    error: item.error,
    previousStatus: item.previousStatus,
  };
}

function serializeDraft(draft: WorkDraft, keepAlternatives: boolean): Record<string, unknown> {
  return {
    savedAt: draft.savedAt,
    step: draft.step,
    rawText: draft.rawText,
    playlistConfig: {
      name: draft.playlistConfig.name,
      description: draft.playlistConfig.description,
      isPublic: draft.playlistConfig.isPublic,
    },
    items: draft.items.map((item) => serializeItem(item, keepAlternatives)),
    creation:
      draft.creation === null
        ? null
        : {
            playlistId: draft.creation.playlistId,
            playlistUrl: draft.creation.playlistUrl,
            orderedUris: draft.creation.orderedUris,
            batchSize: draft.creation.batchSize,
            committedBatches: draft.creation.committedBatches,
            failedAt: draft.creation.failedAt,
          },
  };
}

// ---------------------------------------------------------------------------
// Validação de forma
// ---------------------------------------------------------------------------

function validateCandidate(raw: unknown): TrackCandidate | null {
  const obj = asObject(raw);
  if (obj === null) return null;

  const uri = asNonEmptyString(obj['uri']);
  const id = asNonEmptyString(obj['id']);
  const title = asString(obj['title']);
  const artists = asStringArray(obj['artists']);
  const album = asString(obj['album']);
  const durationMs = asFiniteNumber(obj['durationMs']);
  const externalUrl = asString(obj['externalUrl']);
  const score = asFiniteNumber(obj['score']);
  const coverUrlRaw = obj['coverUrl'];
  const coverUrl = coverUrlRaw === null ? null : asString(coverUrlRaw);

  if (
    uri === null ||
    id === null ||
    title === null ||
    artists === null ||
    album === null ||
    durationMs === null ||
    externalUrl === null ||
    score === null
  ) {
    return null;
  }

  return { uri, id, title, artists, album, durationMs, coverUrl, externalUrl, score };
}

function validateLine(raw: unknown): InputLine | null {
  const obj = asObject(raw);
  if (obj === null) return null;

  const id = asNonEmptyString(obj['id']);
  const index = asFiniteNumber(obj['index']);
  const rawText = asString(obj['raw']);
  const title = asString(obj['title']);
  const artist = asString(obj['artist']);
  const featuredArtists = asStringArray(obj['featuredArtists']);
  const parseStatus = obj['parseStatus'];

  if (
    id === null ||
    index === null ||
    rawText === null ||
    title === null ||
    artist === null ||
    featuredArtists === null ||
    (parseStatus !== 'parsed' && parseStatus !== 'unparsed')
  ) {
    return null;
  }

  return { id, index, raw: rawText, title, artist, featuredArtists, parseStatus };
}

function validateItem(raw: unknown): MatchItem | null {
  const obj = asObject(raw);
  if (obj === null) return null;

  const line = validateLine(obj['line']);
  const status = obj['status'];
  const included = asBoolean(obj['included']);
  if (line === null || !MATCH_STATUSES.includes(status as MatchStatus) || included === null) {
    return null;
  }

  const candidatesRaw = obj['candidates'];
  if (!Array.isArray(candidatesRaw)) return null;
  const candidates: TrackCandidate[] = [];
  for (const entry of candidatesRaw) {
    const candidate = validateCandidate(entry);
    if (candidate === null) return null;
    candidates.push(candidate);
  }

  const selectedUri = obj['selectedUri'] === null ? null : asString(obj['selectedUri']);
  const duplicateOf = obj['duplicateOf'] === null ? null : asString(obj['duplicateOf']);
  const error = obj['error'] === null ? null : asString(obj['error']);
  const previousStatusRaw = obj['previousStatus'];
  const previousStatus =
    previousStatusRaw === null || previousStatusRaw === undefined
      ? null
      : MATCH_STATUSES.includes(previousStatusRaw as MatchStatus)
        ? (previousStatusRaw as MatchStatus)
        : null;

  return {
    line,
    status: status as MatchStatus,
    candidates,
    selectedUri: selectedUri ?? null,
    included,
    duplicateOf: duplicateOf ?? null,
    error: error ?? null,
    previousStatus,
  };
}

function validateConfig(raw: unknown): PlaylistConfig | null {
  const obj = asObject(raw);
  if (obj === null) return null;
  const name = asString(obj['name']);
  const description = asString(obj['description']);
  const isPublic = asBoolean(obj['isPublic']);
  if (name === null || description === null || isPublic === null) return null;
  return { name, description, isPublic };
}

function validateCreation(raw: unknown): CreationProgress | null {
  const obj = asObject(raw);
  if (obj === null) return null;

  const playlistId = asNonEmptyString(obj['playlistId']);
  const playlistUrl = asString(obj['playlistUrl']);
  const orderedUris = asStringArray(obj['orderedUris']);
  const committedBatches = asFiniteNumber(obj['committedBatches']);
  const batchSize = asFiniteNumber(obj['batchSize']) ?? BATCH_SIZE;
  const failedAt = obj['failedAt'] === null ? null : asFiniteNumber(obj['failedAt']);

  if (
    playlistId === null ||
    playlistUrl === null ||
    orderedUris === null ||
    committedBatches === null
  ) {
    return null;
  }

  return {
    playlistId,
    playlistUrl,
    orderedUris,
    batchSize,
    committedBatches,
    failedAt: failedAt ?? null,
  };
}

function validate(raw: Record<string, unknown>): WorkDraft | null {
  const savedAt = asFiniteNumber(raw['savedAt']);
  const step = raw['step'];
  const rawText = asString(raw['rawText']);
  const playlistConfig = validateConfig(raw['playlistConfig']);

  if (
    savedAt === null ||
    !WIZARD_STEPS.includes(step as WizardStep) ||
    rawText === null ||
    playlistConfig === null
  ) {
    return null;
  }

  const itemsRaw = raw['items'];
  if (!Array.isArray(itemsRaw)) return null;
  const items: MatchItem[] = [];
  for (const entry of itemsRaw) {
    const item = validateItem(entry);
    if (item === null) return null;
    items.push(item);
  }

  const creation = raw['creation'] === null ? null : validateCreation(raw['creation']);

  return {
    schemaVersion: asFiniteNumber(raw['schemaVersion']) ?? 1,
    savedAt,
    step: step as WizardStep,
    rawText,
    playlistConfig,
    items,
    creation,
  };
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export function loadDraft(): WorkDraft | null {
  return readVersioned('local', STORAGE_KEYS.draft, validate);
}

/**
 * Grava o rascunho, degradando em dois passos se o armazenamento encher.
 *
 * - `ok`: gravado íntegro.
 * - `degraded`: gravado sem as candidatas alternativas (só a escolhida).
 * - `failed`: não coube; quem chama deve avisar o usuário (research §8).
 */
export function saveDraft(draft: WorkDraft): SaveDraftOutcome {
  const full = writeVersioned('local', STORAGE_KEYS.draft, serializeDraft(draft, true));
  if (full === 'ok') return 'ok';
  if (full === 'unavailable') return 'failed';

  const trimmed = writeVersioned('local', STORAGE_KEYS.draft, serializeDraft(draft, false));
  return trimmed === 'ok' ? 'degraded' : 'failed';
}

/** Apagado após criação bem-sucedida (FR-045) ou por "descartar rascunho". */
export function clearDraft(): void {
  discard('local', STORAGE_KEYS.draft);
}
