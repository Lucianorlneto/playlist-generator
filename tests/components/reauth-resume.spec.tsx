/**
 * V19 — a retomada **sem recarregar a página** (`004/T2` a `T5`, FR-013b,
 * FR-014, FR-032).
 *
 * Este é o único arquivo que pega a armadilha de `startedFor`. A guarda de
 * efeito de `ServiceStep` existe para o StrictMode não disparar a busca duas
 * vezes e dobrar o custo em cota; ela é indexada por `provider:fase`. Se o ramo
 * novo `awaiting_reauth` **não** atribuir a chave, ela permanece
 * `youtube:search` — e a volta a `search` não reinicia a busca, sem erro algum
 * na tela. FR-014 quebraria em silêncio.
 *
 * Na navegação real o `ref` zera junto com o documento, e o defeito ficaria
 * escondido até alguém mudar o fluxo. Por isso estes casos reconectam **na mesma
 * montagem**, sem remontar nada.
 */

import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ServiceStep } from '@/features/service/ServiceStep';
import { useAppStore } from '@/store';

import {
  makeCreation,
  makeCredentials,
  makeItem,
  makeLine,
  makePartialSearchItems,
  makeQueue,
  makeRun,
  makeSession,
  makeSessions,
  makeVideoCandidate,
} from '../fixtures/factories';
import { requestsTo, seedCreatedYouTubePlaylist, setYouTubeCatalog } from '../msw/handlers';
import { useFastLimiters, wireYouTube } from '../integration/support/clients';

const CLIENT_ID = '123-abc.apps.googleusercontent.com';
const TOTAL = 4;

function linhas(total = TOTAL) {
  return Array.from({ length: total }, (_, index) =>
    makeLine({
      id: `l${index}`,
      index,
      raw: `Faixa ${index} - Artista ${index}`,
      title: `Faixa ${index}`,
      artist: `Artista ${index}`,
    }),
  );
}

function catalogo(lines: ReturnType<typeof linhas>) {
  setYouTubeCatalog(
    lines.map((linha, index) => ({
      id: `v${index}`,
      title: linha.title,
      channel: linha.artist,
      duration: 'PT3M30S',
    })),
  );
}

function semear(resumeFrom: 'search' | 'creating', resolvidas = 2) {
  const lines = linhas();
  useAppStore.setState({
    step: 'service',
    lines,
    credentials: makeCredentials({ youtube: CLIENT_ID }),
    // Parada **sem** sessão: é o único jeito de chegar a `awaiting_reauth`.
    sessions: makeSessions({}),
    destinations: { selected: ['youtube'], locked: false },
    playlistConfig: { name: 'Lista', description: '', isPublic: false },
    existingNames: [],
    creating: false,
    creationError: null,
    queue: makeQueue(['youtube'], {
      currentIndex: 0,
      runs: {
        youtube: makeRun('youtube', {
          phase: 'awaiting_reauth',
          resumeFrom,
          lineIds: lines.map((linha) => linha.id),
          items:
            resumeFrom === 'search'
              ? makePartialSearchItems(lines, resolvidas)
              : lines.map((linha, index) =>
                  makeItem({
                    line: linha,
                    candidates: [makeVideoCandidate({ id: `v${index}` })],
                    selectedUri: `v${index}`,
                    included: true,
                  }),
                ),
          ...(resumeFrom === 'creating'
            ? {
                creation: makeCreation({
                  playlistId: 'PL_teste_1',
                  playlistUrl: 'https://www.youtube.com/playlist?list=PL_teste_1',
                  orderedUris: lines.map((_, index) => `v${index}`),
                  batchSize: 1,
                  committedItems: 1,
                  failedAt: 1,
                }),
              }
            : {}),
        }),
      },
    }),
  });
  return lines;
}

function run() {
  return useAppStore.getState().runFor('youtube');
}

/**
 * Reconecta **sem remontar** e deixa o efeito assentar.
 *
 * Repor a sessão é literalmente tudo o que a volta do consentimento faz — o
 * `bootstrap` chama `setSession` e nada mais. Quem transforma isso em retomada é
 * a etapa, e é justamente esse elo que estes casos verificam.
 */
