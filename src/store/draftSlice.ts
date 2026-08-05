import { emptyPlaylistConfig } from '@/domain/types';
import { clearDraft } from '@/services/storage/draftRepo';

import type { DraftSlice, SliceCreator } from './types';

export const createDraftSlice: SliceCreator<DraftSlice> = (set) => ({
  draftNotice: 'none',
  draftSavedAt: null,

  setDraftNotice: (draftNotice, savedAt) =>
    set(savedAt === undefined ? { draftNotice } : { draftNotice, draftSavedAt: savedAt }),

  /**
   * "Descartar rascunho" (FR-045). Zera o trabalho e **preserva a credencial** —
   * por isso não há nenhuma chamada a `clearCredential` aqui.
   */
  discardDraft: () => {
    clearDraft();
    set({
      rawText: '',
      items: [],
      playlistConfig: emptyPlaylistConfig(),
      creation: null,
      creationError: null,
      result: null,
      existingNames: null,
      nameCheckError: null,
      search: { running: false, done: 0, total: 0, canceled: false },
      searchAbort: null,
      step: 'input',
      draftNotice: 'discarded',
      draftSavedAt: null,
    });
  },

  /** Recomeço após uma criação bem-sucedida — o rascunho já foi apagado (FR-045). */
  resetWork: () =>
    set({
      rawText: '',
      items: [],
      playlistConfig: emptyPlaylistConfig(),
      creation: null,
      creationError: null,
      result: null,
      existingNames: null,
      nameCheckError: null,
      search: { running: false, done: 0, total: 0, canceled: false },
      searchAbort: null,
      step: 'input',
      draftNotice: 'none',
      draftSavedAt: null,
    }),
});
