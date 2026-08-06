import {
  initialSelection,
  lockSelection,
  reconcileSelection,
  toggleDestination,
} from '@/domain/run/selection';

import type { DestinationsSlice, SliceCreator } from './types';

/**
 * Seleção de destinos (US1, FR-008 a FR-012).
 *
 * Toda a regra vive em `domain/run/selection.ts`; este slice só guarda o estado
 * e reage. Em particular, `reconcileDestinations` é chamado pelo slice de
 * credenciais em toda gravação e remoção — é assim que "remover a credencial
 * desmarca **só** aquele destino" (FR-006) acontece sem que a tela precise
 * saber disso.
 */
export const createDestinationsSlice: SliceCreator<DestinationsSlice> = (set, get) => ({
  destinations: { selected: [], locked: false },

  setDestinations: (destinations) => set({ destinations }),

  toggleDestination: (provider) =>
    set((state) => ({
      destinations: toggleDestination(state.destinations, provider, state.credentials),
    })),

  reconcileDestinations: () =>
    set((state) => {
      // Antes de qualquer escolha do usuário, o padrão é derivado das
      // credenciais (invariante D2). Depois, só reconcilia.
      const touched = state.destinations.selected.length > 0 || state.destinations.locked;
      const next = touched
        ? reconcileSelection(state.destinations, state.credentials)
        : initialSelection(state.credentials);
      return next === state.destinations ? state : { destinations: next };
    }),

  lockDestinations: () => set({ destinations: lockSelection(get().destinations) }),
});
