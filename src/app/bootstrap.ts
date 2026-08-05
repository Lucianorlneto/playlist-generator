/**
 * Inicialização da aplicação.
 *
 * Ordem importa: credencial e sessão saem do disco **antes** do tratamento do
 * retorno de autorização (que precisa do Client ID) e antes da restauração do
 * rascunho (que decide a etapa inicial).
 */

import { useEffect, useRef } from 'react';

import { handleAuthCallback } from '@/features/connect/callback';
import { handleSessionLoss } from '@/features/connect/reconnect';
import { createRefresher } from '@/services/spotify/auth';
import { configureSpotifyClient } from '@/services/spotify/client';
import { loadCredential } from '@/services/storage/credentialRepo';
import { onStorageWarning } from '@/services/storage/schema';
import { clearSession, loadSession, saveSession } from '@/services/storage/sessionRepo';
import { useAppStore } from '@/store';
import { attachDraftPersistence } from '@/store/draftPersistence';
import { restoreDraft } from '@/store/restoreDraft';

function wireSpotifyClient(): void {
  configureSpotifyClient({
    getSession: () => useAppStore.getState().session,
    saveSession: (session) => {
      saveSession(session);
      useAppStore.setState({ session });
    },
    clearSession: () => {
      clearSession();
      // A perda de sessão é tratada em um lugar só: grava o rascunho, limpa a
      // sessão e pede reconexão preservando a etapa (US4 cenário 2).
      handleSessionLoss();
    },
    refresh: createRefresher(() => useAppStore.getState().credential?.clientId ?? null),
  });
}

/**
 * Executa a inicialização uma única vez, mesmo sob o duplo `useEffect` do
 * StrictMode — repetir o tratamento do callback consumiria um código já usado.
 *
 * As assinaturas (persistência do rascunho, avisos de armazenamento) ficam em
 * efeitos **separados**, com o próprio par montar/desmontar. Colocá-las junto do
 * trecho de uma vez só as deixaria desligadas depois do ciclo do StrictMode: a
 * limpeza da primeira montagem rodaria, a segunda cairia na guarda e nunca as
 * religaria — e o rascunho pararia de ser gravado sem nenhum erro visível.
 */
export function useBootstrap(): void {
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    wireSpotifyClient();

    const store = useAppStore.getState();

    const credential = loadCredential();
    if (credential !== null) useAppStore.setState({ credential });

    const session = loadSession();
    if (session !== null) useAppStore.setState({ session });

    const restored = restoreDraft();

    void handleAuthCallback(credential?.clientId ?? null).then((outcome) => {
      if (outcome.kind === 'connected') {
        store.setSession(outcome.session);
        // Sem rascunho recuperado, conectar leva direto à etapa de entrada.
        if (!restored) useAppStore.getState().goToStep('input');
        return;
      }
      if (outcome.kind === 'error') {
        store.setAuthError(outcome.error);
        useAppStore.getState().goToStep('credential');
      }
    });
  }, []);

  useEffect(() => attachDraftPersistence(), []);

  useEffect(
    () =>
      onStorageWarning((warning) => {
        if (warning.reason === 'quota_exceeded') {
          useAppStore.getState().setDraftNotice('quota_failed');
        }
      }),
    [],
  );
}
