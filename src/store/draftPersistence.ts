/**
 * Persistência seletiva do rascunho de trabalho.
 *
 * `partialize` aqui é literal: só os campos de `WorkDraft` saem do store para o
 * disco. Token, Client ID e estado transitório (controlador de cancelamento,
 * progresso da busca) ficam de fora por construção — é o que sustenta o
 * invariante 2 de contracts/storage.md.
 *
 * Duas velocidades de gravação, deliberadamente:
 * - **debounce de 500 ms** para digitação, revisão e configuração;
 * - **gravação síncrona, sem debounce** quando `creation.committedBatches` muda.
 *   Um lote confirmado que ficasse pendurado em um timer poderia ser perdido em
 *   um fechamento de aba, e a retomada reenviaria faixas já adicionadas — que é
 *   exatamente o que SC-009 proíbe.
 *
 * Nota de desenho: a gravação passa por `draftRepo`, não pelo adaptador de
 * armazenamento do middleware `persist` do Zustand. O repositório é quem detém a
 * serialização campo a campo, a validação de forma na leitura e a degradação em
 * dois passos por cota (research §8) — nada disso cabe em um `StateStorage`, que
 * só enxerga uma string opaca.
 */

import { SCHEMA_VERSION, type WorkDraft } from '@/domain/types';
import { saveDraft, type SaveDraftOutcome } from '@/services/storage/draftRepo';

import { useAppStore } from './index';
import type { AppState } from './types';

export const DRAFT_DEBOUNCE_MS = 500;

/** Recorte do estado que vai para o disco. */
export function toWorkDraft(state: AppState): WorkDraft {
  return {
    schemaVersion: SCHEMA_VERSION,
    savedAt: Date.now(),
    step: state.step,
    rawText: state.rawText,
    playlistConfig: state.playlistConfig,
    items: state.items,
    creation: state.creation,
  };
}

function applyOutcome(outcome: SaveDraftOutcome): void {
  const { draftNotice, setDraftNotice } = useAppStore.getState();
  if (outcome === 'degraded' && draftNotice !== 'quota_degraded') {
    setDraftNotice('quota_degraded');
    return;
  }
  if (outcome === 'failed' && draftNotice !== 'quota_failed') {
    setDraftNotice('quota_failed');
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;

function cancelPending(): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
}

/** Gravação imediata. Usada após cada lote confirmado e ao sair da página. */
export function flushDraftNow(state: AppState = useAppStore.getState()): SaveDraftOutcome {
  cancelPending();
  const outcome = saveDraft(toWorkDraft(state));
  applyOutcome(outcome);
  return outcome;
}

function scheduleSave(): void {
  cancelPending();
  timer = setTimeout(() => {
    timer = null;
    const outcome = saveDraft(toWorkDraft(useAppStore.getState()));
    applyOutcome(outcome);
  }, DRAFT_DEBOUNCE_MS);
}

/**
 * Liga a persistência ao store. Devolve a função que a desliga — usada em teste
 * e por qualquer futuro desmonte da aplicação.
 */
export function attachDraftPersistence(): () => void {
  let previous = useAppStore.getState();

  const unsubscribe = useAppStore.subscribe((state) => {
    const committedChanged =
      (state.creation?.committedBatches ?? -1) !== (previous.creation?.committedBatches ?? -1);
    const draftChanged =
      state.rawText !== previous.rawText ||
      state.items !== previous.items ||
      state.playlistConfig !== previous.playlistConfig ||
      state.step !== previous.step ||
      state.creation !== previous.creation;

    previous = state;

    if (committedChanged) {
      flushDraftNow(state);
      return;
    }
    if (draftChanged) scheduleSave();
  });

  return () => {
    cancelPending();
    unsubscribe();
  };
}
