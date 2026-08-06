/**
 * Caminho efetivo real da playlist, **por provedor** (FR-027).
 *
 * Nenhuma das duas plataformas expõe pastas a aplicações de terceiros, e cada
 * uma chama sua raiz de um jeito: "Sua Biblioteca / {conta}" no Spotify, "Você /
 * Playlists" no YouTube. Exibir o caminho real antes e depois da criação é o que
 * evita a expectativa de escolher pasta — expectativa que o Princípio de
 * honestidade proíbe simular.
 *
 * O texto vem do adaptador, não daqui: inventar um caminho plausível seria
 * exatamente o tipo de simulação que a constituição veda.
 */

import type { ProviderId } from '@/domain/providers';
import { providerFor } from '@/services/providers/registry';

export function effectivePath(
  provider: ProviderId,
  displayName: string,
  playlistName: string,
): string {
  return providerFor(provider).effectivePath(displayName, playlistName.trim());
}
