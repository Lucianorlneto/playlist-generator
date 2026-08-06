/**
 * Persistência seletiva do rascunho de trabalho.
 *
 * O recorte é literal: só os campos de `WorkDraft` saem do store para o disco.
 * Token, Client ID e estado transitório (controlador de cancelamento, progresso
 * da busca) ficam de fora por construção — é o que sustenta o invariante 2 de
 * contracts/storage.md.
 *
 * Duas velocidades de gravação, deliberadamente:
 * - **debounce de 500 ms** para digitação, revisão e configuração;
 * - **gravação síncrona, sem debounce** em dois gatilhos:
 *   1. `creation.committedItems` muda em qualquer execução. Um item confirmado
 *      que ficasse pendurado em um timer poderia ser perdido no fechamento da
 *      aba, e a retomada reenviaria faixas já adicionadas — exatamente o que
 *      SC-010 proíbe.
 *   2. **uma execução encerra** (`outcome` deixa de ser nulo). O desfecho é
 *      terminal: não haverá nova gravação que o registre depois. No encerramento
 *      por cota isso é decisivo — o rascunho é preservado justamente para
 *      relatar (FR-038), e perder o relato deixaria a reabertura mostrando uma
 *      execução ainda em andamento enquanto a playlist incompleta já existe na
 *      conta do usuário (FR-032).
 *
 * Nota de desenho: a gravação passa por `draftRepo`, não pelo middleware
 * `persist` do Zustand. O repositório é quem detém a serialização campo a campo,
 * a validação de forma na leitura e a degradação em três passos por cota — nada
 * disso cabe em um `StateStorage`, que só enxerga uma string opaca.
 */

import { PROVIDER_ORDER } from '@/domain/providers';
import { SCHEMA_VERSION, type WorkDraft } from '@/domain/types';
import { saveDraft, type SaveDraftOutcome } from '@/services/storage/draftRepo';

import { useAppStore } from './index';
import type { AppState } from './types';

export const DRAFT_DEBOUNCE_MS = 500;

/** Recorte do estado que vai para o disco. */
export function toWorkDraft(state: AppState): WorkDraft {
  return {
    schemaVersion: SCHEMA_VERSION,
    savedAt: Date.now(),
    step: state.step,
    rawText: state.rawText,
    lines: state.lines,
    playlistConfig: state.playlistConfig,
    destinations: state.destinations,
    queue: state.queue,
  };
}

/** Soma dos itens confirmados em todas as execuções — primeiro gatilho síncrono. */
function committedTotal(state: AppState): number {
  let total = 0;
  for (const provider of PROVIDER_ORDER) {
    total += state.queue.runs[provider]?.creation?.committedItems ?? 0;
  }
  return total;
}

/** Assinatura dos desfechos — segundo gatilho síncrono. */
function outcomeSignature(state: AppState): string {
  return PROVIDER_ORDER.map((provider) => state.queue.runs[provider]?.outcome ?? '-').join('|');
}

function applyOutcome(outcome: SaveDraftOutcome): void {
  const { draftNotice, setDraftNotice } = useAppStore.getState();
  if (outcome === 'degraded' && draftNotice !== 'quota_degraded') {
    setDraftNotice('quota_degraded');
    return;
  }
  if (outcome === 'failed' && draftNotice !== 'quota_failed') {
    setDraftNotice('quota_failed');
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;

function cancelPending(): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
}

/** Gravação imediata. Usada após cada item confirmado e ao sair da página. */
export function flushDraftNow(state: AppState = useAppStore.getState()): SaveDraftOutcome {
  cancelPending();
  const outcome = saveDraft(toWorkDraft(state));
  applyOutcome(outcome);
  return outcome;
}

function scheduleSave(): void {
  cancelPending();
  timer = setTimeout(() => {
    timer = null;
    const outcome = saveDraft(toWorkDraft(useAppStore.getState()));
    applyOutcome(outcome);
  }, DRAFT_DEBOUNCE_MS);
}

/**
 * Liga a persistência ao store. Devolve a função que a desliga — usada em teste
 * e por qualquer futuro desmonte da aplicação.
 */
export function attachDraftPersistence(): () => void {
  let previous = useAppStore.getState();
  let previousCommitted = committedTotal(previous);
  let previousOutcomes = outcomeSignature(previous);

  const unsubscribe = useAppStore.subscribe((state) => {
    const committed = committedTotal(state);
    const outcomes = outcomeSignature(state);
    const committedChanged = committed !== previousCommitted;
    const outcomeChanged = outcomes !== previousOutcomes;
    const draftChanged =
      state.rawText !== previous.rawText ||
      state.lines !== previous.lines ||
      state.playlistConfig !== previous.playlistConfig ||
      state.destinations !== previous.destinations ||
      state.queue !== previous.queue ||
      state.step !== previous.step;

    previous = state;
    previousCommitted = committed;
    previousOutcomes = outcomes;

    if (committedChanged || outcomeChanged) {
      flushDraftNow(state);
      return;
    }
    if (draftChanged) scheduleSave();
  });

  return () => {
    cancelPending();
    unsubscribe();
  };
}
