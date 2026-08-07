/**
 * O que atravessa a fronteira entre serviços (FR-014, SC-013).
 *
 * A regra tem duas metades, e as duas erram para lados opostos se soltas:
 *
 * - **correção de texto propaga** — corrigir a grafia de um artista uma vez
 *   basta para os dois destinos;
 * - **escolha de candidata não propaga** — qual gravação usar é decisão por
 *   catálogo, e transferi-la escreveria no segundo serviço algo que o usuário
 *   nunca confirmou lá (Princípio V).
 */

import { describe, expect, it } from 'vitest';

import { applyTextCorrection } from '@/domain/run/lines';
import { reduceRun } from '@/domain/run/machine';
import type { InputLine } from '@/domain/types';

import { makeCandidate, makeFreeLine, makeItem, makeLine, makeRun, makeVideoCandidate } from '../fixtures/factories';

const linhas: InputLine[] = [
  makeLine({ id: 'l0', index: 0, raw: 'Bohemin Rapsody - Quen', title: 'Bohemin Rapsody', artist: 'Quen' }),
  makeLine({ id: 'l1', index: 1, raw: 'Imagine - John Lennon', title: 'Imagine', artist: 'John Lennon' }),
];

describe('FR-014 — correção de texto propaga para os serviços seguintes', () => {
  it('altera título e artista na fonte única', () => {
    const next = applyTextCorrection(linhas, 'l0', {
      title: 'Bohemian Rhapsody',
      artist: 'Queen',
    });

    expect(next[0]?.title).toBe('Bohemian Rhapsody');
    expect(next[0]?.artist).toBe('Queen');
  });

  it('nunca altera raw, id nem index (invariante L2)', () => {
    const next = applyTextCorrection(linhas, 'l0', {
      title: 'Bohemian Rhapsody',
      artist: 'Queen',
    });

    // `raw` é o que a lista de não encontradas copia: reescrevê-lo devolveria ao
    // usuário um texto que ele nunca digitou.
    expect(next[0]?.raw).toBe('Bohemin Rapsody - Quen');
    expect(next[0]?.id).toBe('l0');
    expect(next[0]?.index).toBe(0);
  });

  it('não encosta nas demais linhas', () => {
    const next = applyTextCorrection(linhas, 'l0', { title: 'Bohemian Rhapsody' });

    // Identidade preservada: a linha não corrigida é o mesmo objeto.
    expect(next[1]).toBe(linhas[1]);
  });

  it('devolve o mesmo array quando nada muda de fato', () => {
    const next = applyTextCorrection(linhas, 'l1', {
      title: 'Imagine',
      artist: 'John Lennon',
    });

    expect(next).toBe(linhas);
  });

  it('ignora id inexistente sem lançar', () => {
    expect(applyTextCorrection(linhas, 'l99', { title: 'X' })).toBe(linhas);
  });

  it('reanalisa parseStatus: corrigir uma linha ilegível a torna buscável', () => {
    const ilegivel = [
      makeLine({ id: 'lx', index: 0, raw: '---', title: '', artist: '', shape: 'free', parseStatus: 'unparsed' }),
    ];

    const next = applyTextCorrection(ilegivel, 'lx', {
      title: 'Wonderwall',
      artist: 'Oasis',
      shape: 'explicit',
    });

    // Sem isto a busca devolveria a linha intocada para sempre, e a edição —
    // que existe justamente para este caso — não teria efeito nenhum.
    expect(next[0]?.parseStatus).toBe('parsed');
  });

  /**
   * `003/FR-004`: a regra de invalidez mudou. Esvaziar o artista **não**
   * condena mais a linha — ela vira forma livre e continua buscável, que é
   * exatamente o que esta feature passou a permitir. Só a ausência de conteúdo
   * alfanumérico invalida.
   */
  it('esvaziar o artista deixa a linha na forma livre, ainda buscável', () => {
    const next = applyTextCorrection(linhas, 'l0', { artist: '   ', shape: 'free' });

    expect(next[0]?.parseStatus).toBe('parsed');
    expect(next[0]?.shape).toBe('free');
    expect(next[0]?.artist).toBe('');
  });

  it('só volta a unparsed quando não sobra conteúdo alfanumérico (L2)', () => {
    const next = applyTextCorrection(linhas, 'l0', { title: '---', artist: '', shape: 'free' });

    expect(next[0]?.parseStatus).toBe('unparsed');
  });

  /** Invariante L1: a forma livre nunca carrega artista declarado. */
  it('L1 — corrigir para a forma livre limpa artista e artistas secundários', () => {
    const comFeat = [
      makeLine({
        id: 'lf',
        index: 0,
        raw: 'Stay (feat. Justin Bieber) - The Kid LAROI',
        title: 'Stay',
        artist: 'The Kid LAROI',
        featuredArtists: ['Justin Bieber'],
        shape: 'explicit',
      }),
    ];

    const next = applyTextCorrection(comFeat, 'lf', { title: 'stay the kid laroi', shape: 'free' });

    expect(next[0]?.artist).toBe('');
    expect(next[0]?.featuredArtists).toEqual([]);
  });

  /**
   * `003/FR-022`: a propagação entre serviços vale igualmente para a forma
   * livre — era herança presumida, sem verificação.
   */
  it('FR-022 — a correção de uma linha livre propaga como qualquer outra', () => {
    const livres = [
      makeFreeLine({ id: 'lv', index: 0, raw: 'nao sei viver sem ter voce cpm 22' }),
      makeFreeLine({ id: 'lw', index: 1, raw: 'zoio de lula charlie brown jr' }),
    ];

    const next = applyTextCorrection(livres, 'lv', { title: 'Não Sei Viver Sem Ter Você CPM 22' });

    expect(next[0]?.title).toBe('Não Sei Viver Sem Ter Você CPM 22');
    expect(next[0]?.shape).toBe('free');
    expect(next[0]?.raw).toBe('nao sei viver sem ter voce cpm 22');
    // As demais linhas ficam intocadas, inclusive por identidade de referência.
    expect(next[1]).toBe(livres[1]);
  });
});

