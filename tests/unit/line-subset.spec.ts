import { describe, expect, it } from 'vitest';

import { applyTextCorrection, isSubsetOf, linesFor, removedIds } from '@/domain/run/lines';

import { makeFreeLine, makeLine } from '../fixtures/factories';

describe('FR-013 — a lista de um destino posterior só pode encolher', () => {
  const previous = ['l0', 'l1', 'l2', 'l3'];

  it('aceita a lista igual e qualquer subconjunto que preserve a ordem', () => {
    expect(isSubsetOf(previous, previous)).toBe(true);
    expect(isSubsetOf(previous, ['l0', 'l2'])).toBe(true);
    expect(isSubsetOf(previous, ['l3'])).toBe(true);
    expect(isSubsetOf(previous, [])).toBe(true);
  });

  it('recusa acréscimo', () => {
    expect(isSubsetOf(previous, [...previous, 'l4'])).toBe(false);
    expect(isSubsetOf(previous, ['l0', 'l9'])).toBe(false);
  });

  it('recusa alteração', () => {
    expect(isSubsetOf(previous, ['l0', 'l1x', 'l2'])).toBe(false);
  });

  it('recusa reordenação', () => {
    expect(isSubsetOf(previous, ['l1', 'l0'])).toBe(false);
    expect(isSubsetOf(previous, ['l3', 'l2', 'l1', 'l0'])).toBe(false);
  });

  it('recusa repetição de uma linha que só existe uma vez', () => {
    expect(isSubsetOf(previous, ['l0', 'l0'])).toBe(false);
  });

  it('removedIds devolve o que saiu, na ordem original', () => {
    expect(removedIds(previous, ['l0', 'l2'])).toEqual(['l1', 'l3']);
    expect(removedIds(previous, previous)).toEqual([]);
    expect(removedIds(previous, [])).toEqual(previous);
  });

  /**
   * `003/FR-022`: a regra de subconjunto vale igualmente para a forma livre —
   * era herança presumida, sem verificação. A redução é por `id`, e o `id` não
   * sabe nem se importa com a forma da linha; este teste existe para que
   * qualquer mudança que **fizesse** a forma importar quebre aqui.
   */
  it('FR-022 — a redução para o destino seguinte trata a forma livre como qualquer outra', () => {
    const mistas = [
      makeLine({ id: 'm0', index: 0, raw: 'Bohemian Rhapsody - Queen' }),
      makeFreeLine({ id: 'm1', index: 1, raw: 'nao sei viver sem ter voce cpm 22' }),
      makeFreeLine({ id: 'm2', index: 2, raw: 'Garota de Ipanema' }),
      makeLine({ id: 'm3', index: 3, raw: 'Imagine - John Lennon' }),
    ];
    const todos = mistas.map((line) => line.id);
    const reduzido = ['m0', 'm2'];

    expect(isSubsetOf(todos, reduzido)).toBe(true);
    expect(removedIds(todos, reduzido)).toEqual(['m1', 'm3']);

    const restantes = linesFor(mistas, reduzido);
    expect(restantes.map((line) => line.id)).toEqual(['m0', 'm2']);
    // A linha livre que sobrou continua livre e buscável.
    expect(restantes[1]?.shape).toBe('free');
    expect(restantes[1]?.parseStatus).toBe('parsed');
  });

  it('FR-022 — reduzir a lista a apenas linhas livres continua sendo subconjunto', () => {
    const todos = ['m0', 'm1', 'm2', 'm3'];
    expect(isSubsetOf(todos, ['m1', 'm2'])).toBe(true);
  });
});

describe('FR-014 — correção de texto na fonte única', () => {
  const lines = [
    makeLine({ index: 0, raw: 'Bohemin Rapsody - Queen', title: 'Bohemin Rapsody', artist: 'Queen' }),
    makeLine({ index: 1, raw: 'Imagine - John Lennon', title: 'Imagine', artist: 'John Lennon' }),
  ];

  it('altera title, artist e featuredArtists', () => {
    const next = applyTextCorrection(lines, 'l0', {
      title: 'Bohemian Rhapsody',
      artist: 'Queen',
      featuredArtists: ['Freddie'],
    });
    expect(next[0]?.title).toBe('Bohemian Rhapsody');
    expect(next[0]?.featuredArtists).toEqual(['Freddie']);
  });

  /** Invariante L2: `raw` é o que a lista de não encontradas copia (FR-041). */
  it('**nunca** altera raw, id nem index', () => {
    const next = applyTextCorrection(lines, 'l0', { title: 'Bohemian Rhapsody' });
    expect(next[0]?.raw).toBe('Bohemin Rapsody - Queen');
    expect(next[0]?.id).toBe('l0');
    expect(next[0]?.index).toBe(0);
  });

  it('não toca em nenhuma outra linha', () => {
    const next = applyTextCorrection(lines, 'l0', { title: 'Bohemian Rhapsody' });
    // Identidade preservada: a linha 1 é literalmente o mesmo objeto.
    expect(next[1]).toBe(lines[1]);
  });

  it('devolve o mesmo array quando nada muda', () => {
    expect(applyTextCorrection(lines, 'l0', { title: 'Bohemin Rapsody' })).toBe(lines);
    expect(applyTextCorrection(lines, 'inexistente', { title: 'X' })).toBe(lines);
  });

  it('linesFor recorta na ordem da fonte única', () => {
    expect(linesFor(lines, ['l1', 'l0']).map((line) => line.id)).toEqual(['l0', 'l1']);
    expect(linesFor(lines, ['l1']).map((line) => line.id)).toEqual(['l1']);
    expect(linesFor(lines, [])).toEqual([]);
  });
});
