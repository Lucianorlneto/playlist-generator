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
import {
  pendingItem,
  type InputLine,
  type MatchItem,
  type SearchOutcome,
} from '@/domain/types';
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

/**
 * Resolve uma única linha — usada na re-busca por linha da revisão.
 *
 * **Lança** quando a execução foi interrompida por falha de sessão: re-buscar
 * uma linha é ação pontual do usuário, e propagar o erro é o que faz o editor
 * mostrar a falha real em vez de uma "não encontrada" silenciosa
 * (`004/provider-contract §1`).
 */
export async function matchLine(
  provider: ProviderId,
  line: InputLine,
  signal: AbortSignal,
): Promise<MatchItem> {
  if (line.parseStatus === 'unparsed') return pendingItem(line);
  const outcome = await providerFor(provider).search([line], { signal });
  if (outcome.interruption !== null) throw outcome.interruption;
  return outcome.items[0] ?? pendingItem(line);
}

/**
 * Resolve a lista inteira. Os itens saem na ordem original — a concorrência
 * está na execução, não no resultado.
 *
 * Devolve a interrupção junto dos itens em vez de escondê-la: é quem chama que
 * sabe se a perda de sessão vira pedido de reautorização (a etapa do serviço) ou
 * erro propagado (a re-busca de uma linha).
 */
export async function runMatching(
  provider: ProviderId,
  lines: InputLine[],
  options: RunMatchOptions,
): Promise<SearchOutcome> {
  const { signal, onProgress, retryBudget, onRetry } = options;

  const outcome = await providerFor(provider).search(lines, {
    signal,
    ...(onProgress === undefined ? {} : { onProgress }),
    ...(retryBudget === undefined ? {} : { retryBudget }),
    ...(onRetry === undefined ? {} : { onRetry }),
  });

  // A duplicidade é recalculada sobre o conjunto **completo**, interrompido ou
  // não (FR-013d): marcar só o pedaço resolvido faria a retomada reintroduzir
  // uma duplicata que a execução anterior já tinha descartado.
  return { items: markDuplicates(outcome.items), interruption: outcome.interruption };
}
