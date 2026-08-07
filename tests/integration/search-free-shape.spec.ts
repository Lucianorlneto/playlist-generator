/**
 * A busca da linha **sem separador**, ponta a ponta contra o mock dos dois
 * catálogos (US1, `003/FR-001`, FR-008, FR-013, FR-018).
 *
 * O que esta suíte prova e nenhuma outra prova: uma lista em que nenhuma linha
 * tem separador produz candidatas nos dois provedores, e a faixa vencedora é a
 * **mesma** que a forma explícita equivalente escolheria. Antes desta feature
 * nenhuma dessas linhas era sequer consultada — o portão de admissão as
 * reprovava no parser.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { parseInput } from '@/domain/parser';
import { runMatching } from '@/features/input/matchRunner';

import {
  requestsTo,
  setCatalog,
  setYouTubeCatalog,
  type MockTrack,
  type MockVideo,
} from '../msw/handlers';

import { useFastLimiters, wireBoth } from './support/clients';

const FAIXAS: { title: string; artist: string; id: string }[] = [
  { title: 'Não Sei Viver Sem Ter Você', artist: 'CPM 22', id: 'nao_sei' },
  { title: 'Zoio de Lula', artist: 'Charlie Brown Jr', id: 'zoio' },
  { title: 'Eduardo e Mônica', artist: 'Legião Urbana', id: 'eduardo' },
];

function catalogo(): MockTrack[] {
  return FAIXAS.map((faixa) => ({
    id: faixa.id,
    name: faixa.title,
    artists: [faixa.artist],
    album: 'Álbum',
    durationMs: 220_000,
  }));
}

function catalogoVideo(): MockVideo[] {
  return FAIXAS.map((faixa) => ({
    id: `vid_${faixa.id}`,
    title: `${faixa.title} (Official Music Video)`,
    channel: `${faixa.artist} - Topic`,
    duration: 'PT3M40S',
  }));
}

beforeEach(() => {
  wireBoth();
  useFastLimiters();
  setCatalog(catalogo());
  setYouTubeCatalog(catalogoVideo());
});

const signal = (): AbortSignal => new AbortController().signal;

describe('US1 — lista sem separador algum produz candidatas', () => {
  const semSeparador = parseInput(
    ['nao sei viver sem ter voce cpm 22', 'zoio de lula charlie brown jr', 'eduardo e monica legiao urbana'].join(
      '\n',
    ),
  );

  it('todas as linhas são reconhecidas como forma livre e válidas', () => {
    expect(semSeparador.every((line) => line.shape === 'free')).toBe(true);
    expect(semSeparador.every((line) => line.parseStatus === 'parsed')).toBe(true);
  });

  it('no catálogo musical, toda linha recebe candidatas', async () => {
    const { items } = await runMatching('spotify', semSeparador, { signal: signal() });

    expect(items).toHaveLength(3);
    for (const item of items) {
      expect(item.candidates.length, item.line.raw).toBeGreaterThan(0);
      expect(item.status, item.line.raw).not.toBe('unparsed');
    }
    // Uma requisição por linha: a forma livre nunca retenta (research §6).
    expect(requestsTo('search')).toHaveLength(3);
  });

  it('no catálogo de vídeo, toda linha recebe candidatas', async () => {
    const { items } = await runMatching('youtube', semSeparador, { signal: signal() });

    expect(items).toHaveLength(3);
    for (const item of items) {
      expect(item.candidates.length, item.line.raw).toBeGreaterThan(0);
    }
    expect(requestsTo('ytSearch')).toHaveLength(3);
  });

  /**
   * SC-001, e o coração da feature: a forma livre e a explícita convergem para
   * a **mesma** faixa. Se divergissem, remover o separador teria custado
   * precisão em vez de só ter removido um obstáculo.
   */
  it('SC-001 — a vencedora é a mesma da forma explícita equivalente', async () => {
    const explicitas = parseInput(
      FAIXAS.map((faixa) => `${faixa.title} - ${faixa.artist}`).join('\n'),
    );

    const { items: livres } = await runMatching('spotify', semSeparador, { signal: signal() });
    const { items: declaradas } = await runMatching('spotify', explicitas, { signal: signal() });

    expect(livres.map((item) => item.selectedUri)).toEqual(
      declaradas.map((item) => item.selectedUri),
    );
  });

  it('a linha livre com artista reivindicado resolve sozinha', async () => {
    const { items: [item] } = await runMatching(
      'spotify',
      parseInput('nao sei viver sem ter voce cpm 22'),
      { signal: signal() },
    );

    expect(item?.status).toBe('confident');
    expect(item?.included).toBe(true);
    expect(item?.attentionReason).toBeNull();
  });
});

/**
 * `003/FR-018`: as garantias de candidatas alternativas da 001 e da 002 valem
 * igualmente sob as formas novas. Era herança presumida, sem verificação.
 */
describe('FR-018 — a forma livre herda as candidatas alternativas', () => {
  const cincoIguais: MockTrack[] = Array.from({ length: 7 }, (_, index) => ({
    id: `amor_${index}`,
    name: 'Amor',
    artists: [`Artista ${index}`],
    album: `Álbum ${index}`,
    durationMs: 200_000 + index * 1_000,
  }));

  it('linha livre e linha só-título recebem até 5 candidatas', async () => {
    setCatalog(cincoIguais);

    const { items } = await runMatching('spotify', parseInput('Amor\namor artista 3'), {
      signal: signal(),
    });

    for (const item of items) {
      expect(item.candidates.length, item.line.raw).toBeGreaterThan(1);
      expect(item.candidates.length, item.line.raw).toBeLessThanOrEqual(5);
    }
  });

  it('as candidatas trazem os mesmos campos exibíveis da forma explícita', async () => {
    const { items: [livre] } = await runMatching('spotify', parseInput('nao sei viver sem ter voce cpm 22'), {
      signal: signal(),
    });
    const { items: [explicita] } = await runMatching(
      'spotify',
      parseInput('Não Sei Viver Sem Ter Você - CPM 22'),
      { signal: signal() },
    );

    const campos = (item: typeof livre): string[] =>
      Object.keys(item?.candidates[0] ?? {}).sort();

    expect(campos(livre)).toEqual(campos(explicita));
    expect(livre?.candidates[0]?.title).toBeTruthy();
    expect(livre?.candidates[0]?.artists.length).toBeGreaterThan(0);
    expect(livre?.candidates[0]?.externalUrl).toContain('open.spotify.com');
  });

  it('no catálogo de vídeo, a linha livre também traz canal e URL externa (002/FR-024)', async () => {
    const { items: [item] } = await runMatching('youtube', parseInput('zoio de lula charlie brown jr'), {
      signal: signal(),
    });

    const melhor = item?.candidates[0];
    expect(melhor?.channel).toBeTruthy();
    expect(melhor?.album).toBe('');
    expect(melhor?.externalUrl).toContain('youtube.com/watch');
  });

  it('as candidatas saem ordenadas por pontuação decrescente', async () => {
    setCatalog(cincoIguais);

    const { items: [item] } = await runMatching('spotify', parseInput('Amor'), { signal: signal() });
    const notas = item?.candidates.map((candidate) => candidate.score) ?? [];

    expect(notas).toEqual([...notas].sort((a, b) => b - a));
  });
});
