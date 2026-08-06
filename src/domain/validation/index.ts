/**
 * Validações que antecedem a criação (FR-028, FR-029, FR-035).
 *
 * As quatro regras são aplicadas na ordem de data-model.md. A quarta — "a
 * consulta de playlists existentes concluiu" — é o que impede a criação às
 * cegas: sem a lista de nomes não há como cumprir FR-029, e criar assim mesmo
 * produziria a playlist duplicada que o requisito existe para evitar.
 */

import type { ProviderId } from '@/domain/providers';
import { isSubsetOf } from '@/domain/run/lines';
import { providersWithCredential } from '@/domain/run/selection';
import type {
  Credential,
  DestinationSelection,
  MatchItem,
  PlaylistConfig,
  QuotaEstimate,
  ValidationResult,
} from '@/domain/types';

const OK: ValidationResult = { ok: true };

// ---------------------------------------------------------------------------
// Configuração e destinos (FR-002, FR-011, FR-012, FR-013)
// ---------------------------------------------------------------------------

/**
 * FR-002: ao menos **uma** credencial cadastrada para sair da configuração.
 *
 * Nenhum serviço é obrigatório isoladamente — é o que separa esta feature da
 * 001, onde o Spotify era a única saída.
 */
export function validateAtLeastOneCredential(
  credentials: Record<ProviderId, Credential | null>,
): ValidationResult {
  if (providersWithCredential(credentials).length === 0) {
    return { ok: false, reason: 'no_credential', messageKey: 'credential.noneSaved' };
  }
  return OK;
}

/** FR-011: ao menos um destino selecionado para avançar. */
export function validateSelection(selection: DestinationSelection): ValidationResult {
  if (selection.selected.length === 0) {
    return { ok: false, reason: 'no_destination', messageKey: 'destinations.noneSelected' };
  }
  return OK;
}

/** FR-012: a seleção trava quando a primeira criação começa. */
export function validateSelectionEditable(selection: DestinationSelection): ValidationResult {
  if (selection.locked) {
    return { ok: false, reason: 'selection_locked', messageKey: 'destinations.lockedNotice' };
  }
  return OK;
}

/** FR-013: redução válida — subconjunto ordenado, nunca acréscimo ou alteração. */
export function validateReduction(
  previous: readonly string[],
  next: readonly string[],
): ValidationResult {
  if (!isSubsetOf(previous, next)) {
    return { ok: false, reason: 'not_a_subset', messageKey: 'reduction.notASubset' };
  }
  return OK;
}

/** FR-029: a estimativa que excede o saldo bloqueia o destino antes de buscar. */
export function validateQuota(estimate: QuotaEstimate | null): ValidationResult {
  if (estimate !== null && estimate.blocked) {
    return { ok: false, reason: 'quota_blocked', messageKey: 'quota.blockedHeading' };
  }
  return OK;
}

/** Comparação de FR-029: ignora caixa e espaços de borda. */
export function normalizePlaylistName(name: string): string {
  return name.trim().toLocaleLowerCase('pt-BR');
}

/**
 * @param existingNames nomes das playlists **do próprio usuário**; `null`
 *   significa que a consulta ainda não concluiu com sucesso.
 */
export function validatePlaylistName(
  name: string,
  existingNames: string[] | null,
): ValidationResult {
  if (name.trim() === '') {
    return { ok: false, reason: 'name_empty', messageKey: 'playlistConfig.nameRequired' };
  }

  if (existingNames === null) {
    return {
      ok: false,
      reason: 'name_check_incomplete',
      messageKey: 'errors.playlistListFailed',
    };
  }

  const target = normalizePlaylistName(name);
  const taken = existingNames.some((existing) => normalizePlaylistName(existing) === target);
  if (taken) {
    return { ok: false, reason: 'name_duplicate', messageKey: 'playlistConfig.nameDuplicate' };
  }

  return OK;
}

export function hasSelection(items: MatchItem[]): boolean {
  return items.some((item) => item.included && item.selectedUri !== null);
}

export function canCreate(
  items: MatchItem[],
  config: PlaylistConfig,
  existingNames: string[] | null,
): ValidationResult {
  if (config.name.trim() === '') {
    return { ok: false, reason: 'name_empty', messageKey: 'playlistConfig.nameRequired' };
  }

  if (existingNames !== null) {
    const target = normalizePlaylistName(config.name);
    if (existingNames.some((existing) => normalizePlaylistName(existing) === target)) {
      return { ok: false, reason: 'name_duplicate', messageKey: 'playlistConfig.nameDuplicate' };
    }
  }

  if (!hasSelection(items)) {
    return {
      ok: false,
      reason: 'no_tracks_selected',
      messageKey: 'playlistConfig.noTracksSelected',
    };
  }

  if (existingNames === null) {
    return {
      ok: false,
      reason: 'name_check_incomplete',
      messageKey: 'errors.playlistListFailed',
    };
  }

  return OK;
}
