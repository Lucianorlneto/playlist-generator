import { create } from 'zustand';

import { createCredentialSlice } from './credentialSlice';
import { createDestinationsSlice } from './destinationsSlice';
import { createDraftSlice } from './draftSlice';
import { createItemsSlice } from './itemsSlice';
import { createPlaylistConfigSlice } from './playlistConfigSlice';
import { createRunSlice } from './runSlice';
import { createSessionSlice } from './sessionSlice';
import { createThemeSlice } from './themeSlice';
import type { AppState } from './types';
import { createWizardSlice } from './wizardSlice';

export const useAppStore = create<AppState>()((...args) => ({
  ...createThemeSlice(...args),
  ...createWizardSlice(...args),
  ...createCredentialSlice(...args),
  ...createSessionSlice(...args),
  ...createDestinationsSlice(...args),
  ...createItemsSlice(...args),
  ...createRunSlice(...args),
  ...createPlaylistConfigSlice(...args),
  ...createDraftSlice(...args),
}));

export type { AppState } from './types';
