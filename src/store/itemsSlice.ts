import { applyTextCorrection } from '@/domain/run/lines';
import { currentProvider } from '@/domain/run/queue';
import type { MatchItem } from '@/domain/types';

import type { ItemsSlice, SliceCreator } from './types';

/**
 * Aplica uma transformação a um único item, preservando a identidade dos demais.
 *
 * Não é micro-otimização: rebuscar ou editar uma linha não pode alterar o estado
 * de revisão de nenhuma outra, e devolver os mesmos objetos é o que torna isso
 * verificável.
 */
function mapItem(
  items: MatchItem[],
  lineId: string,
  transform: (item: MatchItem) => MatchItem,
): MatchItem[] {
  let changed = false;
  const next = items.map((item) => {
    if (item.line.id !== lineId) return item;
    changed = true;
    return transform(item);
  });
  return changed ? next : items;
}

/**
 * Entrada e revisão.
 *
 * Os itens **pertencem à execução corrente**, não ao store: escolha de
 * candidata, inclusão e exclusão não atravessam serviços (FR-014, invariante
 * M1). As linhas, ao contrário, são fonte única compartilhada — e uma correção
 * de texto reescreve a linha para os serviços seguintes.
 */
export const createItemsSlice: SliceCreator<ItemsSlice> = (set, get) => ({
  rawText: '',
  lines: [],
  search: { running: false, done: 0, total: 0, canceled: false },
  searchAbort: null,

  setRawText: (rawText) => set({ rawText }),

  setLines: (lines) => set({ lines }),

  correctLine: (lineId, patch) => {
    set((state) => {
      const lines = applyTextCorrection(state.lines, lineId, patch);
      return lines === state.lines ? state : { lines };
    });
    // A linha corrigida também aparece no item em revisão do serviço corrente.
    const corrected = get().lines.find((line) => line.id === lineId);
    if (corrected === undefined) return;
    get().patchItem(lineId, { line: corrected });
  },

  items: () => {
    const state = get();
    const provider = currentProvider(state.queue);
    if (provider === null) return [];
    return state.queue.runs[provider]?.items ?? [];
  },

  setItems: (items) => {
    get().dispatchRun({ type: 'items_changed', items });
  },

  patchItem: (lineId, patch) => {
    const items = get().items();
    const next = mapItem(items, lineId, (item) => ({ ...item, ...patch }));
    if (next !== items) get().setItems(next);
  },

  toggleIncluded: (lineId) => {
    const items = get().items();
    const next = mapItem(items, lineId, (item) => {
      // Incluir exige uma faixa escolhida (invariante de data-model.md).
      if (!item.included && item.selectedUri === null) return item;
      return { ...item, included: !item.included };
    });
    if (next !== items) get().setItems(next);
  },

  chooseCandidate: (lineId, uri) => {
    const items = get().items();
    const next = mapItem(items, lineId, (item) => {
      const candidate = item.candidates.find((entry) => entry.uri === uri);
      if (candidate === undefined) return item;
      return {
        ...item,
        selectedUri: uri,
        // Escolha manual é confirmação visual: o item passa a Confiante.
        status: 'confident',
        included: item.duplicateOf === null,
        previousStatus: null,
      };
    });
    if (next !== items) get().setItems(next);
  },

  discardItem: (lineId) => {
    const items = get().items();
    const next = mapItem(items, lineId, (item) =>
      item.status === 'discarded'
        ? item
        : { ...item, previousStatus: item.status, status: 'discarded', included: false },
    );
    if (next !== items) get().setItems(next);
  },

  restoreItem: (lineId) => {
    const items = get().items();
    const next = mapItem(items, lineId, (item) => {
      if (item.status !== 'discarded') return item;
      const restored = item.previousStatus ?? 'pending';
      return {
        ...item,
        status: restored,
        previousStatus: null,
        included:
          restored === 'confident' && item.selectedUri !== null && item.duplicateOf === null,
      };
    });
    if (next !== items) get().setItems(next);
  },

  startSearch: (total, controller) =>
    set({
      searchAbort: controller,
      search: { running: true, done: 0, total, canceled: false },
    }),

  reportSearchProgress: (done) => set((state) => ({ search: { ...state.search, done } })),

  finishSearch: (canceled) =>
    set((state) => ({
      searchAbort: null,
      search: { ...state.search, running: false, canceled },
    })),

  cancelSearch: () => {
    // Abortar aqui é o que interrompe também a espera por limitação (SC-011):
    // o mesmo sinal atravessa o limitador e o backoff do cliente HTTP.
    get().searchAbort?.abort();
  },
});
