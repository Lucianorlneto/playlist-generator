import { create } from 'zustand';

import { createCredentialSlice } from './credentialSlice';
import { createDraftSlice } from './draftSlice';
import { createItemsSlice } from './itemsSlice';
import { createPlaylistConfigSlice } from './playlistConfigSlice';
import { createSessionSlice } from './sessionSlice';
import type { AppState } from './types';
import { createWizardSlice } from './wizardSlice';

export const useAppStore = create<AppState>()((...args) => ({
  ...createWizardSlice(...args),
  ...createCredentialSlice(...args),
  ...createSessionSlice(...args),
  ...createItemsSlice(...args),
  ...createPlaylistConfigSlice(...args),
  ...createDraftSlice(...args),
}));

export type { AppState } from './types';
