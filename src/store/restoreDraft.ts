/**
 * Restauração do rascunho na inicialização (FR-037 a FR-039, FR-042).
 *
 * A retomada volta ao **serviço e à etapa exatos** (invariante W3): a fila
 * gravada já carrega `currentIndex` e a fase de cada execução, e o resultado dos
 * serviços concluídos vem intacto (SC-014).
 *
 * Nada é aplicado em silêncio: o banner informa que um trabalho anterior foi
 * recuperado e oferece descartar.
 */

import { loadDraft } from '@/services/storage/draftRepo';

import { useAppStore } from './index';

export interface RestoreOutcome {
  restored: boolean;
  /** `true` quando o rascunho veio da v1 e foi convertido (FR-042). */
  migrated: boolean;
}

export function restoreDraft(migrated = false): RestoreOutcome {
  const draft = loadDraft();
  if (draft === null) return { restored: false, migrated: false };

  const hasWork =
    draft.rawText.trim() !== '' ||
    draft.lines.length > 0 ||
    draft.queue.order.some((provider) => {
      const run = draft.queue.runs[provider];
      return run !== undefined && (run.items.length > 0 || run.creation !== null);
    });

  if (!hasWork) return { restored: false, migrated: false };

  useAppStore.setState({
    rawText: draft.rawText,
    lines: draft.lines,
    playlistConfig: draft.playlistConfig,
    destinations: draft.destinations,
    queue: draft.queue,
    step: draft.step,
    draftNotice: migrated ? 'migrated' : 'recovered',
    draftSavedAt: draft.savedAt,
  });

  return { restored: true, migrated };
}