describe('SC-013 — escolha de candidata NÃO propaga entre serviços', () => {
  it('a execução de um serviço guarda os próprios itens', () => {
    const spotifyRun = makeRun('spotify', {
      lineIds: ['l0'],
      items: [
        makeItem({
          line: linhas[0]!,
          candidates: [makeCandidate({ id: 'escolhida-no-spotify' })],
          selectedUri: 'spotify:track:escolhida-no-spotify',
          included: true,
        }),
      ],
    });

    const youtubeRun = makeRun('youtube', { phase: 'search', lineIds: ['l0'], items: [] });

    // A busca do YouTube preenche os itens dele, do zero.
    const buscado = reduceRun(youtubeRun, {
      type: 'search_done',
      items: [
        makeItem({
          line: linhas[0]!,
          candidates: [makeVideoCandidate({ id: 'outro-video' })],
          selectedUri: 'outro-video',
          included: true,
        }),
      ],
    });

    expect(buscado.items[0]?.selectedUri).toBe('outro-video');
    // A escolha do Spotify segue intacta e separada.
    expect(spotifyRun.items[0]?.selectedUri).toBe('spotify:track:escolhida-no-spotify');
  });

  it('inclusão e exclusão de um serviço não alcançam o outro', () => {
    const incluido = makeItem({ line: linhas[0]!, included: true });
    const excluido = makeItem({ line: linhas[0]!, included: false, status: 'discarded' });

    const spotifyRun = makeRun('spotify', { lineIds: ['l0'], items: [incluido] });
    const youtubeRun = makeRun('youtube', { lineIds: ['l0'], items: [excluido] });

    expect(spotifyRun.items[0]?.included).toBe(true);
    expect(youtubeRun.items[0]?.included).toBe(false);
  });

  it('uma execução concluída não aceita mais mudanças (invariante R2)', () => {
    const concluido = makeRun('spotify', {
      phase: 'done',
      outcome: 'completed',
      lineIds: ['l0'],
      items: [makeItem({ line: linhas[0]! })],
    });

    const depois = reduceRun(concluido, { type: 'items_changed', items: [] });

    // Identidade preservada: o redutor é identidade sobre execução encerrada.
    expect(depois).toBe(concluido);
  });
});
