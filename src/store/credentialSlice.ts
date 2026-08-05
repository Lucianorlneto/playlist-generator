import { clearCredential, saveCredential } from '@/services/storage/credentialRepo';

import type { CredentialSlice, SliceCreator } from './types';

/** Formato emitido hoje pelo Spotify. Divergência gera aviso, nunca bloqueio. */
const CLIENT_ID_SHAPE = /^[0-9a-f]{32}$/;

export function looksLikeClientId(value: string): boolean {
  return CLIENT_ID_SHAPE.test(value.trim());
}

export const createCredentialSlice: SliceCreator<CredentialSlice> = (set) => ({
  credential: null,
  credentialRevealed: false,
  credentialFormatWarning: false,

  setCredential: (clientId) => {
    const trimmed = clientId.trim();
    saveCredential(trimmed);
    set({
      credential: { clientId: trimmed },
      credentialFormatWarning: !looksLikeClientId(trimmed),
      // Salvar sempre volta ao estado mascarado (FR-003, SC-004).
      credentialRevealed: false,
    });
  },

  removeCredential: () => {
    clearCredential();
    set({ credential: null, credentialRevealed: false, credentialFormatWarning: false });
  },

  toggleCredentialReveal: () => set((state) => ({ credentialRevealed: !state.credentialRevealed })),
});