async function reconectar(): Promise<void> {
  act(() => {
    useAppStore.setState({ sessions: makeSessions({ youtube: makeSession('youtube') }) });
  });
  for (let i = 0; i < 12; i += 1) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  for (let i = 0; i < 12; i += 1) await Promise.resolve();
}

beforeEach(() => {
  useFastLimiters();
  wireYouTube();
});

describe('V19/T2 — reconectar sem recarregar reinicia a busca', () => {
  it('a busca de fato recomeça na mesma montagem', async () => {
    const lines = semear('search');
    catalogo(lines);

    render(<ServiceStep />);
    // Nada é emitido enquanto a execução está parada.
    expect(requestsTo('ytSearch')).toHaveLength(0);

    await reconectar();

    // Se `startedFor` não fosse atribuído no ramo `awaiting_reauth`, este
    // número seria zero e nenhum erro apareceria em lugar nenhum.
    expect(requestsTo('ytSearch').length).toBeGreaterThan(0);
    expect(run()?.phase).toBe('review');
  });

  it('T3/FR-013b — busca **só** o que falta', async () => {
    const RESOLVIDAS = 2;
    const lines = semear('search', RESOLVIDAS);
    catalogo(lines);

    render(<ServiceStep />);
    await reconectar();

    expect(requestsTo('ytSearch')).toHaveLength(TOTAL - RESOLVIDAS);
  });

  it('T5 — a tela de estimativa não é reexibida', async () => {
    const lines = semear('search');
    catalogo(lines);

    render(<ServiceStep />);
    await reconectar();

    // O custo já foi dito no diálogo, sobre o que falta. Reexibir a estimativa
    // mostraria o número da lista **inteira** e contradiria FR-013 no primeiro
    // clique.
    expect(run()?.phase).not.toBe('estimate');
    expect(run()?.phase).toBe('review');
  });

  it('a execução em espera não dispara busca sozinha', async () => {
    const lines = semear('search');
    catalogo(lines);

    render(<ServiceStep />);
    for (let i = 0; i < 12; i += 1) await Promise.resolve();

    expect(requestsTo('ytSearch')).toHaveLength(0);
    expect(run()?.phase).toBe('awaiting_reauth');
  });
});

describe('V19/T4 — voltar para a criação retoma pelo lote seguinte', () => {
  it('chama a retomada e não cria uma segunda playlist (FR-029, FR-030)', async () => {
    const lines = semear('creating');
    catalogo(lines);
    // A playlist parcial já existe na conta: é justamente o que FR-030 proíbe
    // remover, recriar ou renomear.
    seedCreatedYouTubePlaylist('PL_teste_1', 'Lista', ['v0']);

    render(<ServiceStep />);
    await reconectar();

    // Nenhuma playlist nova: a retomada parte do `playlistId` já gravado.
    expect(requestsTo('ytCreatePlaylist')).toHaveLength(0);
    // Um item já estava confirmado; só os restantes são enviados.
    expect(requestsTo('ytPlaylistItems')).toHaveLength(TOTAL - 1);
  });

  it('FR-032 — nenhuma nova confirmação de revisão é exigida', async () => {
    const lines = semear('creating');
    catalogo(lines);
    seedCreatedYouTubePlaylist('PL_teste_1', 'Lista', ['v0']);

    const dispatchRun = vi.spyOn(useAppStore.getState(), 'dispatchRun');
    render(<ServiceStep />);
    await reconectar();

    // A escrita retomada é **a mesma** que o usuário já autorizou: mesma conta,
    // mesma playlist, mesmas faixas, mesma execução. Repedir a confirmação
    // treinaria o usuário a clicar sem ler, que é o oposto do que o Princípio V
    // protege.
    const eventos = dispatchRun.mock.calls.map(([evento]) => evento.type);
    expect(eventos).not.toContain('review_confirmed');
    expect(run()?.phase).not.toBe('review');
  });
});
