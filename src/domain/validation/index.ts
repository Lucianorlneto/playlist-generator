/**
 * Validações que antecedem a criação (FR-028, FR-029, FR-035).
 *
 * As quatro regras são aplicadas na ordem de data-model.md. A quarta — "a
 * consulta de playlists existentes concluiu" — é o que impede a criação às
 * cegas: sem a lista de nomes não há como cumprir FR-029, e criar assim mesmo
 * produziria a playlist duplicada que o requisito existe para evitar.
 */

import type { MatchItem, PlaylistConfig, ValidationResult } from '@/domain/types';

const OK: ValidationResult = { ok: true };

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
