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
import { exitAfterSkip } from '@/domain/run/exit';
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

  /**
   * Avança para o próximo serviço.
   *
   * O `stepToken` sobe junto (`006/FR-024`). Ele é o gatilho de foco do
   * `StepHeading`, e até a `006` só era incrementado por `goToStep` — que não
   * dispara aqui, porque passar de um serviço para o outro acontece **dentro**
   * da etapa `service`. Medido na Fase 0: quem usa leitor de tela trocava de
   * destino sem que nada fosse anunciado (`006/research §7`).
   */
  advance: () =>
    set((state) => ({
      queue: advanceQueue(state.queue, state.lines),
      stepToken: state.stepToken + 1,
    })),

  /**
   * Pular um destino, do começo ao fim (`006/FR-001`, FR-008).
   *
   * Até a `006` isto era uma sequência de quatro passos repetida em seis lugares
   * da interface — e, em cinco deles, incompleta: só o primeiro passo acontecia.
   * FR-008 exige comportamento **idêntico** nas quatro fases em que o botão
   * existe, e seis cópias de uma sequência é como uma delas acaba diferente.
   *
   * A ordem é contratada (`006/contracts/flow-contract §3`):
   *
   * 1. **cancelar primeiro** (invariante S1). Cancelar depois deixaria uma
   *    janela em que a busca ainda escreve progresso sobre execução encerrada;
   * 2. **calcular a saída antes do despacho** (invariante S2), porque
   *    `exitAfterSkip` pergunta se algum destino rodou e o próprio destino
   *    pulado passaria a contar como `skipped` no meio do caminho;
   * 3. encerrar, avançar e aplicar a saída.
   *
   * `resetWork` já leva à seleção de serviços, apaga o rascunho e preserva
   * credenciais e sessões — o descarte de FR-004 **é** ele, não um caminho
   * paralelo (`006/contracts/flow-contract §4`).
   */
  skipService: (provider) => {
    const store = get();
    store.cancelSearch();

    const exit = exitAfterSkip(store.queue, provider);

    store.dispatchRun({ type: 'skipped' }, provider);
    store.advance();

    if (exit.kind === 'summary') get().goToStep('summary');
    else if (exit.kind === 'discard') get().resetWork();
  },

  reduceUpcoming: (provider, lineIds) =>
    set((state) => ({ queue: reduceUpcoming(state.queue, provider, lineIds) })),

  setEstimate: (provider, estimate) =>
    set((state) => {
      const run = state.queue.runs[provider];
      if (run === undefined || run.outcome !== null) return state;
      return { queue: replaceRun(state.queue, { ...run, estimate }) };
    }),

  /**
   * Persiste quantas retentativas esta execução já emitiu (`003/data-model §5`).
   *
   * É gravado durante a busca, não no fim: uma recarga no meio da execução não
   * pode fazer a retomada acreditar que a reserva está intacta e gastá-la de
   * novo. `Math.max` protege contra um relato fora de ordem — o contador só
   * pode subir.
   */
  recordRetries: (provider, total) =>
    set((state) => {
      const run = state.queue.runs[provider];
      if (run === undefined || run.outcome !== null) return state;
      const next = Math.max(run.retriesUsed, total);
      if (next === run.retriesUsed) return state;
      return { queue: replaceRun(state.queue, { ...run, retriesUsed: next }) };
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
