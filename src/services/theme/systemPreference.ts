/**
 * A única porta para `matchMedia` (Princípio III).
 *
 * Encapsular aqui é o que permite ao domínio ficar puro e ao teste alternar a
 * preferência do sistema sem mexer em objeto global — e o que garante que a
 * ausência de `matchMedia` (ambiente de teste, navegador antigo) degrade para
 * "claro" em vez de derrubar o arranque.
 */

const QUERY = '(prefers-color-scheme: dark)';

function mediaQuery(): MediaQueryList | null {
  if (typeof globalThis.matchMedia !== 'function') return null;
  try {
    return globalThis.matchMedia(QUERY);
  } catch {
    return null;
  }
}

/** O sistema pede tema escuro agora? */
export function systemPrefersDark(): boolean {
  return mediaQuery()?.matches ?? false;
}

/**
 * Assina mudanças na preferência do sistema. Devolve a função de cancelamento.
 *
 * O evento é entregue sempre; **decidir ignorá-lo quando a preferência é
 * manual é responsabilidade de quem assina**, não desta camada. É o que mantém
 * a regra de FR-009 num só lugar — a função pura `resolveTheme` — em vez de
 * espalhada entre o serviço e o estado.
 */
export function subscribeToSystemPreference(listener: (prefersDark: boolean) => void): () => void {
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
