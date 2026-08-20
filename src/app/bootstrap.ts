/**
 * Inicialização da aplicação.
 *
 * Ordem importa, e cada passo depende do anterior:
 *
 * 1. **migração v1 → v2** (FR-042) — antes de qualquer leitura de estado, ou o
 *    conteúdo antigo seria lido como se fosse novo, que é o que o Princípio de
 *    armazenamento proíbe;
 * 2. credenciais e sessões saem do disco — o tratamento do retorno de
 *    autorização precisa do Client ID do provedor que está voltando;
 * 3. restauração do rascunho, que decide a etapa e o serviço iniciais;
 * 4. tratamento do retorno de autorização.
 */

import { useEffect, useRef } from 'react';

import { PROVIDER_ORDER, type ProviderId } from '@/domain/providers';
import { handleAuthCallback } from '@/features/connect/callback';
import { handleSessionLoss } from '@/features/connect/reconnect';
import { createRefresher } from '@/services/providers/spotify/auth';
import { configureProviderClient } from '@/services/providers/http';
import { providerFor } from '@/services/providers/registry';
import { loadAllCredentials } from '@/services/storage/credentialRepo';
import { loadThemePreference } from '@/services/storage/themeRepo';
import { subscribeToSystemPreference, systemPrefersDark } from '@/services/theme/systemPreference';
import { migrateToV2, migrateToV3 } from '@/services/storage/migrations';
import { onStorageWarning, STORAGE_KEYS } from '@/services/storage/schema';
import { classifyYouTubeError } from '@/services/providers/youtube/errors';
import { clearSession, loadAllSessions, saveSession } from '@/services/storage/sessionRepo';
import { useAppStore } from '@/store';
import { attachDraftPersistence } from '@/store/draftPersistence';
import { restoreDraft } from '@/store/restoreDraft';
import { comFusaoDeTema } from '@/ui/motion/themeTransition';

/**
 * Liga um cliente HTTP por provedor. A renovação só é injetada onde a capacidade
 * declara que ela existe — no YouTube não há o que injetar, e a expiração cai no
 * caminho de reautorização explícita (FR-035).
 */
function wireProviderClients(): void {
  for (const provider of PROVIDER_ORDER) {
    const adapter = providerFor(provider);

    configureProviderClient(provider, {
      getSession: () => useAppStore.getState().sessions[provider],
      saveSession: (session) => {
        saveSession(session);
        useAppStore.setState((state) => ({
          sessions: { ...state.sessions, [provider]: session },
        }));
      },
      clearSession: () => {
        clearSession(provider);
        // A perda de sessão é tratada em um lugar só: grava o rascunho, limpa
        // **aquela** sessão e pede reautorização preservando a fase.
        handleSessionLoss(provider);
      },
      ...(provider === 'spotify'
        ? {
            refresh: createRefresher(
              () => useAppStore.getState().credentials.spotify?.clientId ?? null,
            ),
          }
        : {}),
      ...(adapter.recordConsumption === undefined
        ? {}
        : { recordConsumption: adapter.recordConsumption }),
      // A desambiguação do `403` é injetada, não importada pelo cliente: é o que
      // mantém `http.ts` genérico, sem nenhuma referência a provedor (contrato §3).
      ...(provider === 'youtube' ? { classifyError: classifyYouTubeError } : {}),
    });
  }
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

    // 1. Migrações antes de qualquer restauração de estado (`002/FR-042`).
    //    A cadeia é sequencial: um rascunho da 001 passa por v1→v2→v3 aqui,
    //    e sai com as linhas que estavam condenadas por falta de separador
    //    novamente buscáveis (`003/research §11`).
    const migration = migrateToV2();
    const v3 = migrateToV3();

    wireProviderClients();

    const credentials = loadAllCredentials();
    const sessions = loadAllSessions();
    useAppStore.setState({ credentials, sessions });
    useAppStore.getState().reconcileDestinations();

    const restored = restoreDraft(migration.draft || v3.migrated);

    const clientIds: Partial<Record<ProviderId, string | null>> = {};
    for (const provider of PROVIDER_ORDER) {
      clientIds[provider] = credentials[provider]?.clientId ?? null;
    }

    void handleAuthCallback(clientIds).then((outcome) => {
      const store = useAppStore.getState();

      if (outcome.kind === 'connected') {
        store.setSession(outcome.session.provider, outcome.session);
        // O ciclo do serviço retoma sozinho a partir da fase `connect`.
        if (!restored.restored) store.goToStep('destinations');
        return;
      }
      if (outcome.kind === 'error') {
        store.setAuthError(outcome.error);
      }
    });
  }, []);

  useEffect(() => attachDraftPersistence(), []);

  useEffect(
    () =>
      onStorageWarning((warning) => {
        // FR-011: falha ao gravar preferência de cor nunca vira mensagem
        // visível. O aviso de armazenamento chega à interface para as demais
        // chaves; para esta, o usuário não tem nada a decidir e a troca vale na
        // sessão de qualquer forma (contracts/storage.md §3).
        if (warning.key === STORAGE_KEYS.theme) return;

        if (warning.reason === 'quota_exceeded') {
          useAppStore.getState().setDraftNotice('quota_failed');
        }
      }),
    [],
  );

  useThemeRuntime();
}

