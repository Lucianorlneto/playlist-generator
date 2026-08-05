/**
 * Consulta dos nomes de playlist já existentes (FR-029).
 *
 * A falha aqui **bloqueia** a criação com opção de repetir. Criar sem ter
 * concluído a verificação produziria exatamente a playlist duplicada que o
 * requisito existe para impedir (edge case da spec: nunca criar às cegas).
 */

import { toAppError } from '@/services/spotify/errors';
import { listMyPlaylistNames } from '@/services/spotify/playlists';
import { useAppStore } from '@/store';

export async function refreshExistingNames(signal?: AbortSignal): Promise<string[] | null> {
  const store = useAppStore.getState();
  const session = store.session;
  if (session === null) return null;

  store.setNameCheckRunning(true);
  try {
    const names = await listMyPlaylistNames(session.user.id, signal);
    useAppStore.getState().setExistingNames(names);
    useAppStore.getState().setNameCheckRunning(false);
    return names;
  } catch (error) {
    useAppStore.getState().setExistingNames(null);
    useAppStore.getState().setNameCheckError(toAppError(error));
    return null;
  }
}
