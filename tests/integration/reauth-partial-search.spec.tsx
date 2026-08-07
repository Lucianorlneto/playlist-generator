/**
 * V3, V4, V5, V6 — preservação parcial e retomada (`004/Q1`, FR-013a a FR-013e,
 * SC-008, SC-009).
 *
 * A pergunta que estes casos respondem: quando a sessão cai no meio da busca, o
 * que já foi resolvido **sobrevive**, e a retomada paga apenas pelo que falta.
 *
 * O contrário — refazer a lista inteira — era o pedido literal do usuário e foi
 * recusado por escrito (Q1 da spec), pelo custo em cota: em uma lista de 100
 * linhas no catálogo de vídeo, rebuscar tudo custaria 10.000 unidades, o
 * orçamento diário inteiro, para recuperar informação que já estava em mãos.
 */

import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { YOUTUBE_QUOTA } from '@/domain/providers';
import { remainingLineIds } from '@/domain/run/lines';
import { ServiceStep } from '@/features/service/ServiceStep';
import { unitsUsedToday } from '@/services/providers/youtube/quota';
import { clearConsumption } from '@/services/storage/quotaRepo';
import { useAppStore } from '@/store';

import {
  makeCredentials,
  makeLine,
  makePartialSearchItems,
  makeQueue,
  makeRun,
  makeSession,
  makeSessions,
} from '../fixtures/factories';
import { alwaysUnauthorized, requestsTo, setYouTubeCatalog } from '../msw/handlers';
import { countRequestsFrom, useFastLimiters, wireYouTube } from './support/clients';

const CLIENT_ID = '123-abc.apps.googleusercontent.com';
const TOTAL = 6;

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

/** Catálogo que casa com todas as linhas — a retomada precisa encontrar. */
function catalogoCompleto(lines: ReturnType<typeof linhas>) {
  setYouTubeCatalog(
    lines.map((linha, index) => ({
      id: `v${index}`,
      title: linha.title,
      channel: linha.artist,
      duration: 'PT3M30S',
    })),
  );
}

/** Execução parada, com `resolvidas` linhas já buscadas antes da queda. */
function semearInterrompida(resolvidas: number, total = TOTAL) {
  const lines = linhas(total);
  useAppStore.setState({
    step: 'service',
    lines,
    rawText: lines.map((linha) => linha.raw).join('\n'),
    credentials: makeCredentials({ youtube: CLIENT_ID }),
    // Parada **sem** sessão: é o único jeito de chegar a `awaiting_reauth`.
    sessions: makeSessions({}),
    destinations: { selected: ['youtube'], locked: false },
    playlistConfig: { name: 'Lista', description: '', isPublic: false },
    queue: makeQueue(['youtube'], {
      currentIndex: 0,
      runs: {
        youtube: makeRun('youtube', {
          phase: 'awaiting_reauth',
          resumeFrom: 'search',
          lineIds: lines.map((linha) => linha.id),
          items: makePartialSearchItems(lines, resolvidas),
        }),
      },
    }),
  });
  return lines;
}

function runYouTube() {
  return useAppStore.getState().runFor('youtube');
}

/**
 * Reconecta e deixa o efeito da retomada assentar.
 *
 * Repor a sessão é tudo o que a volta do consentimento faz; quem a transforma em
 * retomada é a etapa.
 */
async function reconectarEAssentar(): Promise<void> {
  act(() => {
    useAppStore.setState({ sessions: makeSessions({ youtube: makeSession('youtube') }) });
  });
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
}

beforeEach(() => {
  useFastLimiters();
  wireYouTube();
  clearConsumption('youtube');
});

describe('V3/FR-013a — o que foi resolvido antes da queda sobrevive', () => {
  it('as N linhas resolvidas permanecem, e as demais ficam pendentes', () => {
    const RESOLVIDAS = 2;
    semearInterrompida(RESOLVIDAS);

    const run = runYouTube();
    const resolvidos = run?.items.filter((item) => item.status !== 'pending') ?? [];

    expect(resolvidos).toHaveLength(RESOLVIDAS);
    // A distinção que sustenta tudo: pendente é "não busquei", não "não achei".
    expect(run?.items.filter((item) => item.status === 'not_found')).toHaveLength(0);
    expect(remainingLineIds(run!)).toEqual(['l2', 'l3', 'l4', 'l5']);
  });
});

