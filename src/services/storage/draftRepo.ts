/**
 * Repositório do rascunho de trabalho (`tp.v2.draft`).
 *
 * A serialização é explícita campo a campo. Isso não é cerimônia: é o que
 * garante que nenhum token ou Client ID vaze para o rascunho, mesmo que alguém
 * acidentalmente coloque um objeto de sessão dentro do estado do store
 * (invariante 2 de contracts/storage.md, invariante W1).
 *
 * **Degradação por cota de armazenamento.** O rascunho agora guarda itens de
 * dois serviços (pior caso previsto ≈ 800 KB), com menos folga que na 001. A
 * gravação degrada em três passos antes de desistir:
 *
 * 1. íntegro;
 * 2. sem as candidatas alternativas das execuções **já concluídas** — o
 *    resultado delas está congelado e as alternativas são peso morto;
 * 3. sem as candidatas alternativas de nenhuma execução;
 * 4. `failed`, e a interface avisa — nunca falha em silêncio.
 *
 * A ordem dos passos 2 e 3 é o inverso da listagem de contracts/storage.md §5.
 * A do contrato não é progressiva: descartar "as alternativas" (passo 1 de lá)
 * já engloba as das execuções concluídas, de modo que o passo seguinte não
 * liberaria byte algum. Esta ordem preserva a intenção — sacrificar primeiro o
 * que já não pode mais ser usado — e é estritamente monotônica.
 */

import type { ProviderId } from '@/domain/providers';
import { PROVIDER_ORDER, isProviderId } from '@/domain/providers';
import type {
  AppErrorInfo,
  CreationProgress,
  CreationResult,
  DestinationSelection,
  ExecutionQueue,
  InputLine,
  MatchItem,
  MatchStatus,
  PlaylistConfig,
  QuotaEstimate,
  RunOutcome,
  RunPhase,
  ServiceRun,
  TrackCandidate,
  VersionHint,
  WizardStep,
  WorkDraft,
} from '@/domain/types';
import { WIZARD_STEPS } from '@/domain/types';

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

const RUN_PHASES: readonly RunPhase[] = [
  'pending',
  'connect',
  'estimate',
  'search',
  'review',
  'creating',
  'done',
  'skipped',
  'failed',
];

const RUN_OUTCOMES: readonly RunOutcome[] = ['completed', 'partial', 'failed', 'skipped'];

const VERSION_HINTS: readonly VersionHint[] = [
  'live',
  'cover',
  'remix',
  'acoustic',
  'karaoke',
  'instrumental',
  'sped_up',
  'slowed',
  'nightcore',
  'mashup',
  'tribute',
  'remaster',
  'excerpt',
  'reaction',
  'duration_outlier',
];

/** Quais execuções perdem as candidatas alternativas nesta tentativa. */
type Trim = 'none' | 'finished' | 'all';

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
    ...(candidate.channel === undefined ? {} : { channel: candidate.channel }),
    ...(candidate.versionHints === undefined ? {} : { versionHints: candidate.versionHints }),
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

function serializeEstimate(estimate: QuotaEstimate) {
  return {
    provider: estimate.provider,
    lineCount: estimate.lineCount,
    selectedCount: estimate.selectedCount,
    estimatedUnits: estimate.estimatedUnits,
    availableUnits: estimate.availableUnits,
    blocked: estimate.blocked,
    maxLinesThatFit: estimate.maxLinesThatFit,
  };
}

function serializeCreation(creation: CreationProgress) {
  return {
    playlistId: creation.playlistId,
    playlistUrl: creation.playlistUrl,
    orderedUris: creation.orderedUris,
    batchSize: creation.batchSize,
    committedItems: creation.committedItems,
    failedAt: creation.failedAt,
  };
}

