/**
 * FR-019 e Princípio V — **nada é escrito sem confirmação da revisão daquele
 * serviço**.
 *
 * A garantia tem duas camadas, e este arquivo cobre a segunda. A primeira é o
 * redutor puro (`tests/unit/run-machine.spec.ts`), que torna a fase `creating`
 * inalcançável sem `review_confirmed`. Aqui a verificação é na fronteira de
 * rede: se qualquer endpoint de escrita dos dois provedores for tocado antes da
 * confirmação, o teste falha — mesmo que alguém contorne o redutor chamando o
 * runner direto.
 *
 * O caso que mais importa é o de dois destinos: confirmar a revisão do primeiro
 * serviço **não** pode liberar escrita no segundo.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import type { ProviderId } from '@/domain/providers';
import { startCreation } from '@/features/result/creationRunner';
import { configureProviderClient } from '@/services/providers/http';
import { createRefresher } from '@/services/providers/spotify/auth';
import { classifyYouTubeError } from '@/services/providers/youtube/errors';
import { recordConsumption } from '@/services/providers/youtube/quota';
import { useAppStore } from '@/store';

import {
  makeCandidate,
  makeItem,
  makeLine,
  makeQueue,
  makeRun,
  makeSession,
  makeSessions,
} from '../fixtures/factories';
import { makeVideoCandidate } from '../fixtures/factories';
import { requestLog } from '../msw/handlers';

const CLIENT_ID = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';

/** Os quatro endpoints de escrita dos dois provedores. */
const WRITE_ENDPOINTS = [
  'createPlaylist',
  'addTracks',
  'ytCreatePlaylist',
  'ytPlaylistItems',
] as const;

function writeRequests() {
  return requestLog.filter((entry) =>
    (WRITE_ENDPOINTS as readonly string[]).includes(entry.endpoint),
  );
}

const linhas = [
  makeLine({ id: 'l0', index: 0, raw: 'Bohemian Rhapsody - Queen' }),
  makeLine({ id: 'l1', index: 1, raw: 'Imagine - John Lennon' }),
];

function itemsFor(provider: ProviderId) {
  return linhas.map((line, index) =>
    makeItem({
      line,
      candidates: [
        provider === 'spotify'
          ? makeCandidate({ id: `t${index}` })
          : makeVideoCandidate({ id: `v${index}` }),
      ],
      selectedUri: provider === 'spotify' ? `spotify:track:t${index}` : `v${index}`,
      included: true,
    }),
  );
}

beforeEach(() => {
  configureProviderClient('spotify', {
    getSession: () => useAppStore.getState().sessions.spotify,
    saveSession: () => undefined,
    clearSession: () => undefined,
    refresh: createRefresher(() => CLIENT_ID),
  });
  configureProviderClient('youtube', {
    getSession: () => useAppStore.getState().sessions.youtube,
    saveSession: () => undefined,
    clearSession: () => undefined,
    recordConsumption,
    classifyError: classifyYouTubeError,
  });

  useAppStore.setState({
    sessions: makeSessions({
      spotify: makeSession('spotify'),
      youtube: makeSession('youtube'),
    }),
    lines: linhas,
    playlistConfig: { name: 'Sem escrita antecipada', description: '', isPublic: false },
    existingNames: [],
    creating: false,
    creationError: null,
  });
});

/** Instala a fila com uma fase escolhida para cada provedor. */
function seedQueue(
  order: ProviderId[],
  phases: Partial<Record<ProviderId, Parameters<typeof makeRun>[1]>>,
  currentIndex = 0,
) {
  const runs: Partial<Record<ProviderId, ReturnType<typeof makeRun>>> = {};
  for (const provider of order) {
    runs[provider] = makeRun(provider, {
      lineIds: linhas.map((line) => line.id),
      items: itemsFor(provider),
      ...phases[provider],
    });
  }

  useAppStore.setState({
    destinations: { selected: order, locked: false },
    queue: makeQueue(order, { currentIndex, runs }),
  });
}

describe('FR-019 — nenhuma escrita sem confirmação da revisão daquele serviço', () => {
  it.each(['spotify', 'youtube'] as const)(
    'não escreve nada em %s enquanto a revisão não é confirmada',
    async (provider) => {
      seedQueue([provider], { [provider]: { phase: 'review' } });

      await startCreation();

      expect(writeRequests()).toEqual([]);
      expect(useAppStore.getState().runFor(provider)?.creation).toBeNull();
      expect(useAppStore.getState().runFor(provider)?.result).toBeNull();
    },
  );

  it.each(['connect', 'estimate', 'search'] as const)(
    'não escreve nada na fase %s, anterior à revisão',
    async (phase) => {
      seedQueue(['youtube'], { youtube: { phase } });

      await startCreation();

      expect(writeRequests()).toEqual([]);
    },
  );

  it('confirmar a revisão do primeiro serviço não libera escrita no segundo', async () => {
    // Spotify confirmado e em criação; YouTube ainda em revisão.
    seedQueue(['spotify', 'youtube'], {
      spotify: { phase: 'creating' },
      youtube: { phase: 'review' },
    });

    await startCreation();

    const escritas = writeRequests();
    // O Spotify escreveu, porque a revisão dele foi confirmada…
    expect(escritas.length).toBeGreaterThan(0);
    // …e nenhuma escrita saiu para o YouTube, cuja revisão continua pendente.
    expect(
      escritas.filter((entry) => entry.endpoint.startsWith('yt')),
    ).toEqual([]);
    expect(useAppStore.getState().runFor('youtube')?.creation).toBeNull();
  });

  it('a fase creating é inalcançável sem o evento review_confirmed', () => {
    seedQueue(['youtube'], { youtube: { phase: 'review' } });

    // Todo evento que não seja `review_confirmed` deixa a execução fora de
    // `creating` — é o redutor, não a tela, que sustenta o invariante.
    for (const event of [
      { type: 'authorized' },
      { type: 'estimate_ok' },
      { type: 'search_done', items: itemsFor('youtube') },
    ] as const) {
      useAppStore.getState().dispatchRun(event, 'youtube');
      expect(useAppStore.getState().runFor('youtube')?.phase).not.toBe('creating');
    }

    useAppStore.getState().dispatchRun({ type: 'review_confirmed' }, 'youtube');
    expect(useAppStore.getState().runFor('youtube')?.phase).toBe('creating');
  });

  it('uma execução já encerrada não volta a escrever (invariante R2)', async () => {
    seedQueue(['spotify'], { spotify: { phase: 'skipped', outcome: 'skipped' } });

    await startCreation();

    expect(writeRequests()).toEqual([]);
  });
});
