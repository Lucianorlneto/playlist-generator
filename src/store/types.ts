import type { StateCreator } from 'zustand';

import type { TextPatch } from '@/domain/run/lines';
import type { RunEvent } from '@/domain/run/machine';
import type { ProviderId } from '@/domain/providers';
import type {
  ConsolidatedSummary,
  Credential,
  CreationProgress,
  CreationResult,
  DestinationSelection,
  ExecutionQueue,
  InputLine,
  MatchItem,
  PlaylistConfig,
  ProviderSession,
  QuotaEstimate,
  ServiceRun,
  WizardStep,
} from '@/domain/types';
import type { AppError } from '@/services/providers/errors';

// ---------------------------------------------------------------------------
// Wizard (FR-043)
// ---------------------------------------------------------------------------

export interface WizardSlice {
  step: WizardStep;
  /** Incrementa a cada transição; o cabeçalho usa isso para reposicionar o foco. */
  stepToken: number;
  goToStep: (step: WizardStep) => void;
  goNext: () => void;
  goBack: () => void;
}

// ---------------------------------------------------------------------------
// Credenciais, uma por provedor (US1, FR-001 a FR-007)
// ---------------------------------------------------------------------------

export interface CredentialSlice {
  credentials: Record<ProviderId, Credential | null>;
  /** Qual credencial está revelada; `null` significa todas mascaradas. */
  credentialRevealed: ProviderId | null;
  /** Aviso não bloqueante de formato divergente, por provedor. */
  credentialFormatWarning: Record<ProviderId, boolean>;
  setCredential: (provider: ProviderId, clientId: string) => void;
  removeCredential: (provider: ProviderId) => void;
  toggleCredentialReveal: (provider: ProviderId) => void;
}

// ---------------------------------------------------------------------------
// Sessões, uma por provedor (US1, FR-017, FR-035, FR-036)
// ---------------------------------------------------------------------------

export interface SessionSlice {
  sessions: Record<ProviderId, ProviderSession | null>;
  /** Provedor cuja autorização está em curso; `null` quando nenhuma. */
  connecting: ProviderId | null;
  authError: AppError | null;
  setSession: (provider: ProviderId, session: ProviderSession | null) => void;
  setConnecting: (provider: ProviderId | null) => void;
  setAuthError: (error: AppError | null) => void;
  /** Encerra a sessão de **um** serviço, sem afetar o outro (FR-036). */
  disconnect: (provider: ProviderId) => void;
}

// ---------------------------------------------------------------------------
// Destinos (US1, FR-008 a FR-013)
// ---------------------------------------------------------------------------

export interface DestinationsSlice {
  destinations: DestinationSelection;
  setDestinations: (selection: DestinationSelection) => void;
  toggleDestination: (provider: ProviderId) => void;
  /** Reaplica a regra "selecionado ⊆ com credencial" (FR-006). */
  reconcileDestinations: () => void;
  lockDestinations: () => void;
}

// ---------------------------------------------------------------------------
// Entrada: fonte única de linhas, compartilhada por todos os serviços (FR-014)
// ---------------------------------------------------------------------------

export interface SearchProgressState {
  running: boolean;
  done: number;
  total: number;
  canceled: boolean;
}

export interface ItemsSlice {
  rawText: string;
  lines: InputLine[];
  search: SearchProgressState;
  searchAbort: AbortController | null;

  setRawText: (rawText: string) => void;
  setLines: (lines: InputLine[]) => void;
  /** Correção de texto na fonte única; propaga aos serviços seguintes (FR-014). */
  correctLine: (lineId: string, patch: TextPatch) => void;

  /** Itens da execução corrente — atalho de leitura sobre a fila. */
  items: () => MatchItem[];
  setItems: (items: MatchItem[]) => void;
  /** Atualização local: nunca altera nenhum outro item. */
  patchItem: (lineId: string, patch: Partial<MatchItem>) => void;
  toggleIncluded: (lineId: string) => void;
  chooseCandidate: (lineId: string, uri: string) => void;
  discardItem: (lineId: string) => void;
  restoreItem: (lineId: string) => void;

  startSearch: (total: number, controller: AbortController) => void;
  reportSearchProgress: (done: number) => void;
  finishSearch: (canceled: boolean) => void;
  cancelSearch: () => void;
}

// ---------------------------------------------------------------------------
// Fila de execução (US3, FR-015 a FR-021, FR-040)
// ---------------------------------------------------------------------------

export interface RunSlice {
  queue: ExecutionQueue;

  buildQueue: () => void;
  currentRun: () => ServiceRun | null;
  currentProvider: () => ProviderId | null;
  runFor: (provider: ProviderId) => ServiceRun | null;
  summary: () => ConsolidatedSummary;

  startQueue: () => void;
  /** Aplica um evento do ciclo à execução corrente (ou à indicada). */
  dispatchRun: (event: RunEvent, provider?: ProviderId) => void;
  advance: () => void;
  reduceUpcoming: (provider: ProviderId, lineIds: string[]) => void;

  setEstimate: (provider: ProviderId, estimate: QuotaEstimate | null) => void;
  /** Retentativas já emitidas nesta execução (`003/data-model §5`, O4). */
  recordRetries: (provider: ProviderId, total: number) => void;
  setCreation: (provider: ProviderId, creation: CreationProgress | null) => void;
  setResult: (provider: ProviderId, result: CreationResult | null) => void;
}

// ---------------------------------------------------------------------------
// Configuração da playlist, informada uma vez para todos (FR-014)
// ---------------------------------------------------------------------------

export interface PlaylistConfigSlice {
  playlistConfig: PlaylistConfig;
  /** Nomes existentes **do serviço corrente**; a checagem é local a ele (FR-022). */
  existingNames: string[] | null;
  nameCheckError: AppError | null;
  nameCheckRunning: boolean;

  creating: boolean;
  creationError: AppError | null;

  setPlaylistName: (name: string) => void;
  setPlaylistDescription: (description: string) => void;
  setPlaylistVisibility: (isPublic: boolean) => void;

  setExistingNames: (names: string[] | null) => void;
  setNameCheckError: (error: AppError | null) => void;
  setNameCheckRunning: (running: boolean) => void;

  setCreating: (creating: boolean) => void;
  setCreationError: (error: AppError | null) => void;
}

// ---------------------------------------------------------------------------
// Rascunho
// ---------------------------------------------------------------------------

export type DraftNotice =
  | 'none'
  | 'recovered'
  | 'migrated'
  | 'quota_degraded'
  | 'quota_failed'
  | 'kept_after_quota'
  | 'discarded';

export interface DraftSlice {
  draftNotice: DraftNotice;
  draftSavedAt: number | null;
  setDraftNotice: (notice: DraftNotice, savedAt?: number | null) => void;
  discardDraft: () => void;
  resetWork: () => void;
}

export type AppState = WizardSlice &
  CredentialSlice &
  SessionSlice &
  DestinationsSlice &
  ItemsSlice &
  RunSlice &
  PlaylistConfigSlice &
  DraftSlice;

export type SliceCreator<T> = StateCreator<AppState, [], [], T>;