function serializeResult(result: CreationResult) {
  return {
    provider: result.provider,
    playlistId: result.playlistId,
    playlistUrl: result.playlistUrl,
    playlistName: result.playlistName,
    effectivePath: result.effectivePath,
    addedCount: result.addedCount,
    skippedCount: result.skippedCount,
    failedLines: result.failedLines,
    incompleteByQuota: result.incompleteByQuota,
  };
}

function serializeErrorInfo(error: AppErrorInfo) {
  return {
    provider: error.provider,
    kind: error.kind,
    title: error.title,
    cause: error.cause,
    nextStep: error.nextStep,
  };
}

function serializeRun(run: ServiceRun, trim: Trim) {
  const finished = run.outcome !== null;
  const keepAlternatives = trim === 'none' || (trim === 'finished' && !finished);

  return {
    provider: run.provider,
    phase: run.phase,
    lineIds: run.lineIds,
    items: run.items.map((item) => serializeItem(item, keepAlternatives)),
    frozenLines: run.frozenLines === null ? null : run.frozenLines.map(serializeLine),
    estimate: run.estimate === null ? null : serializeEstimate(run.estimate),
    creation: run.creation === null ? null : serializeCreation(run.creation),
    result: run.result === null ? null : serializeResult(run.result),
    outcome: run.outcome,
    error: run.error === null ? null : serializeErrorInfo(run.error),
  };
}