/**
 * Liga a preferência de tema ao elemento raiz (FR-006, FR-009, FR-010).
 *
 * Fica **fora** de `useBootstrap`, num efeito próprio, pelo mesmo motivo das
 * assinaturas de rascunho: o trecho de execução única do `useBootstrap` roda uma
 * vez sob o StrictMode e não religaria a assinatura depois do ciclo de
 * montar/desmontar.
 *
 * A leitura inicial acontece aqui **de novo**, mesmo com `public/theme-boot.js`
 * já tendo escrito o atributo. Não é redundância: o script resolve a pintura, o
 * store resolve o estado, e é o store que o `ThemeControl` precisa para saber
 * qual segmento está selecionado.
 */
function useThemeRuntime(): void {
  useEffect(() => {
    const store = useAppStore.getState();
    store.hydrateTheme(loadThemePreference(), systemPrefersDark());

    return subscribeToSystemPreference((prefersDark) => {
      // O evento chega sempre; `setSystemPrefersDark` decide se ele produz
      // efeito, consultando a preferência. A regra de FR-009 mora num lugar só,
      // a função pura `resolveTheme`.
      useAppStore.getState().setSystemPrefersDark(prefersDark);
    });
  }, []);

  useEffect(() => {
    const apply = (theme: 'light' | 'dark'): void => {
      document.documentElement.setAttribute('data-theme', theme);
    };

    /*
      A **primeira** aplicação não funde, e a distinção é a mesma do FR-024: ela
      não é uma troca. `public/theme-boot.js` já escreveu o atributo antes da
      primeira pintura, e esta chamada só confirma o que já está na tela —
      fotografar e fundir dois quadros idênticos seria trabalho para não mostrar
      nada.
    */
    apply(useAppStore.getState().effectiveTheme);

    return useAppStore.subscribe((state, previous) => {
      if (state.effectiveTheme === previous.effectiveTheme) return;

      /*
        Daqui em diante toda mudança é uma troca — pelo controle de tema ou pelo
        sistema operacional mudando embaixo de nós —, e as duas merecem a fusão
        (010/FR-029). A decisão de fundir ou não mora em `comFusaoDeTema`; aqui
        só se declara o que muda.

        Com a fusão, o atributo troca no **quadro seguinte**: a API fotografa
        antes de aplicar. `state.effectiveTheme` é lido aqui e não relido lá
        dentro justamente por isso — o valor que se aplica é o desta notificação,
        e não o que estiver corrente um quadro depois.
      */
      comFusaoDeTema(() => {
        apply(state.effectiveTheme);
      });
    });
  }, []);
}
