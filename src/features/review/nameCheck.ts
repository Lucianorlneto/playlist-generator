/**
 * Consulta dos nomes de playlist já existentes, **local a cada serviço** (FR-022).
 *
 * A checagem vale por conta: um nome já usado no Spotify não impede a criação no
 * YouTube, e o inverso também. Por isso a lista é recarregada a cada serviço em
 * vez de acumulada — e por isso o bloqueio por nome duplicado invalida apenas
 * aquele destino, sem desfazer o que já foi criado no outro.
 *
 * A falha aqui **bloqueia** a criação daquele serviço com opção de repetir.
 * Criar sem ter concluído a verificação produziria exatamente a playlist
 * duplicada que o requisito existe para impedir.
 */

import type { ProviderId } from '@/domain/providers';
import { toAppError } from '@/services/providers/errors';
import { providerFor } from '@/services/providers/registry';
import { useAppStore } from '@/store';

export async function refreshExistingNames(
  provider: ProviderId,
  signal?: AbortSignal,
): Promise<string[] | null> {
  const store = useAppStore.getState();
  const session = store.sessions[provider];
  if (session === null) return null;

  store.setNameCheckRunning(true);
  try {
    const names = await providerFor(provider).listPlaylistNames(session, signal);
    useAppStore.getState().setExistingNames(names);
    useAppStore.getState().setNameCheckRunning(false);
    return names;
  } catch (error) {
    useAppStore.getState().setExistingNames(null);
    useAppStore.getState().setNameCheckError(toAppError(error, provider));
    return null;
  }
}
