import { emptyPlaylistConfig } from '@/domain/types';

import type { PlaylistConfigSlice, SliceCreator } from './types';

export const createPlaylistConfigSlice: SliceCreator<PlaylistConfigSlice> = (set) => ({
  playlistConfig: emptyPlaylistConfig(),
  existingNames: null,
  nameCheckError: null,
  nameCheckRunning: false,

  creation: null,
  creating: false,
  creationError: null,
  result: null,

  setPlaylistName: (name) =>
    set((state) => ({ playlistConfig: { ...state.playlistConfig, name } })),

  setPlaylistDescription: (description) =>
    set((state) => ({ playlistConfig: { ...state.playlistConfig, description } })),

  setPlaylistVisibility: (isPublic) =>
    set((state) => ({ playlistConfig: { ...state.playlistConfig, isPublic } })),

  setExistingNames: (existingNames) => set({ existingNames, nameCheckError: null }),
  setNameCheckError: (nameCheckError) => set({ nameCheckError, nameCheckRunning: false }),
  setNameCheckRunning: (nameCheckRunning) => set({ nameCheckRunning }),

  setCreation: (creation) => set({ creation }),
  setCreating: (creating) => set({ creating }),
  setCreationError: (creationError) => set({ creationError, creating: false }),
  setResult: (result) => set({ result }),
});
