import { describe, expect, it } from 'vitest';

import {
  buildOrderedUris,
  chunk,
  committedItemCount,
  partition,
  remainingItems,
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

describe('buildOrderedUris — a ordem é a das linhas', () => {
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

describe('partition — o tamanho do lote vem do provedor', () => {
  it('particiona em lotes do tamanho pedido', () => {
    expect(partition(['1', '2', '3', '4', '5'], 2)).toEqual([['1', '2'], ['3', '4'], ['5']]);
  });

  it('devolve lista vazia para entrada vazia', () => {
    expect(partition([], 100)).toEqual([]);
    expect(chunk([], 1)).toEqual([]);
  });

  /** Spotify: 250 URIs viram 3 requisições. */
  it('lote 100 particiona 250 URIs em 3 requisições', () => {
    const uris = Array.from({ length: 250 }, (_, index) => `spotify:track:${index}`);
    const lotes = partition(uris, 100);

    expect(lotes).toHaveLength(3);
    expect(lotes.map((lote) => lote.length)).toEqual([100, 100, 50]);
    expect(lotes.flat()).toEqual(uris);
  });

  /** YouTube: um vídeo por requisição — não existe endpoint de lote (research §9). */
  it('lote 1 produz uma requisição por item', () => {
    const ids = ['a', 'b', 'c'];
    const lotes = partition(ids, 1);

    expect(lotes).toHaveLength(3);
    expect(lotes.every((lote) => lote.length === 1)).toBe(true);
    expect(lotes.flat()).toEqual(ids);
  });
});

describe('remainingItems — a função que sustenta SC-010', () => {
  const uris = Array.from({ length: 250 }, (_, index) => `spotify:track:${index}`);

  it('sem nada confirmado devolve tudo', () => {
    const lotes = remainingItems(makeCreation({ orderedUris: uris, committedItems: 0 }));
    expect(lotes.flat()).toEqual(uris);
  });

  /** O ganho da contagem em itens: retomada exata no meio de um lote. */
  it('lote 100: retoma de um índice **arbitrário**, não de fronteira de lote', () => {
    const progresso = makeCreation({ orderedUris: uris, batchSize: 100, committedItems: 137 });
    const restantes = remainingItems(progresso).flat();

    expect(restantes).toEqual(uris.slice(137));
    expect(restantes).not.toContain(uris[136]);
    expect(restantes[0]).toBe(uris[137]);
  });

  it('lote 1: cada item confirmado avança exatamente um', () => {
    const ids = ['a', 'b', 'c', 'd'];
    for (let confirmados = 0; confirmados <= ids.length; confirmados += 1) {
      const progresso = makeCreation({
        orderedUris: ids,
        batchSize: 1,
        committedItems: confirmados,
      });
      const restantes = remainingItems(progresso);
      expect(restantes).toHaveLength(ids.length - confirmados);
      expect(restantes.flat()).toEqual(ids.slice(confirmados));
    }
  });

  it('com tudo confirmado não sobra nada', () => {
    expect(remainingItems(makeCreation({ orderedUris: uris, committedItems: 250 }))).toEqual([]);
    expect(
      remainingItems(makeCreation({ orderedUris: uris, batchSize: 1, committedItems: 250 })),
    ).toEqual([]);
  });

  /** Sem duplicar e sem faltar, em qualquer batchSize (SC-010). */
  it('confirmado + restante = lista original, exatamente uma vez cada', () => {
    for (const batchSize of [1, 7, 100]) {
      for (const committedItems of [0, 1, 99, 137, 250]) {
        const progresso = makeCreation({ orderedUris: uris, batchSize, committedItems });
        const enviadas = uris.slice(0, committedItemCount(progresso));
        const restantes = remainingItems(progresso).flat();

        expect([...enviadas, ...restantes]).toEqual(uris);
        expect(new Set([...enviadas, ...restantes]).size).toBe(uris.length);
      }
    }
  });

  it('committedItemCount nunca passa do total', () => {
    expect(committedItemCount(makeCreation({ orderedUris: uris, committedItems: 9_999 }))).toBe(250);
    expect(committedItemCount(makeCreation({ orderedUris: uris, committedItems: -5 }))).toBe(0);
  });

  it('totalBatches reflete o tamanho do lote do provedor', () => {
    expect(totalBatches(makeCreation({ orderedUris: uris, batchSize: 100 }))).toBe(3);
    expect(totalBatches(makeCreation({ orderedUris: uris, batchSize: 1 }))).toBe(250);
  });
});
