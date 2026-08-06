import type { RunEvent } from '@/domain/run/machine';
import { reduceRun } from '@/domain/run/machine';
import {
  advanceQueue,
  buildQueue,
  currentProvider,
  currentRun,
  replaceRun,
  reduceUpcoming,
} from '@/domain/run/queue';
import { buildSummary } from '@/domain/run/summary';
import type { ProviderId } from '@/domain/providers';
import type { ExecutionQueue, ServiceRun } from '@/domain/types';

import type { RunSlice, SliceCreator } from './types';

const EMPTY_QUEUE: ExecutionQueue = {
  order: [],
  currentIndex: -1,
  runs: {} as Record<ProviderId, ServiceRun>,
};

/**
 * Fila de execução e ciclo por serviço (US3).
 *
 * O slice não decide nada: toda transição passa por `reduceRun`, que é puro e
 * testado sem DOM. Aqui só há leitura derivada e a ponte com o resto do estado.
 *
 * Consequência direta: o invariante de FR-019 — nenhuma escrita sem confirmação
 * **daquele** serviço — não depende de nenhuma tela lembrar de checá-lo. A fase
 * `creating` é inalcançável sem o evento `review_confirmed`.
 */
export const createRunSlice: SliceCreator<RunSlice> = (set, get) => ({
  queue: EMPTY_QUEUE,

  buildQueue: () =>
    set((state) => ({
      queue: buildQueue(
        state.destinations.selected,
        state.lines.map((line) => line.id),
      ),
    })),

  currentRun: () => currentRun(get().queue),
  currentProvider: () => currentProvider(get().queue),
  runFor: (provider) => get().queue.runs[provider] ?? null,

  summary: () => {
    const state = get();
    return buildSummary(state.queue, { lines: state.lines, sessions: state.sessions });
  },

  startQueue: () =>
    set((state) => {
      if (state.queue.order.length === 0) return state;
      const queue = state.queue.currentIndex < 0 ? { ...state.queue, currentIndex: 0 } : state.queue;
      const provider = currentProvider(queue);
      if (provider === null) return { queue };
      const run = queue.runs[provider];
      if (run === undefined) return { queue };
      return { queue: replaceRun(queue, reduceRun(run, { type: 'started' })) };
    }),

  dispatchRun: (event: RunEvent, provider) =>
    set((state) => {
      const target = provider ?? currentProvider(state.queue);
      if (target === null) return state;
      const run = state.queue.runs[target];
      if (run === undefined) return state;
      const next = reduceRun(run, event);
      return next === run ? state : { queue: replaceRun(state.queue, next) };
    }),

  advance: () =>
    set((state) => ({ queue: advanceQueue(state.queue, state.lines) })),

  reduceUpcoming: (provider, lineIds) =>
    set((state) => ({ queue: reduceUpcoming(state.queue, provider, lineIds) })),

  setEstimate: (provider, estimate) =>
    set((state) => {
      const run = state.queue.runs[provider];
      if (run === undefined || run.outcome !== null) return state;
      return { queue: replaceRun(state.queue, { ...run, estimate }) };
    }),

  setCreation: (provider, creation) =>
    set((state) => {
      const run = state.queue.runs[provider];
      if (run === undefined || run.outcome !== null) return state;
      return { queue: replaceRun(state.queue, { ...run, creation }) };
    }),

  setResult: (provider, result) =>
    set((state) => {
      const run = state.queue.runs[provider];
      if (run === undefined || run.outcome !== null) return state;
      return { queue: replaceRun(state.queue, { ...run, result }) };
    }),
});
