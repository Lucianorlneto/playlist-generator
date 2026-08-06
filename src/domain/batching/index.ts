/**
 * Particionamento da adição de itens (FR-033, research §9).
 *
 * `remainingItems` é a função que sustenta SC-010: devolve **apenas** os lotes a
 * partir de `committedItems`, de modo que uma retomada nunca reenvie um item já
 * confirmado — sem duplicar e sem faltar.
 *
 * A contagem é em **itens**, não em lotes. É o que mantém a retomada exata
 * quando `batchSize` vale 100 (Spotify) ou 1 (YouTube): com lotes, mudar o
 * tamanho reinterpretaria um índice gravado e reenviaria ou puliria faixas.
 */

import type { CreationProgress, MatchItem } from '@/domain/types';

/** URIs dos itens incluídos, na ordem original das linhas. */
export function buildOrderedUris(items: MatchItem[]): string[] {
  return [...items]
    .sort((a, b) => a.line.index - b.line.index)
    .filter((item) => item.included && item.selectedUri !== null)
    .map((item) => item.selectedUri as string);
}

export function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) return items.length === 0 ? [] : [items];
  const result: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    result.push(items.slice(start, start + size));
  }
  return result;
}

/** Parte uma lista de URIs em lotes do tamanho que o provedor aceita. */
export function partition(uris: string[], batchSize: number): string[][] {
  return chunk(uris, batchSize);
}

function sizeOf(progress: CreationProgress): number {
  return progress.batchSize > 0 ? progress.batchSize : 1;
}

/** Itens confirmados, saturado ao total — nunca maior que a lista. */
export function committedItemCount(progress: CreationProgress): number {
  return Math.min(progress.orderedUris.length, Math.max(0, progress.committedItems));
}

export function totalBatches(progress: CreationProgress): number {
  return Math.ceil(progress.orderedUris.length / sizeOf(progress));
}

/** Lotes ainda não confirmados, a partir de `committedItems`. */
export function remainingItems(progress: CreationProgress): string[][] {
  return chunk(progress.orderedUris.slice(committedItemCount(progress)), sizeOf(progress));
}
