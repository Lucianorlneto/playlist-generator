/**
 * Restauração do rascunho na inicialização (FR-043, FR-044).
 *
 * A etapa salva é retomada como estava — inclusive quando o rascunho sobreviveu
 * a uma expiração de sessão. Nada é aplicado em silêncio: o banner informa que
 * um trabalho anterior foi recuperado e oferece descartar.
 */

import { loadDraft } from '@/services/storage/draftRepo';

import { useAppStore } from './index';

export function restoreDraft(): boolean {
  const draft = loadDraft();
  if (draft === null) return false;

  const vazio = draft.rawText.trim() === '' && draft.items.length === 0 && draft.creation === null;
  if (vazio) return false;

  useAppStore.setState({
    rawText: draft.rawText,
    items: draft.items,
    playlistConfig: draft.playlistConfig,
    creation: draft.creation,
    step: draft.step,
    draftNotice: 'recovered',
    draftSavedAt: draft.savedAt,
  });

  return true;
}
