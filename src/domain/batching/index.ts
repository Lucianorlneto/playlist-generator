/**
 * Particionamento da adição de faixas (FR-032, FR-033).
 *
 * `remainingBatches` é a função que sustenta SC-009: ela devolve **apenas** os
 * lotes a partir de `committedBatches`, de modo que uma retomada nunca reenvia
 * um lote já confirmado — sem duplicar e sem faltar.
 */

import { BATCH_SIZE, type CreationProgress, type MatchItem } from '@/domain/types';

/** URIs das faixas incluídas, na ordem original das linhas (FR-019). */
export function buildOrderedUris(items: MatchItem[]): string[] {
  return [...items]
    .sort((a, b) => a.line.index - b.line.index)
    .filter((item) => item.included && item.selectedUri !== null)
    .map((item) => item.selectedUri as string);
}

export function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const result: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    result.push(items.slice(start, start + size));
  }
  return result;
}

export function totalBatches(progress: CreationProgress): number {
  const size = progress.batchSize > 0 ? progress.batchSize : BATCH_SIZE;
  return Math.ceil(progress.orderedUris.length / size);
}

export function remainingBatches(progress: CreationProgress): string[][] {
  const size = progress.batchSize > 0 ? progress.batchSize : BATCH_SIZE;
  const committed = Math.max(0, progress.committedBatches);
  return chunk(progress.orderedUris.slice(committed * size), size);
}

/** Faixas já confirmadas — é o número exibido no resumo de falha parcial. */
export function committedTrackCount(progress: CreationProgress): number {
  const size = progress.batchSize > 0 ? progress.batchSize : BATCH_SIZE;
  return Math.min(progress.orderedUris.length, progress.committedBatches * size);
}
