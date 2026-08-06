import { describe, expect, it } from 'vitest';

import { applyTextCorrection, isSubsetOf, linesFor, removedIds } from '@/domain/run/lines';

import { makeLine } from '../fixtures/factories';

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
