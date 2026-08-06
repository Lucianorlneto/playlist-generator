/**
 * Fila de execução (data-model §9, FR-015 a FR-021).
 *
 * Um serviço por vez, na ordem fixa. Quatro invariantes que este módulo garante
 * por construção:
 *
 * - **Q1**: no máximo uma execução fora de `{pending, done, skipped, failed}`;
 * - **Q2**: `runs[i+1]` só sai de `pending` depois de `runs[i]` ter
 *   `outcome !== null`;
 * - **Q3**: nenhuma autorização é pedida a um provedor ainda `pending` — a fila
 *   simplesmente não o expõe como corrente (SC-005);
 * - **Q4**: com um único destino não há indicação de fila nem resumo.
 */

import { orderSelection, type ProviderId } from '@/domain/providers';
import type { ExecutionQueue, InputLine, ServiceRun } from '@/domain/types';

import { emptyRun, isActive, isFinished } from './machine';

export function buildQueue(
  selected: readonly ProviderId[],
  lineIds: readonly string[],
): ExecutionQueue {
  const order = orderSelection(selected);
  const runs = {} as Record<ProviderId, ServiceRun>;
  for (const provider of order) runs[provider] = emptyRun(provider, [...lineIds]);
  return { order, currentIndex: -1, runs };
}

export function currentProvider(queue: ExecutionQueue): ProviderId | null {
  return queue.order[queue.currentIndex] ?? null;
}

export function currentRun(queue: ExecutionQueue): ServiceRun | null {
  const provider = currentProvider(queue);
  return provider === null ? null : (queue.runs[provider] ?? null);
}

export function runsInOrder(queue: ExecutionQueue): ServiceRun[] {
  return queue.order
    .map((provider) => queue.runs[provider])
    .filter((run): run is ServiceRun => run !== undefined);
}

/** Q1: quantas execuções estão em andamento. Deve ser sempre 0 ou 1. */
export function activeCount(queue: ExecutionQueue): number {
  return runsInOrder(queue).filter(isActive).length;
}

export function isQueueDone(queue: ExecutionQueue): boolean {
  const runs = runsInOrder(queue);
  return runs.length > 0 && runs.every(isFinished);
}

/** Q4: fila de um destino só não exibe posição nem resumo consolidado. */
export function showsQueueIndicator(queue: ExecutionQueue): boolean {
  return queue.order.length > 1;
}

export function replaceRun(queue: ExecutionQueue, run: ServiceRun): ExecutionQueue {
  return { ...queue, runs: { ...queue.runs, [run.provider]: run } };
}

/**
 * Avança a fila para o próximo serviço, congelando o que encerrou.
 *
 * O congelamento (`frozenLines`) é o que sustenta SC-018: uma redução de lista
 * posterior, ou uma correção de texto no serviço seguinte, não pode reescrever o
 * relato de quem já terminou (FR-037, invariante R2).
 *
 * Q2 em ação: se a execução corrente ainda não tem `outcome`, a fila não anda.
 */
export function advanceQueue(queue: ExecutionQueue, lines: readonly InputLine[]): ExecutionQueue {
  const current = currentRun(queue);

  if (current !== null && !isFinished(current)) return queue;

  let next = queue;

  if (current !== null && current.frozenLines === null) {
    const used = new Set(current.lineIds);
    next = replaceRun(next, {
      ...current,
      frozenLines: lines.filter((line) => used.has(line.id)).map((line) => ({ ...line })),
    });
  }

  const nextIndex = next.currentIndex + 1;
  if (nextIndex >= next.order.length) {
    return { ...next, currentIndex: next.order.length };
  }
  return { ...next, currentIndex: nextIndex };
}

/**
 * Ajusta a lista de um destino **ainda não iniciado** para um subconjunto. A
 * validação de subconjunto fica em `lines.ts`; aqui só a aplicação (FR-013).
 */
export function reduceUpcoming(
  queue: ExecutionQueue,
  provider: ProviderId,
  lineIds: readonly string[],
): ExecutionQueue {
  const run = queue.runs[provider];
  if (run === undefined || isFinished(run)) return queue;
  return replaceRun(queue, { ...run, lineIds: [...lineIds] });
}
