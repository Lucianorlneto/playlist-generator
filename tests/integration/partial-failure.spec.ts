import { beforeEach, describe, expect, it } from 'vitest';

import { retryRemaining, startCreation } from '@/features/result/creationRunner';
import { createRefresher } from '@/services/spotify/auth';
import { configureSpotifyClient } from '@/services/spotify/client';
import { loadDraft } from '@/services/storage/draftRepo';
import { useAppStore } from '@/store';
import { attachDraftPersistence } from '@/store/draftPersistence';

import { makeCandidate, makeItem, makeLine, makeSession } from '../fixtures/factories';
import { createdPlaylist, PASS_THROUGH, program, requestLog } from '../msw/handlers';

const CLIENT_ID = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';

/** 250 faixas = 3 lotes (100 + 100 + 50). */
const TOTAL = 250;

/** Erro não recuperável: falha na hora, sem backoff, mantendo o teste rápido. */
const naoRecuperavel = {
  status: 400,
  body: { error: { status: 400, message: 'Bad request' } },
};

function seedStore() {
  const items = Array.from({ length: TOTAL }, (_, index) =>
    makeItem({
      line: makeLine({ id: `l${index}`, index, raw: `Faixa ${index} - Artista` }),
      candidates: [makeCandidate({ id: `t${index}` })],
      selectedUri: `spotify:track:t${index}`,
      included: true,
    }),
  );

  useAppStore.setState({
    session: makeSession(),
    items,
    playlistConfig: { name: 'Retomada', description: '', isPublic: false },
    existingNames: [],
  });

  return items.map((item) => item.selectedUri as string);
}

function requests(endpoint: 'createPlaylist' | 'addTracks') {
  return requestLog.filter((entry) => entry.endpoint === endpoint);
}

beforeEach(() => {
  configureSpotifyClient({
    getSession: () => useAppStore.getState().session,
    saveSession: (session) => useAppStore.setState({ session }),
    clearSession: () => useAppStore.setState({ session: null }),
    refresh: createRefresher(() => CLIENT_ID),
  });
});

describe('SC-009 — falha no meio da adição e retomada', () => {
  it('a retomada completa a playlist sem duplicar nem faltar faixa', async () => {
    const uris = seedStore();
    // O primeiro lote passa; o segundo falha.
    program('addTracks', PASS_THROUGH, naoRecuperavel);

    await startCreation();

    const parcial = useAppStore.getState();
    expect(parcial.creation).not.toBeNull();
    expect(parcial.creation?.committedBatches).toBe(1);
    expect(parcial.creation?.failedAt).toBe(1);
    expect(parcial.creationError).not.toBeNull();
    expect(parcial.result).toBeNull();

    const playlistId = parcial.creation?.playlistId as string;
    expect(createdPlaylist(playlistId)?.uris).toEqual(uris.slice(0, 100));

    await retryRemaining();

    const final = useAppStore.getState();
    expect(final.result).not.toBeNull();
    expect(final.result?.addedCount).toBe(TOTAL);
    expect(final.creationError).toBeNull();

    const enviadas = createdPlaylist(playlistId)?.uris ?? [];
    // Sem faltantes, sem duplicatas, na ordem original.
    expect(enviadas).toEqual(uris);
    expect(new Set(enviadas).size).toBe(TOTAL);
  });

  it('a retomada não cria uma segunda playlist', async () => {
    seedStore();
    program('addTracks', PASS_THROUGH, naoRecuperavel);

    await startCreation();
    const playlistId = useAppStore.getState().creation?.playlistId;
    await retryRemaining();

    expect(requests('createPlaylist')).toHaveLength(1);
    expect(useAppStore.getState().result?.playlistId).toBe(playlistId);
  });

  it('nenhum lote confirmado é reenviado', async () => {
    seedStore();
    program('addTracks', PASS_THROUGH, naoRecuperavel);

    await startCreation();
    const antes = requests('addTracks').length;
    await retryRemaining();

    // 1 sucesso + 1 falha antes; 2 lotes restantes depois. Nunca 4 sucessos.
    expect(antes).toBe(2);
    expect(requests('addTracks')).toHaveLength(4);
  });

  it('grava committedBatches no rascunho de forma síncrona, sem debounce', async () => {
    seedStore();
    const detach = attachDraftPersistence();
    program('addTracks', PASS_THROUGH, naoRecuperavel);

    await startCreation();

    // Sem esperar os 500 ms do debounce: o lote confirmado já está no disco.
    const draft = loadDraft();
    expect(draft?.creation?.committedBatches).toBe(1);
    expect(draft?.creation?.playlistId).toBe(useAppStore.getState().creation?.playlistId);
    detach();
  });

  it('a criação bem-sucedida apaga o rascunho (FR-045)', async () => {
    seedStore();
    const detach = attachDraftPersistence();

    await startCreation();

    expect(useAppStore.getState().result).not.toBeNull();
    expect(loadDraft()).toBeNull();
    detach();
  });

  it('falha ao criar a playlist não deixa criação pendente', async () => {
    seedStore();
    program('createPlaylist', naoRecuperavel);

    await startCreation();

    const state = useAppStore.getState();
    expect(state.creationError).not.toBeNull();
    expect(state.creation).toBeNull();
    expect(state.result).toBeNull();
    expect(requests('addTracks')).toHaveLength(0);
  });
});
