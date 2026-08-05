import { describe, expect, it } from 'vitest';

import {
  buildOrderedUris,
  chunk,
  committedTrackCount,
  remainingBatches,
  totalBatches,
} from '@/domain/batching';

import { makeCandidate, makeCreation, makeItem, makeLine } from '../fixtures/factories';

function item(index: number, included: boolean, uri = `spotify:track:t${index}`) {
  return makeItem({
    line: makeLine({ id: `l${index}`, index }),
    candidates: [makeCandidate({ id: `t${index}` })],
    selectedUri: uri,
    included,
  });
}

describe('buildOrderedUris (FR-019, FR-032)', () => {
  it('preserva a ordem das linhas, não a do array', () => {
    const uris = buildOrderedUris([item(2, true), item(0, true), item(1, true)]);
    expect(uris).toEqual(['spotify:track:t0', 'spotify:track:t1', 'spotify:track:t2']);
  });

  it('inclui apenas os itens marcados', () => {
    const uris = buildOrderedUris([item(0, true), item(1, false), item(2, true)]);
    expect(uris).toEqual(['spotify:track:t0', 'spotify:track:t2']);
  });

  it('ignora itens marcados sem faixa escolhida', () => {
    const semFaixa = makeItem({
      line: makeLine({ id: 'l9', index: 9 }),
      candidates: [],
      selectedUri: null,
      included: true,
    });
    expect(buildOrderedUris([semFaixa])).toEqual([]);
  });

  it('não altera o array recebido', () => {
    const itens = [item(1, true), item(0, true)];
    buildOrderedUris(itens);
    expect(itens.map((entry) => entry.line.index)).toEqual([1, 0]);
  });
});

describe('chunk', () => {
  it('particiona em lotes do tamanho pedido', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('devolve lista vazia para entrada vazia', () => {
    expect(chunk([], 100)).toEqual([]);
  });

  it('particiona 250 URIs em 3 lotes de no máximo 100', () => {
    const uris = Array.from({ length: 250 }, (_, index) => `spotify:track:${index}`);
    const lotes = chunk(uris, 100);

    expect(lotes).toHaveLength(3);
    expect(lotes.map((lote) => lote.length)).toEqual([100, 100, 50]);
    expect(lotes.flat()).toEqual(uris);
  });
});

describe('remainingBatches — a função que sustenta SC-009', () => {
  const uris = Array.from({ length: 250 }, (_, index) => `spotify:track:${index}`);

  it('sem nada confirmado devolve todos os lotes', () => {
    const lotes = remainingBatches(makeCreation({ orderedUris: uris, committedBatches: 0 }));
    expect(lotes).toHaveLength(3);
    expect(lotes.flat()).toEqual(uris);
  });

  it('nunca reenvia um lote já confirmado', () => {
    const lotes = remainingBatches(makeCreation({ orderedUris: uris, committedBatches: 1 }));

    expect(lotes).toHaveLength(2);
    expect(lotes.flat()).toEqual(uris.slice(100));
    expect(lotes.flat()).not.toContain(uris[0]);
    expect(lotes.flat()).not.toContain(uris[99]);
  });

  it('com tudo confirmado não sobra nada', () => {
    expect(remainingBatches(makeCreation({ orderedUris: uris, committedBatches: 3 }))).toEqual([]);
  });

  it('a união do que foi confirmado com o que resta é exatamente a lista original', () => {
    const progress = makeCreation({ orderedUris: uris, committedBatches: 2 });
    const enviadas = uris.slice(0, committedTrackCount(progress));
    const restantes = remainingBatches(progress).flat();

    expect([...enviadas, ...restantes]).toEqual(uris);
    expect(new Set([...enviadas, ...restantes]).size).toBe(uris.length);
  });

  it('totalBatches e committedTrackCount acompanham o particionamento', () => {
    const progress = makeCreation({ orderedUris: uris, committedBatches: 2 });
    expect(totalBatches(progress)).toBe(3);
    expect(committedTrackCount(progress)).toBe(200);
  });

  it('committedTrackCount nunca passa do total de faixas', () => {
    const progress = makeCreation({ orderedUris: uris, committedBatches: 99 });
    expect(committedTrackCount(progress)).toBe(250);
  });
});
