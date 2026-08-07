/**
 * Rebusca de **uma** linha na revisão (`003/FR-019`).
 *
 * A garantia tem duas metades, e as duas precisam ser verificadas juntas:
 *
 * - **isolamento**: corrigir o texto de uma linha refaz a busca apenas dela; as
 *   demais mantêm candidatas e escolhas intactas. Sem isso, corrigir a última
 *   linha de uma lista de 50 custaria 50 buscas e desfaria toda a revisão já
 *   feita;
 * - **custo honesto**: no provedor com cota, a nova busca debita **exatamente
 *   uma** operação no consumo do dia. O débito é o mesmo caminho de consumo da
 *   002, e é o que impede a rebusca de ser um gasto invisível.
 *
 * O teste roda no nível do runner, sem componente: o que está em jogo é quantas
 * requisições saem e quanto elas custam, não como a tela as dispara.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { parseInput, parseLine } from '@/domain/parser';
import { matchLine, runMatching } from '@/features/input/matchRunner';
import { unitsUsedToday } from '@/services/providers/youtube/quota';

import {
  requestsTo,
  setCatalog,
  setYouTubeCatalog,
  type MockTrack,
  type MockVideo,
} from '../msw/handlers';

import { useFastLimiters, wireBoth } from './support/clients';

const CATALOGO: MockTrack[] = [
  { id: 'imagine', name: 'Imagine', artists: ['John Lennon'], album: 'Imagine', durationMs: 187_000 },
  { id: 'zoio', name: 'Zoio de Lula', artists: ['Charlie Brown Jr'], album: 'Preço Curto', durationMs: 210_000 },
  { id: 'wonder', name: 'Wonderwall', artists: ['Oasis'], album: 'Morning Glory', durationMs: 258_000 },
];

const CATALOGO_VIDEO: MockVideo[] = [
  { id: 'vid_imagine', title: 'Imagine (Official Video)', channel: 'John Lennon - Topic', duration: 'PT3M7S' },
  { id: 'vid_wonder', title: 'Wonderwall (Official Video)', channel: 'Oasis - Topic', duration: 'PT4M18S' },
];

beforeEach(() => {
  wireBoth();
  useFastLimiters();
  setCatalog(CATALOGO);
  setYouTubeCatalog(CATALOGO_VIDEO);
  localStorage.clear();
});

const signal = (): AbortSignal => new AbortController().signal;

describe('FR-019 — a rebusca alcança apenas a linha corrigida', () => {
  const lista = parseInput(['Imagine - John Lennon', 'Wonderwal - Oassis', 'zoio de lula charlie brown jr'].join('\n'));

  it('refazer uma linha emite uma única requisição', async () => {
    const antes = await runMatching('spotify', lista, { signal: signal() });
    expect(antes).toHaveLength(3);

    // Quatro, não três: `Wonderwal - Oassis` não acha nada pela consulta por
    // campos e é elegível a retentativa no Spotify (`003/research §6`). O custo
    // da retentativa é visível de propósito — antes desta feature ele existia e
    // não aparecia em lugar nenhum.
    const daLista = requestsTo('search').length;
    expect(daLista).toBe(4);

    const corrigida = parseLine('Wonderwall - Oasis', 1, lista[1]!.id);
    const refeita = await matchLine('spotify', corrigida, signal());

    // A corrigida acha de primeira: **uma** requisição a mais, e só uma.
    expect(requestsTo('search').length - daLista).toBe(1);
    expect(refeita.status).toBe('confident');
    expect(refeita.candidates[0]?.id).toBe('wonder');
  });

  it('as demais linhas mantêm candidatas e escolhas intactas', async () => {
    const antes = await runMatching('spotify', lista, { signal: signal() });

    const corrigida = parseLine('Wonderwall - Oasis', 1, lista[1]!.id);
    await matchLine('spotify', corrigida, signal());

    // A rebusca devolve **um** item; nada nela toca os outros dois, que
    // continuam sendo os mesmos objetos com as mesmas escolhas.
    expect(antes[0]?.selectedUri).toBe('spotify:track:imagine');
    expect(antes[2]?.selectedUri).toBe('spotify:track:zoio');
    expect(antes[0]?.candidates).toHaveLength(1);
  });

  it('a linha corrigida preserva id e index da fonte única', async () => {
    const original = lista[1]!;
    const corrigida = parseLine('Wonderwall - Oasis', original.index, original.id);
    const refeita = await matchLine('spotify', corrigida, signal());

    expect(refeita.line.id).toBe(original.id);
    expect(refeita.line.index).toBe(original.index);
  });

  /** A correção pode mudar a forma da linha, e a via de pontuação junto. */
  it('corrigir de forma livre para explícita muda a consulta emitida', async () => {
    const livre = parseLine('zoio de lula charlie brown jr', 0, 'l0');
    await matchLine('spotify', livre, signal());
    const consultaLivre = new URL(requestsTo('search')[0]!.url).searchParams.get('q');

    const explicita = parseLine('Zoio de Lula - Charlie Brown Jr', 0, 'l0');
    await matchLine('spotify', explicita, signal());
    const consultaExplicita = new URL(requestsTo('search')[1]!.url).searchParams.get('q');

    expect(consultaLivre).toBe('zoio de lula charlie brown jr');
    expect(consultaExplicita).toBe('track:"Zoio de Lula" artist:"Charlie Brown Jr"');
  });

  it('linha sem conteúdo alfanumérico não gasta requisição na rebusca', async () => {
    const vazia = parseLine('---', 0, 'l0');
    const refeita = await matchLine('spotify', vazia, signal());

    expect(requestsTo('search')).toHaveLength(0);
    expect(refeita.status).toBe('unparsed');
  });
});

describe('FR-019 — no provedor com cota, a rebusca debita exatamente uma busca', () => {
  const lista = parseInput(['Imagine - John Lennon', 'Wonderwal - Oassis'].join('\n'));

  it('o consumo do dia sobe em uma operação de busca, e só uma', async () => {
    await runMatching('youtube', lista, { signal: signal() });
    const depoisDaLista = unitsUsedToday();

    const buscasAntes = requestsTo('ytSearch').length;
    const corrigida = parseLine('Wonderwall - Oasis', 1, lista[1]!.id);
    await matchLine('youtube', corrigida, signal());

    const buscasDepois = requestsTo('ytSearch').length;
    const enriquecimentosExtra = requestsTo('ytVideos').length;

    expect(buscasDepois - buscasAntes).toBe(1);

    // 100 unidades da busca, mais o enriquecimento em lote (1 por chamada). O
    // que não pode acontecer é a rebusca custar duas buscas em silêncio.
    const delta = unitsUsedToday() - depoisDaLista;
    expect(delta).toBeGreaterThanOrEqual(100);
    expect(delta).toBeLessThanOrEqual(100 + enriquecimentosExtra);
  });

  it('o consumo é registrado de forma síncrona, sem depender da tela', async () => {
    expect(unitsUsedToday()).toBe(0);

    await matchLine('youtube', parseLine('Imagine - John Lennon', 0, 'l0'), signal());

    expect(unitsUsedToday()).toBeGreaterThanOrEqual(100);
  });
});