function serializeDraft(draft: WorkDraft, trim: Trim): Record<string, unknown> {
  const runs: Record<string, unknown> = {};
  for (const provider of PROVIDER_ORDER) {
    const run = draft.queue.runs[provider];
    if (run !== undefined) runs[provider] = serializeRun(run, trim);
  }

  return {
    savedAt: draft.savedAt,
    step: draft.step,
    rawText: draft.rawText,
    lines: draft.lines.map(serializeLine),
    playlistConfig: {
      name: draft.playlistConfig.name,
      description: draft.playlistConfig.description,
      isPublic: draft.playlistConfig.isPublic,
    },
    destinations: {
      selected: draft.destinations.selected,
      locked: draft.destinations.locked,
    },
    queue: {
      order: draft.queue.order,
      currentIndex: draft.queue.currentIndex,
      runs,
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

  const channel = asString(obj['channel']);
  const hintsRaw = obj['versionHints'];
  const versionHints = Array.isArray(hintsRaw)
    ? hintsRaw.filter((hint): hint is VersionHint => VERSION_HINTS.includes(hint as VersionHint))
    : null;

  return {
    uri,
    id,
    title,
    artists,
    album,
    durationMs,
    coverUrl,
    externalUrl,
    score,
    ...(channel === null ? {} : { channel }),
    ...(versionHints === null ? {} : { versionHints }),
  };
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

function validateLines(raw: unknown): InputLine[] | null {
  if (!Array.isArray(raw)) return null;
  const lines: InputLine[] = [];
  for (const entry of raw) {
    const line = validateLine(entry);
    if (line === null) return null;
    lines.push(line);
  }
  return lines;
}

export function validateItem(raw: unknown): MatchItem | null {
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

export function validateCreation(raw: unknown): CreationProgress | null {
  const obj = asObject(raw);
  if (obj === null) return null;

  const playlistId = asNonEmptyString(obj['playlistId']);
  const playlistUrl = asString(obj['playlistUrl']);
  const orderedUris = asStringArray(obj['orderedUris']);
  const committedItems = asFiniteNumber(obj['committedItems']);
  const batchSize = asFiniteNumber(obj['batchSize']);
  const failedAt = obj['failedAt'] === null ? null : asFiniteNumber(obj['failedAt']);

  if (
    playlistId === null ||
    playlistUrl === null ||
    orderedUris === null ||
    committedItems === null ||
    batchSize === null
  ) {
    return null;
  }

  return {
    playlistId,
    playlistUrl,
    orderedUris,
    batchSize,
    committedItems,
    failedAt: failedAt ?? null,
  };
}

function validateEstimate(raw: unknown): QuotaEstimate | null {
  const obj = asObject(raw);
  if (obj === null) return null;
  const provider = obj['provider'];
  const lineCount = asFiniteNumber(obj['lineCount']);
  const selectedCount = asFiniteNumber(obj['selectedCount']);
  const estimatedUnits = asFiniteNumber(obj['estimatedUnits']);
  const availableUnits = asFiniteNumber(obj['availableUnits']);
  const blocked = asBoolean(obj['blocked']);
  const maxLinesThatFit = asFiniteNumber(obj['maxLinesThatFit']);

  if (
    !isProviderId(provider) ||
    lineCount === null ||
    selectedCount === null ||
    estimatedUnits === null ||
    availableUnits === null ||
    blocked === null ||
    maxLinesThatFit === null
  ) {
    return null;
  }

  return {
    provider,
    lineCount,
    selectedCount,
    estimatedUnits,
    availableUnits,
    blocked,
    maxLinesThatFit,
  };
}

function validateResult(raw: unknown): CreationResult | null {
  const obj = asObject(raw);
  if (obj === null) return null;

  const provider = obj['provider'];
  const playlistId = asNonEmptyString(obj['playlistId']);
  const playlistUrl = asString(obj['playlistUrl']);
  const playlistName = asString(obj['playlistName']);
  const effectivePath = asString(obj['effectivePath']);
  const addedCount = asFiniteNumber(obj['addedCount']);
  const skippedCount = asFiniteNumber(obj['skippedCount']);
  const failedLines = asStringArray(obj['failedLines']);
  const incompleteByQuota = asBoolean(obj['incompleteByQuota']);

  if (
    !isProviderId(provider) ||
    playlistId === null ||
    playlistUrl === null ||
    playlistName === null ||
    effectivePath === null ||
    addedCount === null ||
    skippedCount === null ||
    failedLines === null
  ) {
    return null;
  }

  return {
    provider,
    playlistId,
    playlistUrl,
    playlistName,
    effectivePath,
    addedCount,
    skippedCount,
    failedLines,
    incompleteByQuota: incompleteByQuota ?? false,
  };
}

function validateErrorInfo(raw: unknown): AppErrorInfo | null {
  const obj = asObject(raw);
  if (obj === null) return null;
  const provider = obj['provider'];
  const kind = asNonEmptyString(obj['kind']);
  const title = asString(obj['title']);
  const cause = asString(obj['cause']);
  const nextStep = asString(obj['nextStep']);
  if (!isProviderId(provider) || kind === null || title === null || cause === null || nextStep === null) {
    return null;
  }
  return { provider, kind, title, cause, nextStep };
}

function validateRun(raw: unknown, provider: ProviderId): ServiceRun | null {
  const obj = asObject(raw);
  if (obj === null) return null;

  const phase = obj['phase'];
  const lineIds = asStringArray(obj['lineIds']);
  if (!RUN_PHASES.includes(phase as RunPhase) || lineIds === null) return null;

  const itemsRaw = obj['items'];
  if (!Array.isArray(itemsRaw)) return null;
  const items: MatchItem[] = [];
  for (const entry of itemsRaw) {
    const item = validateItem(entry);
    if (item === null) return null;
    items.push(item);
  }

  const frozenLines = obj['frozenLines'] === null ? null : validateLines(obj['frozenLines']);
  const outcomeRaw = obj['outcome'];
  const outcome =
    outcomeRaw === null || outcomeRaw === undefined
      ? null
      : RUN_OUTCOMES.includes(outcomeRaw as RunOutcome)
        ? (outcomeRaw as RunOutcome)
        : null;

  return {
    provider,
    phase: phase as RunPhase,
    lineIds,
    items,
    frozenLines,
    estimate: obj['estimate'] === null ? null : validateEstimate(obj['estimate']),
    creation: obj['creation'] === null ? null : validateCreation(obj['creation']),
    result: obj['result'] === null ? null : validateResult(obj['result']),
    outcome,
    error: obj['error'] === null ? null : validateErrorInfo(obj['error']),
  };
}

function validateSelection(raw: unknown): DestinationSelection | null {
  const obj = asObject(raw);
  if (obj === null) return null;
  const selectedRaw = asStringArray(obj['selected']);
  const locked = asBoolean(obj['locked']);
  if (selectedRaw === null || locked === null) return null;
  if (!selectedRaw.every(isProviderId)) return null;
  // A ordem fixa é sempre reimposta na leitura (invariante P1).
  const selected = PROVIDER_ORDER.filter((provider) => selectedRaw.includes(provider));
  return { selected, locked };
}

function validateQueue(raw: unknown): ExecutionQueue | null {
  const obj = asObject(raw);
  if (obj === null) return null;

  const orderRaw = asStringArray(obj['order']);
  const currentIndex = asFiniteNumber(obj['currentIndex']);
  if (orderRaw === null || currentIndex === null || !orderRaw.every(isProviderId)) return null;
  const order = PROVIDER_ORDER.filter((provider) => orderRaw.includes(provider));

  const runsRaw = asObject(obj['runs']);
  if (runsRaw === null) return null;

  const runs = {} as Record<ProviderId, ServiceRun>;
  for (const provider of PROVIDER_ORDER) {
    const entry = runsRaw[provider];
    if (entry === undefined) continue;
    const run = validateRun(entry, provider);
    if (run === null) return null;
    runs[provider] = run;
  }

  // Toda execução da ordem precisa existir, ou a fila não é navegável.
  for (const provider of order) {
    if (runs[provider] === undefined) return null;
  }

  return { order, currentIndex, runs };
}

function validate(raw: Record<string, unknown>): WorkDraft | null {
  const savedAt = asFiniteNumber(raw['savedAt']);
  const step = raw['step'];
  const rawText = asString(raw['rawText']);
  const playlistConfig = validateConfig(raw['playlistConfig']);
  const lines = validateLines(raw['lines']);
  const destinations = validateSelection(raw['destinations']);
  const queue = validateQueue(raw['queue']);

  if (
    savedAt === null ||
    !WIZARD_STEPS.includes(step as WizardStep) ||
    rawText === null ||
    playlistConfig === null ||
    lines === null ||
    destinations === null ||
    queue === null
  ) {
    return null;
  }

  return {
    schemaVersion: asFiniteNumber(raw['schemaVersion']) ?? 2,
    savedAt,
    step: step as WizardStep,
    rawText,
    lines,
    playlistConfig,
    destinations,
    queue,
  };
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export function loadDraft(): WorkDraft | null {
  return readVersioned('local', STORAGE_KEYS.draft, validate);
}

/**
 * Grava o rascunho, degradando em três passos se o armazenamento encher.
 *
 * - `ok`: gravado íntegro.
 * - `degraded`: gravado sem parte das candidatas alternativas.
 * - `failed`: não coube; quem chama **deve** avisar o usuário.
 */
export function saveDraft(draft: WorkDraft): SaveDraftOutcome {
  const full = writeVersioned('local', STORAGE_KEYS.draft, serializeDraft(draft, 'none'));
  if (full === 'ok') return 'ok';
  if (full === 'unavailable') return 'failed';

  const withoutFinished = writeVersioned(
    'local',
    STORAGE_KEYS.draft,
    serializeDraft(draft, 'finished'),
  );
  if (withoutFinished === 'ok') return 'degraded';
  if (withoutFinished === 'unavailable') return 'failed';

  const withoutAny = writeVersioned('local', STORAGE_KEYS.draft, serializeDraft(draft, 'all'));
  return withoutAny === 'ok' ? 'degraded' : 'failed';
}

/**
 * Apagado após **sucesso** de todos os serviços ou por ação explícita de
 * descarte — e por nada mais (Princípio V, invariante W2). Encerramento por
 * esgotamento de cota **preserva** o rascunho.
 */
export function clearDraft(): void {
  discard('local', STORAGE_KEYS.draft);
}
