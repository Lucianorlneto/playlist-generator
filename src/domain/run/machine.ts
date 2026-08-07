/**
 * Ciclo de um serviço como redutor puro (research §12, FR-016 a FR-021).
 *
 * ```text
 * pending → connect → estimate? → search → review → creating → done
 *                                                            ↘ skipped | failed
 * ```
 *
 * Por que redutor e não estado derivado da árvore de componentes: a fila e o
 * ciclo carregam quase todas as regras de FR-016 a FR-021 e os desfechos de
 * FR-040. Como função pura, cada uma delas é verificável por teste unitário sem
 * DOM — que é o que o Princípio III pede e o Princípio IV cobra.
 *
 * **Invariante R2**: uma execução com `outcome !== null` é imutável. `reduceRun`
 * sobre ela é a identidade. É o que impede que a revisão do segundo serviço
 * reescreva retroativamente o relato do primeiro (SC-018).
 *
 * **Nenhuma transição alcança `creating` sem `review_confirmed`** daquele
 * serviço (FR-019, Princípio V). Confirmar o primeiro destino não libera escrita
 * no segundo: cada `ServiceRun` tem seu próprio evento.
 */

import { capabilitiesOf } from '@/domain/providers';
import type {
  AppErrorInfo,
  CreationProgress,
  CreationResult,
  MatchItem,
  QuotaEstimate,
  RunOutcome,
  RunPhase,
  ServiceRun,
} from '@/domain/types';

export type RunEvent =
  | { type: 'started' }
  | { type: 'authorized' }
  | { type: 'estimate_ready'; estimate: QuotaEstimate }
  | { type: 'estimate_ok' }
  | { type: 'estimate_blocked' }
  | { type: 'lines_reduced'; lineIds: string[] }
  | { type: 'search_done'; items: MatchItem[] }
  | { type: 'items_changed'; items: MatchItem[] }
  | { type: 'review_confirmed' }
  | { type: 'creation_started'; creation: CreationProgress }
  | { type: 'creation_progress'; creation: CreationProgress }
  | { type: 'created'; result: CreationResult }
  | { type: 'quota_exhausted'; result: CreationResult | null; error: AppErrorInfo }
  | { type: 'skipped' }
  | { type: 'failed'; error: AppErrorInfo };

/** Fases em que a execução ainda não encerrou. */
const OPEN_PHASES: readonly RunPhase[] = [
  'connect',
  'estimate',
  'search',
  'review',
  'creating',
];

export function isActive(run: ServiceRun): boolean {
  return OPEN_PHASES.includes(run.phase);
}

export function isFinished(run: ServiceRun): boolean {
  return run.outcome !== null;
}

export function emptyRun(provider: ServiceRun['provider'], lineIds: string[]): ServiceRun {
  return {
    provider,
    phase: 'pending',
    lineIds,
    items: [],
    frozenLines: null,
    estimate: null,
    creation: null,
    result: null,
    outcome: null,
    error: null,
    retriesUsed: 0,
  };
}

/**
 * Desfecho pelos critérios de FR-040, **sem limiar percentual**: a fronteira
 * entre "parcial" e "falhou" é a existência da playlist na conta, não uma
 * porcentagem arbitrária.
 */
export function outcomeOf(run: ServiceRun): RunOutcome {
  if (run.outcome !== null) return run.outcome;
  if (run.phase === 'skipped') return 'skipped';
  if (run.result === null) return 'failed';

  const expected = run.creation?.orderedUris.length ?? run.result.addedCount;
  return run.result.addedCount >= expected ? 'completed' : 'partial';
}

/** A fase de estimativa só existe para provedor com orçamento diário (FR-029). */
export function needsEstimate(run: ServiceRun): boolean {
  return capabilitiesOf(run.provider).quota !== null;
}

function finish(run: ServiceRun, phase: RunPhase, outcome: RunOutcome): ServiceRun {
  return { ...run, phase, outcome };
}

export function reduceRun(run: ServiceRun, event: RunEvent): ServiceRun {
  // Execução encerrada é imutável (R2). Nada a decidir, nada a registrar.
  if (isFinished(run)) return run;

  switch (event.type) {
    case 'started':
      return run.phase === 'pending' ? { ...run, phase: 'connect' } : run;

    case 'authorized': {
      if (run.phase !== 'connect') return run;
      return { ...run, phase: needsEstimate(run) ? 'estimate' : 'search' };
    }

    case 'estimate_ready':
      return run.phase === 'estimate' ? { ...run, estimate: event.estimate } : run;

    case 'estimate_ok':
      // Um destino sem nenhuma linha é apresentado como pulado, não iniciado
      // (invariante R5).
      if (run.phase !== 'estimate') return run;
      if (run.lineIds.length === 0) return finish(run, 'skipped', 'skipped');
      return { ...run, phase: 'search' };

    case 'estimate_blocked':
      // Permanece em `estimate`: o bloqueio oferece duas saídas e nenhuma delas
      // é avançar. **Nenhuma busca é emitida** (invariante O3, SC-008).
      return run.phase === 'estimate' ? run : run;

    case 'lines_reduced': {
      // Só antes da busca daquele destino, e só por remoção — a validação de
      // subconjunto é responsabilidade de quem emite o evento (FR-013).
      if (run.phase !== 'estimate' && run.phase !== 'pending' && run.phase !== 'connect') return run;
      return { ...run, lineIds: [...event.lineIds] };
    }

    case 'search_done':
      if (run.phase !== 'search') return run;
      return { ...run, phase: 'review', items: event.items };

    case 'items_changed':
      // Revisão em andamento: decisões locais àquela execução (invariante M1).
      return run.phase === 'review' ? { ...run, items: event.items } : run;

    case 'review_confirmed':
      // **O único caminho para `creating`.** Sem este evento, daquele serviço,
      // nenhuma escrita acontece (FR-019, Princípio V).
      return run.phase === 'review' ? { ...run, phase: 'creating' } : run;

    case 'creation_started':
    case 'creation_progress':
      return run.phase === 'creating' ? { ...run, creation: event.creation } : run;

    case 'created': {
      if (run.phase !== 'creating') return run;
      const withResult = { ...run, result: event.result };
      return finish(withResult, 'done', outcomeOf(withResult));
    }

    case 'quota_exhausted': {
      // Encerra **sem repetir** (FR-031, SC-009). Se a playlist chegou a
      // existir, o desfecho é parcial e ela não é removida (FR-032).
      const withResult = { ...run, result: event.result ?? run.result, error: event.error };
      return finish(withResult, withResult.result === null ? 'failed' : 'done', outcomeOf(withResult));
    }

    case 'skipped':
      return finish(run, 'skipped', 'skipped');

    case 'failed': {
      const withError = { ...run, error: event.error };
      // Falhar depois de a playlist existir é "parcial", não "falhou" (FR-040).
      return finish(withError, 'failed', withError.result === null ? 'failed' : 'partial');
    }

    default:
      return run;
  }
}
