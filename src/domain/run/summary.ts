/**
 * Resumo consolidado (data-model §13, FR-040, FR-041, SC-018).
 *
 * **Invariante U1**: derivado **só** da fila. Nenhum estado próprio, nenhuma
 * persistência adicional — um resumo com memória própria poderia divergir do que
 * de fato aconteceu, que é exatamente o que ele existe para impedir.
 *
 * **Invariante U2**: quando os destinos receberam listas diferentes, o resumo
 * **declara** a divergência e informa quantas linhas cada serviço recebeu. É a
 * contrapartida honesta de permitir reduzir a lista entre destinos (FR-013).
 */

import type {
  ConsolidatedSummary,
  ExecutionQueue,
  InputLine,
  ProviderSession,
  SummaryEntry,
} from '@/domain/types';
import type { ProviderId } from '@/domain/providers';

import { outcomeOf } from './machine';
import { runsInOrder } from './queue';

export interface SummaryContext {
  /** Fonte única de linhas — resolve o `raw` das removidas. */
  lines: readonly InputLine[];
  /** Contas conectadas, para dizer onde cada playlist foi criada (FR-036). */
  sessions: Partial<Record<ProviderId, ProviderSession | null>>;
}

function accountLabelFor(
  provider: ProviderId,
  context: SummaryContext,
  frozen: InputLine[] | null,
): string {
  void frozen;
  const session = context.sessions[provider];
  return session?.user.displayName ?? '';
}

export function buildSummary(queue: ExecutionQueue, context: SummaryContext): ConsolidatedSummary {
  const runs = runsInOrder(queue);

  const entries: SummaryEntry[] = runs.map((run) => ({
    provider: run.provider,
    outcome: outcomeOf(run),
    playlistUrl: run.result?.playlistUrl ?? null,
    accountLabel: accountLabelFor(run.provider, context, run.frozenLines),
    addedCount: run.result?.addedCount ?? 0,
    skippedCount: run.result?.skippedCount ?? 0,
    failedLines: run.result?.failedLines ?? [],
    failedIndices: run.result?.failedIndices ?? [],
    lineCount: run.lineIds.length,
    incompleteByQuota: run.result?.incompleteByQuota ?? false,
  }));

  // Divergência é diferença de **tamanho** entre as listas efetivamente usadas.
  // Execuções puladas antes de receberem lista não contam: elas não divergiram,
  // simplesmente não aconteceram.
  const sizes = runs
    .filter((run) => run.outcome !== 'skipped' || run.lineIds.length > 0)
    .map((run) => run.lineIds.length);
  const listsDiverged = new Set(sizes).size > 1;

  // Linhas que estavam no primeiro destino e saíram nos posteriores.
  const first = runs[0];
  const last = runs[runs.length - 1];
  const removedForLater =
    first === undefined || last === undefined || first === last
      ? []
      : (() => {
          const kept = new Set(last.lineIds);
          const byId = new Map(context.lines.map((line) => [line.id, line] as const));
          return first.lineIds
            .filter((id) => !kept.has(id))
            .map((id) => byId.get(id)?.raw)
            .filter((raw): raw is string => raw !== undefined);
        })();

  return { entries, listsDiverged, removedForLater };
}