describe('V4/V5 — a retomada busca apenas o que falta (FR-013b, T3)', () => {
  it('emite requisição só para as linhas pendentes', async () => {
    const RESOLVIDAS = 2;
    const lines = semearInterrompida(RESOLVIDAS);
    catalogoCompleto(lines);

    render(<ServiceStep />);
    const emitidas = countRequestsFrom('youtube');
    await reconectarEAssentar();

    // Quatro linhas restantes → quatro buscas, mais o enriquecimento em lote.
    expect(requestsTo('ytSearch')).toHaveLength(TOTAL - RESOLVIDAS);
    expect(emitidas()).toBeGreaterThan(0);
  });

  it('o resultado final cobre a lista inteira, sem perder nem duplicar linha', async () => {
    const lines = semearInterrompida(2);
    catalogoCompleto(lines);

    render(<ServiceStep />);
    await reconectarEAssentar();

    const run = runYouTube();
    expect(run?.phase).toBe('review');
    expect(run?.items).toHaveLength(TOTAL);
    // FR-013d: a ordem é a de `lineIds`, não a de chegada das respostas.
    expect(run?.items.map((item) => item.line.id)).toEqual(lines.map((linha) => linha.id));
    expect(remainingLineIds(run!)).toEqual([]);
  });
});

describe('V6/FR-013c/SC-008 — o consumo total não passa o da execução ininterrupta', () => {
  it('interrompida + retomada custa o mesmo que buscar a lista uma vez', async () => {
    const RESOLVIDAS = 2;
    const lines = semearInterrompida(RESOLVIDAS);
    catalogoCompleto(lines);

    // As buscas já pagas antes da queda não são refeitas; a queda em si não
    // cobrou nada (Q1). O que resta é exatamente o que falta.
    render(<ServiceStep />);
    await reconectarEAssentar();

    const buscasDaRetomada = requestsTo('ytSearch').length;
    expect(buscasDaRetomada).toBe(TOTAL - RESOLVIDAS);
    // Somado às RESOLVIDAS já pagas antes, dá TOTAL — nunca mais que isso.
    expect(buscasDaRetomada + RESOLVIDAS).toBe(TOTAL);
    expect(unitsUsedToday()).toBeGreaterThan(0);
  });
});

describe('Casos de borda de Q1', () => {
  it('zero linhas resolvidas degrada para a lista inteira', async () => {
    const lines = semearInterrompida(0);
    catalogoCompleto(lines);

    expect(remainingLineIds(runYouTube()!)).toHaveLength(TOTAL);

    render(<ServiceStep />);
    await reconectarEAssentar();

    expect(requestsTo('ytSearch')).toHaveLength(TOTAL);
    expect(runYouTube()?.items).toHaveLength(TOTAL);
  });

  it('todas resolvidas: a retomada não consome cota nem emite requisição', async () => {
    const lines = semearInterrompida(TOTAL);
    catalogoCompleto(lines);

    expect(remainingLineIds(runYouTube()!)).toEqual([]);

    render(<ServiceStep />);
    await reconectarEAssentar();

    // Nenhuma **busca** e nenhum enriquecimento: é o que "não consome cota na
    // retomada" quer dizer. A execução avança direto para a revisão, e a
    // checagem de nome de playlist que acontece lá é trabalho da revisão, não
    // da retomada — ela roda em toda entrada naquela fase (FR-022).
    expect(requestsTo('ytSearch')).toHaveLength(0);
    expect(requestsTo('ytVideos')).toHaveLength(0);
    expect(unitsUsedToday()).toBeLessThanOrEqual(YOUTUBE_QUOTA.costs.listPlaylists);
    expect(runYouTube()?.phase).toBe('review');
    expect(runYouTube()?.items).toHaveLength(TOTAL);
  });
});

describe('FR-013e — a busca sem interrupção fica literalmente inalterada', () => {
  it('uma execução que nunca caiu busca a lista inteira', async () => {
    const lines = linhas();
    catalogoCompleto(lines);
    useAppStore.setState({
      step: 'service',
      lines,
      credentials: makeCredentials({ youtube: CLIENT_ID }),
      sessions: makeSessions({ youtube: makeSession('youtube') }),
      destinations: { selected: ['youtube'], locked: false },
      queue: makeQueue(['youtube'], {
        currentIndex: 0,
        runs: {
          youtube: makeRun('youtube', {
            phase: 'search',
            lineIds: lines.map((linha) => linha.id),
          }),
        },
      }),
    });

    render(<ServiceStep />);
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    for (let i = 0; i < 10; i += 1) await Promise.resolve();

    expect(requestsTo('ytSearch')).toHaveLength(TOTAL);
    expect(runYouTube()?.phase).toBe('review');
    expect(runYouTube()?.items).toHaveLength(TOTAL);
  });
});

describe('A retomada sem sessão não dispara sozinha (R4)', () => {
  it('sem sessão, a execução continua parada e nada é emitido', async () => {
    const lines = semearInterrompida(2);
    catalogoCompleto(lines);
    alwaysUnauthorized('ytSearch');

    const emitidas = countRequestsFrom('youtube');
    render(<ServiceStep />);
    for (let i = 0; i < 10; i += 1) await Promise.resolve();

    expect(emitidas()).toBe(0);
    expect(runYouTube()?.phase).toBe('awaiting_reauth');
  });
});
