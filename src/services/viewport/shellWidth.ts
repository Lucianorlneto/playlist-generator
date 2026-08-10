/**
 * A porta para a consulta de largura da casca (Princípio III).
 *
 * Mesmo desenho de `src/services/theme/systemPreference.ts`, e pela mesma razão:
 * `matchMedia` é I/O do ambiente, e encapsulá-lo é o que permite ao componente
 * ficar declarativo, ao teste alternar a largura sem mexer em objeto global, e à
 * ausência de `matchMedia` degradar em vez de derrubar o arranque.
 *
 * A degradação escolhida é **casca ampla**. Sem a consulta, todas as três zonas
 * são renderizadas: perder a trilha por falta de uma API do navegador seria
 * esconder informação por causa de uma limitação técnica, que é exatamente o
 * oposto do que a degradação deve fazer.
 */

import { SHELL_BREAKPOINT_REM } from '@/styles/breakpoints';

const QUERY = `(width < ${String(SHELL_BREAKPOINT_REM)}rem)`;

function mediaQuery(): MediaQueryList | null {
  if (typeof globalThis.matchMedia !== 'function') return null;
  try {
    return globalThis.matchMedia(QUERY);
  } catch {
    return null;
  }
}

/** A largura está abaixo do ponto de corte da casca agora? */
export function isNarrowShell(): boolean {
  return mediaQuery()?.matches ?? false;
}

/** Assina mudanças de largura. Devolve a função de cancelamento. */
export function subscribeToShellWidth(listener: (narrow: boolean) => void): () => void {
  const query = mediaQuery();
  if (query === null) return () => undefined;

  const handler = (event: MediaQueryListEvent): void => {
    listener(event.matches);
  };

  // `addListener` é o caminho legado; Safari só ganhou `addEventListener` aqui
  // na 14. Manter os dois custa três linhas e evita um recurso que falha só em
  // navegador antigo, onde ninguém testa.
  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', handler);
    return () => {
      query.removeEventListener('change', handler);
    };
  }

  query.addListener(handler);
  return () => {
    query.removeListener(handler);
  };
}
