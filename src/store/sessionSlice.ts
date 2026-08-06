import { PROVIDER_ORDER, type ProviderId } from '@/domain/providers';
import type { ProviderSession } from '@/domain/types';
import { clearSession, saveSession } from '@/services/storage/sessionRepo';

import type { SessionSlice, SliceCreator } from './types';

function emptySessions(): Record<ProviderId, ProviderSession | null> {
  const record = {} as Record<ProviderId, ProviderSession | null>;
  for (const provider of PROVIDER_ORDER) record[provider] = null;
  return record;
}

export const createSessionSlice: SliceCreator<SessionSlice> = (set) => ({
  sessions: emptySessions(),
  connecting: null,
  authError: null,

  setSession: (provider, session) => {
    if (session === null) clearSession(provider);
    else saveSession(session);
    set((state) => ({
      sessions: { ...state.sessions, [provider]: session },
      authError: null,
      connecting: state.connecting === provider ? null : state.connecting,
    }));
  },

  setConnecting: (connecting) => set({ connecting }),

  setAuthError: (authError) => set({ authError, connecting: null }),

  /**
   * Desconectar encerra a sessão **daquele** serviço e nada mais: a credencial,
   * o rascunho e a sessão do outro serviço seguem intactos (FR-036, S2).
   */
  disconnect: (provider) => {
    clearSession(provider);
    set((state) => ({
      sessions: { ...state.sessions, [provider]: null },
      connecting: state.connecting === provider ? null : state.connecting,
      authError: null,
    }));
  },
});
