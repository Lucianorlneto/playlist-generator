/**
 * Retomada após falha parcial, no serviço corrente (FR-033, SC-010).
 *
 * O invariante que estes testes protegem sobreviveu à generalização multi-provedor:
 * `committedItems` só avança após resposta de sucesso e é gravado de forma
 * síncrona, de modo que a retomada não duplica nem omite item — agora com
 * `batchSize` vindo do provedor (100 no Spotify, 1 no YouTube).
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { retryRemaining, startCreation } from '@/features/result/creationRunner';
import { configureProviderClient } from '@/services/providers/http';
import { createRefresher } from '@/services/providers/spotify/auth';
import { loadDraft } from '@/services/storage/draftRepo';
import { useAppStore } from '@/store';
import { attachDraftPersistence } from '@/store/draftPersistence';

import {
  makeCandidate,
  makeItem,
  makeLine,
  makeQueue,
  makeRun,
  makeSessions,
  makeSession,
} from '../fixtures/factories';
import { createdPlaylist, PASS_THROUGH, program, requestLog } from '../msw/handlers';

const CLIENT_ID = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';

/** 250 faixas = 3 lotes de 100 no Spotify (100 + 100 + 50). */
const TOTAL = 250;

/** Erro não recuperável: falha na hora, sem backoff, mantendo o teste rápido. */
const naoRecuperavel = {
  status: 400,
  body: { error: { status: 400, message: 'Bad request' } },
};

/**
 * Monta a fila com o Spotify já em `creating` — a fase que `startCreation`
 * exige. Chegar aqui por evento é o que os testes de `run-machine` cobrem; aqui
 * o alvo é o envio em lotes.
 */
function seedStore() {
  const lines = Array.from({ length: TOTAL }, (_, index) =>
    makeLine({ id: `l${index}`, index, raw: `Faixa ${index} - Artista` }),
  );
  const items = lines.map((line, index) =>
    makeItem({
      line,
      candidates: [makeCandidate({ id: `t${index}` })],
      selectedUri: `spotify:track:t${index}`,
      included: true,
    }),
  );

  useAppStore.setState({
    sessions: makeSessions({ spotify: makeSession('spotify') }),
    lines,
    destinations: { selected: ['spotify'], locked: false },
    queue: makeQueue(['spotify'], {
      currentIndex: 0,
      runs: {
        spotify: makeRun('spotify', {
          phase: 'creating',
          lineIds: lines.map((line) => line.id),
          items,
        }),
      },
    }),
    playlistConfig: { name: 'Retomada', description: '', isPublic: false },
    existingNames: [],
    creating: false,
    creationError: null,
  });

  return items.map((item) => item.selectedUri as string);
}

function requests(endpoint: 'createPlaylist' | 'addTracks') {
  return requestLog.filter((entry) => entry.endpoint === endpoint);
}

function spotifyRun() {
  return useAppStore.getState().runFor('spotify');
}

beforeEach(() => {
  configureProviderClient('spotify', {
    getSession: () => useAppStore.getState().sessions.spotify,
    saveSession: (session) =>
      useAppStore.setState((state) => ({ sessions: { ...state.sessions, spotify: session } })),
    clearSession: () =>
      useAppStore.setState((state) => ({ sessions: { ...state.sessions, spotify: null } })),
    refresh: createRefresher(() => CLIENT_ID),
  });
});

describe('SC-010 — falha no meio da adição e retomada', () => {
  it('a retomada completa a playlist sem duplicar nem faltar faixa', async () => {
    const uris = seedStore();
    // O primeiro lote passa; o segundo falha.
    program('addTracks', PASS_THROUGH, naoRecuperavel);

    await startCreation();

    const parcial = spotifyRun();
    expect(parcial?.creation).not.toBeNull();
    expect(parcial?.creation?.committedItems).toBe(100);
    expect(parcial?.creation?.failedAt).toBe(100);
    expect(useAppStore.getState().creationError).not.toBeNull();
    expect(parcial?.result).toBeNull();

    const playlistId = parcial?.creation?.playlistId as string;
    expect(createdPlaylist(playlistId)?.uris).toEqual(uris.slice(0, 100));

    await retryRemaining();

    const final = spotifyRun();
    expect(final?.result).not.toBeNull();
    expect(final?.result?.addedCount).toBe(TOTAL);
    expect(useAppStore.getState().creationError).toBeNull();

    const enviadas = createdPlaylist(playlistId)?.uris ?? [];
    // Sem faltantes, sem duplicatas, na ordem original.
    expect(enviadas).toEqual(uris);
    expect(new Set(enviadas).size).toBe(TOTAL);
  });

  it('a retomada não cria uma segunda playlist', async () => {
    seedStore();
    program('addTracks', PASS_THROUGH, naoRecuperavel);

    await startCreation();
    const playlistId = spotifyRun()?.creation?.playlistId;
    await retryRemaining();

    expect(requests('createPlaylist')).toHaveLength(1);
    expect(spotifyRun()?.result?.playlistId).toBe(playlistId);
  });

  it('nenhum item confirmado é reenviado', async () => {
    seedStore();
    program('addTracks', PASS_THROUGH, naoRecuperavel);

    await startCreation();
    const antes = requests('addTracks').length;
    await retryRemaining();

    // 1 sucesso + 1 falha antes; 2 lotes restantes depois. Nunca 4 sucessos.
    expect(antes).toBe(2);
    expect(requests('addTracks')).toHaveLength(4);
  });

  it('grava committedItems no rascunho de forma síncrona, sem debounce', async () => {
    seedStore();
    const detach = attachDraftPersistence();
    program('addTracks', PASS_THROUGH, naoRecuperavel);

    await startCreation();

    // Sem esperar os 500 ms do debounce: o lote confirmado já está no disco.
    const draft = loadDraft();
    expect(draft?.queue.runs.spotify?.creation?.committedItems).toBe(100);
    expect(draft?.queue.runs.spotify?.creation?.playlistId).toBe(
      spotifyRun()?.creation?.playlistId,
    );
    detach();
  });

  it('a criação bem-sucedida de todos os serviços apaga o rascunho (Princípio V)', async () => {
    seedStore();
    const detach = attachDraftPersistence();

    await startCreation();

    expect(spotifyRun()?.result).not.toBeNull();
    expect(spotifyRun()?.outcome).toBe('completed');
    expect(loadDraft()).toBeNull();
    detach();
  });

  it('falha ao criar a playlist não deixa criação pendente', async () => {
    seedStore();
    program('createPlaylist', naoRecuperavel);

    await startCreation();

    expect(useAppStore.getState().creationError).not.toBeNull();
    expect(spotifyRun()?.creation).toBeNull();
    expect(spotifyRun()?.result).toBeNull();
    expect(requests('addTracks')).toHaveLength(0);
  });
});
