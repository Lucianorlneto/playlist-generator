import { PROVIDER_ORDER, type ProviderId } from '@/domain/providers';
import { clearCredential, saveCredential } from '@/services/storage/credentialRepo';

import type { CredentialSlice, SliceCreator } from './types';

/** Formatos emitidos hoje por cada provedor. Divergência gera aviso, nunca bloqueio. */
const CLIENT_ID_SHAPE: Record<ProviderId, RegExp> = {
  spotify: /^[0-9a-f]{32}$/u,
  youtube: /^[0-9a-z-]+\.apps\.googleusercontent\.com$/u,
};

export function looksLikeClientId(provider: ProviderId, value: string): boolean {
  return CLIENT_ID_SHAPE[provider].test(value.trim());
}

function emptyRecord<T>(value: T): Record<ProviderId, T> {
  const record = {} as Record<ProviderId, T>;
  for (const provider of PROVIDER_ORDER) record[provider] = value;
  return record;
}

export const createCredentialSlice: SliceCreator<CredentialSlice> = (set, get) => ({
  credentials: emptyRecord(null),
  credentialRevealed: null,
  credentialFormatWarning: emptyRecord(false),

  setCredential: (provider, clientId) => {
    const trimmed = clientId.trim();
    saveCredential(provider, trimmed);
    set((state) => ({
      credentials: { ...state.credentials, [provider]: { clientId: trimmed } },
      credentialFormatWarning: {
        ...state.credentialFormatWarning,
        [provider]: !looksLikeClientId(provider, trimmed),
      },
      // Salvar sempre volta ao estado mascarado (FR-003).
      credentialRevealed: null,
    }));
    // Cadastrar habilita o destino; a seleção padrão é exatamente o conjunto de
    // provedores com credencial (FR-010, invariante D2).
    get().reconcileDestinations();
  },

  removeCredential: (provider) => {
    // Só a chave daquele provedor é tocada — por construção (FR-006).
    clearCredential(provider);
    set((state) => ({
      credentials: { ...state.credentials, [provider]: null },
      credentialFormatWarning: { ...state.credentialFormatWarning, [provider]: false },
      credentialRevealed: state.credentialRevealed === provider ? null : state.credentialRevealed,
    }));
    // O destino correspondente é desmarcado no mesmo instante (invariante D1).
    get().reconcileDestinations();
  },

  toggleCredentialReveal: (provider) =>
    set((state) => ({
      credentialRevealed: state.credentialRevealed === provider ? null : provider,
    })),
});
