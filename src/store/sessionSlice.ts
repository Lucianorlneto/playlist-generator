import { clearSession, saveSession } from '@/services/storage/sessionRepo';

import type { SessionSlice, SliceCreator } from './types';

export const createSessionSlice: SliceCreator<SessionSlice> = (set) => ({
  session: null,
  connecting: false,
  authError: null,

  setSession: (session) => {
    if (session === null) {
      clearSession();
    } else {
      saveSession(session);
    }
    set({ session, authError: null });
  },

  setConnecting: (connecting) => set({ connecting }),

  setAuthError: (authError) => set({ authError, connecting: false }),

  /**
   * Desconectar encerra a sessão e **nada mais**: credencial e rascunho seguem
   * intactos (US1 cenário 6, FR-044).
   */
  disconnect: () => {
    clearSession();
    set({ session: null, connecting: false, authError: null });
  },
});
