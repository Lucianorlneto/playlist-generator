import type { ProviderId } from '@/domain/providers';
import { emptyPlaylistConfig, type ExecutionQueue, type ServiceRun } from '@/domain/types';
import { clearDraft } from '@/services/storage/draftRepo';

import type { DraftSlice, SliceCreator } from './types';

const EMPTY_QUEUE: ExecutionQueue = {
  order: [],
  currentIndex: -1,
  runs: {} as Record<ProviderId, ServiceRun>,
};

/** Estado zerado do trabalho. As credenciais e as sessões **não** entram aqui. */
function blankWork() {
  return {
    rawText: '',
    lines: [],
    playlistConfig: emptyPlaylistConfig(),
    queue: EMPTY_QUEUE,
    // A trava de seleção cai junto: descartar o rascunho é o único caminho para
    // voltar a escolher destinos (FR-012, invariante D4).
    destinations: { selected: [], locked: false },
    creating: false,
    creationError: null,
    existingNames: null,
    nameCheckError: null,
    nameCheckRunning: false,
    search: { running: false, done: 0, total: 0, canceled: false },
    searchAbort: null,
  };
}

export const createDraftSlice: SliceCreator<DraftSlice> = (set, get) => ({
  draftNotice: 'none',
  draftSavedAt: null,

  setDraftNotice: (draftNotice, savedAt) =>
    set(savedAt === undefined ? { draftNotice } : { draftNotice, draftSavedAt: savedAt }),

  /**
   * "Descartar rascunho" — a **única** ação, além do sucesso completo, que pode
   * apagar trabalho em andamento (Princípio V, invariante W2). Preserva as
   * credenciais: por isso não há nenhuma chamada a `clearCredential` aqui.
   */
  discardDraft: () => {
    // `006/FR-022`: abortar **antes** de zerar. `blankWork()` põe `searchAbort`
    // em `null`, e sem esta linha o controlador ia embora sem ninguém que
    // pudesse pará-lo — a busca seguia gastando cota de um trabalho já
    // descartado (`006/research §6`).
    get().searchAbort?.abort();
    set({
      ...blankWork(),
      step: 'destinations',
      draftNotice: 'discarded',
      draftSavedAt: null,
    });
    // A seleção volta ao padrão derivado das credenciais (invariante D2).
    get().reconcileDestinations();
    // Apagado **por último**, de propósito: zerar o trabalho notifica a
    // persistência, que grava de forma síncrona. Apagar antes deixaria um
    // rascunho vazio de volta no disco logo depois do descarte.
    clearDraft();
  },

  /**
   * Recomeço do trabalho. Nasceu como saída de uma criação bem-sucedida e a
   * partir da `006` é também o destino do comando global de recomeço e do pulo
   * que encerra o fluxo sem nada a relatar (`006/FR-016`, FR-004).
   */
  resetWork: () => {
    // Mesmo motivo do descarte (`006/FR-022`).
    get().searchAbort?.abort();
    set({
      ...blankWork(),
      step: 'destinations',
      draftNotice: 'none',
      draftSavedAt: null,
    });
    get().reconcileDestinations();
    // Mesmo motivo do descarte: a gravação disparada por zerar o trabalho não
    // pode ressuscitar o rascunho que a criação bem-sucedida já apagou.
    clearDraft();
  },
});
