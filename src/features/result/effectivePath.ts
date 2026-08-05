import { t } from '@/i18n/pt-BR';

/**
 * Caminho efetivo real da playlist (FR-036).
 *
 * A plataforma não expõe pastas para aplicações de terceiros, então este é o
 * único caminho que existe de fato: a raiz da biblioteca do usuário. Exibi-lo
 * antes e depois da criação é o que evita a expectativa de escolher pasta —
 * expectativa que FR-038 proíbe simular.
 */
export function effectivePath(displayName: string, playlistName: string): string {
  return `${t.result.libraryRoot} / ${displayName} / ${playlistName.trim()}`;
}
