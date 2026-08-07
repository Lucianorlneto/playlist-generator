/**
 * A segunda tentativa de busca, orquestrada pelo runner (`003/FR-009`,
 * research §6, `contracts/search-queries.md §3`).
 *
 * A garantia central é de **contagem**: exatamente uma retentativa, nunca duas,
 * e só quando as três condições valem juntas — a linha é elegível, a primeira
 * não trouxe candidata acima do piso, e há orçamento.
 *
 * O gatilho tem duas formas que contam igualmente, e é por isso que a alavanca
 * `programBelowFloor` existe: zero resultados **e** resultados todos abaixo do
 * piso são o mesmo caso. Testar só o primeiro deixaria metade da regra sem
 * verificação.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { parseLine } from '@/domain/parser';
import { runMatching } from '@/features/input/matchRunner';

import {
  programBelowFloor,
  requestsTo,
  setCatalog,
  setYouTubeCatalog,
  type MockTrack,
} from '../msw/handlers';

import { useFastLimiters, wireBoth } from './support/clients';

const CATALOGO: MockTrack[] = [
  { id: 'zoio', name: 'Zoio de Lula', artists: ['Charlie Brown Jr'], album: 'Preço Curto', durationMs: 210_000 },
];

beforeEach(() => {
  wireBoth();
  useFastLimiters();
  setCatalog(CATALOGO);
  setYouTubeCatalog([]);
});

const signal = (): AbortSignal => new AbortController().signal;

const linha = (raw: string) => [parseLine(raw, 0, 'l0')];

describe('Spotify — a consulta por campos sem resultado dispara UMA retentativa', () => {
  it('zero resultados dispara exatamente uma segunda consulta, em texto livre', async () => {
    setCatalog([]);

    await runMatching('spotify', linha('Faixa Inexistente - Ninguém'), { signal: signal() });

    const buscas = requestsTo('search');
    expect(buscas).toHaveLength(2);

    const primeira = new URL(buscas[0]!.url).searchParams.get('q');
    const segunda = new URL(buscas[1]!.url).searchParams.get('q');

    expect(primeira).toBe('track:"Faixa Inexistente" artist:"Ninguém"');
    expect(segunda).toBe('Faixa Inexistente - Ninguém');
  });

  /**
   * O caso que "zero resultados" não exercita: a busca **acha** coisas, todas
   * irrelevantes. O gatilho de FR-009 é "nenhuma candidata utilizável".
   */
  it('candidatas todas abaixo do piso também disparam a retentativa', async () => {
    programBelowFloor('search', 1);

    await runMatching('spotify', linha('Zoio de Lula - Charlie Brown Jr'), { signal: signal() });

    expect(requestsTo('search')).toHaveLength(2);
  });

  it('nunca uma segunda retentativa, mesmo quando a alternativa também falha', async () => {
    programBelowFloor('search', 5);

    await runMatching('spotify', linha('Zoio de Lula - Charlie Brown Jr'), { signal: signal() });

    // Duas requisições e ponto final. Não há terceira tentativa em nenhuma
    // circunstância (`contracts/search-queries.md §3`).
    expect(requestsTo('search')).toHaveLength(2);
  });

  it('a retentativa recupera a linha quando traz algo utilizável', async () => {
    // A primeira consulta sai só com ruído; a segunda encontra a faixa.
    programBelowFloor('search', 1);

    const [item] = await runMatching('spotify', linha('Zoio de Lula - Charlie Brown Jr'), {
      signal: signal(),
    });

    expect(requestsTo('search')).toHaveLength(2);
    expect(item?.status).toBe('confident');
    expect(item?.candidates[0]?.id).toBe('zoio');
  });

  it('achando de primeira, nenhuma retentativa é emitida', async () => {
    await runMatching('spotify', linha('Zoio de Lula - Charlie Brown Jr'), { signal: signal() });
    expect(requestsTo('search')).toHaveLength(1);
  });

  /** A linha livre não é elegível: a alternativa seria a mesma consulta. */
  it('linha sem separador não retenta, nem sem achar nada', async () => {
    setCatalog([]);

    await runMatching('spotify', linha('faixa inexistente ninguem'), { signal: signal() });

    expect(requestsTo('search')).toHaveLength(1);
  });
});

describe('YouTube — retenta só quando a consulta alternativa difere de fato', () => {
  /**
   * `003/research §6`, e a descoberta que torna a decisão Q2 barata: no catálogo
   * de vídeo a consulta primária de uma linha explícita já é texto livre com
   * título e artista. Normalizada, é a **mesma** string da linha inteira.
   * Repeti-la custaria 100 unidades para receber a mesma resposta.
   */
  it('linha explícita comum NÃO retenta, mesmo sem achar nada', async () => {
    await runMatching('youtube', linha('Zoio de Lula - Charlie Brown Jr'), { signal: signal() });

    expect(requestsTo('ytSearch')).toHaveLength(1);
  });

  it('o falso corte também não retenta — o reparo dele é na pontuação (§7)', async () => {
    await runMatching('youtube', linha('Marília Mendonça - Ao Vivo'), { signal: signal() });

    expect(requestsTo('ytSearch')).toHaveLength(1);
  });

  it('linha com feat. retenta, porque a alternativa é outra consulta', async () => {
    await runMatching('youtube', linha('Song feat. X - Artist A & B'), { signal: signal() });

    const buscas = requestsTo('ytSearch');
    expect(buscas).toHaveLength(2);
    expect(new URL(buscas[0]!.url).searchParams.get('q')).toBe('Song Artist A');
    expect(new URL(buscas[1]!.url).searchParams.get('q')).toBe('Song feat. X - Artist A & B');
  });

  it('linha livre nunca retenta no catálogo de vídeo', async () => {
    await runMatching('youtube', linha('zoio de lula charlie brown jr'), { signal: signal() });

    expect(requestsTo('ytSearch')).toHaveLength(1);
  });

  it('candidatas abaixo do piso disparam a retentativa da linha elegível', async () => {
    programBelowFloor('ytSearch', 1);

    await runMatching('youtube', linha('Song feat. X - Artist A & B'), { signal: signal() });

    expect(requestsTo('ytSearch')).toHaveLength(2);
  });
});

describe('a retentativa não afeta as demais linhas', () => {
  it('uma lista mista emite uma requisição por linha, mais as elegíveis que falharam', async () => {
    setCatalog(CATALOGO);

    const lista = [
      parseLine('Zoio de Lula - Charlie Brown Jr', 0, 'l0'),
      parseLine('Faixa Inexistente - Ninguém', 1, 'l1'),
      parseLine('zoio de lula charlie brown jr', 2, 'l2'),
    ];

    const items = await runMatching('spotify', lista, { signal: signal() });

    // l0 acha de primeira (1), l1 falha e retenta (2), l2 é livre e não retenta (1).
    expect(requestsTo('search')).toHaveLength(4);
    expect(items[0]?.status).toBe('confident');
    expect(items[1]?.status).toBe('not_found');
    expect(items[2]?.candidates.length).toBeGreaterThan(0);
  });
});
