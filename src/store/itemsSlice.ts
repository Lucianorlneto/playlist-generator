import type { MatchItem } from '@/domain/types';

import type { ItemsSlice, SliceCreator } from './types';

/**
 * Aplica uma transformação a um único item, preservando a identidade dos demais.
 *
 * Não é micro-otimização: FR-017 exige que rebuscar ou editar uma linha não
 * altere o estado de revisão de nenhuma outra, e devolver os mesmos objetos é o
 * que torna isso verificável.
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

export const createItemsSlice: SliceCreator<ItemsSlice> = (set, get) => ({
  rawText: '',
  items: [],
  search: { running: false, done: 0, total: 0, canceled: false },
  searchAbort: null,

  setRawText: (rawText) => set({ rawText }),

  setItems: (items) => set({ items }),

  patchItem: (lineId, patch) =>
    set((state) => ({ items: mapItem(state.items, lineId, (item) => ({ ...item, ...patch })) })),

  toggleIncluded: (lineId) =>
    set((state) => ({
      items: mapItem(state.items, lineId, (item) => {
        // Incluir exige uma faixa escolhida (invariante de data-model.md).
        if (!item.included && item.selectedUri === null) return item;
        return { ...item, included: !item.included };
      }),
    })),

  chooseCandidate: (lineId, uri) =>
    set((state) => ({
      items: mapItem(state.items, lineId, (item) => {
        const candidate = item.candidates.find((entry) => entry.uri === uri);
        if (candidate === undefined) return item;
        return {
          ...item,
          selectedUri: uri,
          // Escolha manual é confirmação visual: o item passa a Confiante (FR-024).
          status: 'confident',
          included: item.duplicateOf === null,
          previousStatus: null,
        };
      }),
    })),

  discardItem: (lineId) =>
    set((state) => ({
      items: mapItem(state.items, lineId, (item) =>
        item.status === 'discarded'
          ? item
          : { ...item, previousStatus: item.status, status: 'discarded', included: false },
      ),
    })),

  restoreItem: (lineId) =>
    set((state) => ({
      items: mapItem(state.items, lineId, (item) => {
        if (item.status !== 'discarded') return item;
        const restored = item.previousStatus ?? 'pending';
        return {
          ...item,
          status: restored,
          previousStatus: null,
          included:
            restored === 'confident' && item.selectedUri !== null && item.duplicateOf === null,
        };
      }),
    })),

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
