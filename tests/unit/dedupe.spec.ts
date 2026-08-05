import { describe, expect, it } from 'vitest';

import { markDuplicates } from '@/domain/dedupe';

import { makeCandidate, makeItem, makeLine } from '../fixtures/factories';

describe('Duplicatas em duas passagens (research §7, FR-018)', () => {
  it('marca a repetição pela chave normalizada, preservando a primeira', () => {
    const items = markDuplicates([
      makeItem({ line: makeLine({ id: 'l0', index: 0, raw: 'Bohemian Rhapsody - Queen' }) }),
      makeItem({
        line: makeLine({
          id: 'l1',
          index: 1,
          raw: 'bohemian rhapsody - queen',
          title: 'bohemian rhapsody',
          artist: 'queen',
        }),
        candidates: [makeCandidate({ id: 'outro' })],
      }),
    ]);

    expect(items[0]?.duplicateOf).toBeNull();
    expect(items[0]?.included).toBe(true);
    expect(items[1]?.duplicateOf).toBe('l0');
    expect(items[1]?.included).toBe(false);
  });

  it('ignora acento na chave de entrada', () => {
    const items = markDuplicates([
      makeItem({
        line: makeLine({ id: 'l0', index: 0, title: 'Águas de Março', artist: 'Elis Regina' }),
        candidates: [makeCandidate({ id: 'a' })],
      }),
      makeItem({
        line: makeLine({ id: 'l1', index: 1, title: 'Aguas de Marco', artist: 'elis regina' }),
        candidates: [makeCandidate({ id: 'b' })],
      }),
    ]);

    expect(items[1]?.duplicateOf).toBe('l0');
  });

  it('marca duplicata de resultado quando duas linhas escolhem a mesma faixa', () => {
    const shared = makeCandidate({ id: 'mesma' });
    const items = markDuplicates([
      makeItem({
        line: makeLine({ id: 'l0', index: 0, title: 'Song', artist: 'Artist' }),
        candidates: [shared],
        selectedUri: shared.uri,
      }),
      makeItem({
        line: makeLine({ id: 'l1', index: 1, title: 'Song (Radio Edit)', artist: 'Artist' }),
        candidates: [shared],
        selectedUri: shared.uri,
      }),
    ]);

    expect(items[0]?.duplicateOf).toBeNull();
    expect(items[1]?.duplicateOf).toBe('l0');
    expect(items[1]?.included).toBe(false);
  });

  it('não reordena a lista (FR-019)', () => {
    const items = markDuplicates([
      makeItem({ line: makeLine({ id: 'l0', index: 0, title: 'A', artist: 'X' }) }),
      makeItem({ line: makeLine({ id: 'l1', index: 1, title: 'B', artist: 'Y' }) }),
      makeItem({ line: makeLine({ id: 'l2', index: 2, title: 'A', artist: 'X' }) }),
    ]);

    expect(items.map((item) => item.line.id)).toEqual(['l0', 'l1', 'l2']);
    expect(items.map((item) => item.line.index)).toEqual([0, 1, 2]);
  });

  it('não trata linhas distintas como duplicatas', () => {
    const items = markDuplicates([
      makeItem({
        line: makeLine({ id: 'l0', index: 0, title: 'Imagine', artist: 'John Lennon' }),
        candidates: [makeCandidate({ id: 'a' })],
      }),
      makeItem({
        line: makeLine({ id: 'l1', index: 1, title: 'Woman', artist: 'John Lennon' }),
        candidates: [makeCandidate({ id: 'b' })],
      }),
    ]);

    expect(items.every((item) => item.duplicateOf === null)).toBe(true);
  });

  it('não marca linhas sem separador reconhecido', () => {
    const items = markDuplicates([
      makeItem({
        line: makeLine({
          id: 'l0',
          index: 0,
          raw: 'ruim',
          title: '',
          artist: '',
          parseStatus: 'unparsed',
        }),
        status: 'unparsed',
        candidates: [],
        selectedUri: null,
      }),
      makeItem({
        line: makeLine({
          id: 'l1',
          index: 1,
          raw: 'outra ruim',
          title: '',
          artist: '',
          parseStatus: 'unparsed',
        }),
        status: 'unparsed',
        candidates: [],
        selectedUri: null,
      }),
    ]);

    expect(items.every((item) => item.duplicateOf === null)).toBe(true);
  });

  it('limpa a marcação quando a duplicidade deixa de existir', () => {
    const marcado = makeItem({
      line: makeLine({ id: 'l1', index: 1, title: 'Novo', artist: 'Outro' }),
      duplicateOf: 'l0',
      candidates: [makeCandidate({ id: 'unico' })],
    });

    const items = markDuplicates([
      makeItem({ line: makeLine({ id: 'l0', index: 0, title: 'Antigo', artist: 'Artista' }) }),
      marcado,
    ]);

    expect(items[1]?.duplicateOf).toBeNull();
  });
});
