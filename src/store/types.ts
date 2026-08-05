import type { StateCreator } from 'zustand';

import type {
  Credential,
  CreationProgress,
  CreationResult,
  MatchItem,
  PlaylistConfig,
  Session,
  WizardStep,
} from '@/domain/types';
import type { AppError } from '@/services/spotify/errors';

// ---------------------------------------------------------------------------
// Wizard (FR-041)
// ---------------------------------------------------------------------------

export interface WizardSlice {
  step: WizardStep;
  /** Incrementa a cada transição; o cabeçalho usa isso para reposicionar o foco (FR-046). */
  stepToken: number;
  goToStep: (step: WizardStep) => void;
  goNext: () => void;
  goBack: () => void;
}

// ---------------------------------------------------------------------------
// Credencial (US1)
// ---------------------------------------------------------------------------

export interface CredentialSlice {
  credential: Credential | null;
  credentialRevealed: boolean;
  /** Aviso não bloqueante de formato divergente (data-model.md → Credential). */
  credentialFormatWarning: boolean;
  setCredential: (clientId: string) => void;
  removeCredential: () => void;
  toggleCredentialReveal: () => void;
}

// ---------------------------------------------------------------------------
// Sessão (US1, US4)
// ---------------------------------------------------------------------------

export interface SessionSlice {
  session: Session | null;
  connecting: boolean;
  authError: AppError | null;
  setSession: (session: Session | null) => void;
  setConnecting: (connecting: boolean) => void;
  setAuthError: (error: AppError | null) => void;
  disconnect: () => void;
}

// ---------------------------------------------------------------------------
// Entrada e correspondências (US2)
// ---------------------------------------------------------------------------

export interface SearchProgressState {
  running: boolean;
  done: number;
  total: number;
  canceled: boolean;
}

export interface ItemsSlice {
  rawText: string;
  items: MatchItem[];
  search: SearchProgressState;
  searchAbort: AbortController | null;

  setRawText: (rawText: string) => void;
  setItems: (items: MatchItem[]) => void;
  /** Atualização local: nunca altera nenhum outro item (FR-017). */
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
// Configuração e criação da playlist (US3)
// ---------------------------------------------------------------------------

export interface PlaylistConfigSlice {
  playlistConfig: PlaylistConfig;
  existingNames: string[] | null;
  nameCheckError: AppError | null;
  nameCheckRunning: boolean;

  creation: CreationProgress | null;
  creating: boolean;
  creationError: AppError | null;
  result: CreationResult | null;

  setPlaylistName: (name: string) => void;
  setPlaylistDescription: (description: string) => void;
  setPlaylistVisibility: (isPublic: boolean) => void;

  setExistingNames: (names: string[] | null) => void;
  setNameCheckError: (error: AppError | null) => void;
  setNameCheckRunning: (running: boolean) => void;

  setCreation: (creation: CreationProgress | null) => void;
  setCreating: (creating: boolean) => void;
  setCreationError: (error: AppError | null) => void;
  setResult: (result: CreationResult | null) => void;
}

// ---------------------------------------------------------------------------
// Rascunho (US4)
// ---------------------------------------------------------------------------

export type DraftNotice = 'none' | 'recovered' | 'quota_degraded' | 'quota_failed' | 'discarded';

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
  ItemsSlice &
  PlaylistConfigSlice &
  DraftSlice;

export type SliceCreator<T> = StateCreator<AppState, [], [], T>;
