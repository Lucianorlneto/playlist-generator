import { emptyPlaylistConfig } from '@/domain/types';

import type { PlaylistConfigSlice, SliceCreator } from './types';

/**
 * Configuração da playlist — informada **uma vez** e válida para todos os
 * destinos (FR-014).
 *
 * `existingNames` é a única coisa aqui que é local a um serviço: a checagem de
 * nome duplicado vale por conta, e o nome usado em outro destino não interfere
 * (FR-022). Por isso a lista é zerada a cada troca de serviço, não acumulada.
 */
export const createPlaylistConfigSlice: SliceCreator<PlaylistConfigSlice> = (set) => ({
  playlistConfig: emptyPlaylistConfig(),
  existingNames: null,
  nameCheckError: null,
  nameCheckRunning: false,

  creating: false,
  creationError: null,

  setPlaylistName: (name) =>
    set((state) => ({ playlistConfig: { ...state.playlistConfig, name } })),

  setPlaylistDescription: (description) =>
    set((state) => ({ playlistConfig: { ...state.playlistConfig, description } })),

  setPlaylistVisibility: (isPublic) =>
    set((state) => ({ playlistConfig: { ...state.playlistConfig, isPublic } })),

  setExistingNames: (existingNames) => set({ existingNames, nameCheckError: null }),
  setNameCheckError: (nameCheckError) => set({ nameCheckError, nameCheckRunning: false }),
  setNameCheckRunning: (nameCheckRunning) => set({ nameCheckRunning }),

  setCreating: (creating) => set({ creating }),
  setCreationError: (creationError) => set({ creationError, creating: false }),
});
