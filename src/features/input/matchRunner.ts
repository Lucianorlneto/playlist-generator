/**
 * Orquestração da busca do serviço corrente.
 *
 * O runner deixou de conhecer o provedor: ele chama `provider.search`, que já
 * devolve os itens pontuados e classificados com os limiares e os indícios
 * daquele catálogo. O que sobra aqui é o que é comum aos dois — deduplicação,
 * progresso e cancelamento.
 *
 * Duas garantias mantidas da 001:
 * - **a falha de uma linha não aborta as demais** (isolada no `searchRunner`);
 * - **cancelar funciona em qualquer momento**, inclusive durante a espera por
 *   limitação, porque o mesmo `AbortSignal` atravessa o limitador e o backoff do
 *   cliente HTTP.
 */

import { markDuplicates } from '@/domain/dedupe';
import type { ProviderId } from '@/domain/providers';
import { pendingItem, type InputLine, type MatchItem } from '@/domain/types';
import { providerFor } from '@/services/providers/registry';

export interface RunMatchOptions {
  signal: AbortSignal;
  /** Chamado a cada linha concluída, com a contagem acumulada. */
  onProgress?: (done: number, total: number) => void;
  /** Teto de retentativas desta execução (`003/FR-010a`, invariante O4). */
  retryBudget?: number;
  /** Chamado quando uma retentativa é emitida — persiste `retriesUsed`. */
  onRetry?: (total: number) => void;
}

/** Resolve uma única linha — usada na re-busca por linha da revisão. */
export async function matchLine(
  provider: ProviderId,
  line: InputLine,
  signal: AbortSignal,
): Promise<MatchItem> {
  if (line.parseStatus === 'unparsed') return pendingItem(line);
  const [item] = await providerFor(provider).search([line], { signal });
  return item ?? pendingItem(line);
}

/**
 * Resolve a lista inteira. Os itens saem na ordem original — a concorrência
 * está na execução, não no resultado.
 */
export async function runMatching(
  provider: ProviderId,
  lines: InputLine[],
  options: RunMatchOptions,
): Promise<MatchItem[]> {
  const { signal, onProgress, retryBudget, onRetry } = options;

  const items = await providerFor(provider).search(lines, {
    signal,
    ...(onProgress === undefined ? {} : { onProgress }),
    ...(retryBudget === undefined ? {} : { retryBudget }),
    ...(onRetry === undefined ? {} : { onRetry }),
  });

  return markDuplicates(items);
}
