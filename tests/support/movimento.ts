import { vi } from 'vitest';

/**
 * A preferência de movimento, dirigida por evento.
 *
 * **Por que não basta trocar o `matchMedia` antes de cada render.** A biblioteca
 * de movimento lê a preferência **uma única vez**, na primeira chamada de
 * `useReducedMotion` do processo: ela trava um sinalizador global, guarda o
 * valor num módulo e daí em diante só o atualiza pelo evento `change` da própria
 * `MediaQueryList`. Um stub instalado depois disso nunca seria consultado, e o
 * teste passaria medindo o estado errado.
 *
 * Então o stub é instalado **antes de qualquer render** e permanece o mesmo o
 * arquivo inteiro; o que muda é o valor da preferência, notificado aos ouvintes
 * que a biblioteca registrou.
 *
 * O molde é o de `tests/components/creating-card.spec.tsx`, escrito na 009. Ele
 * virou módulo aqui porque a 010 leva movimento a cinco superfícies novas, e
 * cinco cópias da mesma armadilha é como uma delas fica sutilmente diferente.
 */

let reduzir = false;
const ouvintes = new Set<() => void>();

/** Chame **no topo do arquivo de teste**, antes de qualquer `render`. */
export function instalarPreferenciaDeMovimento(): void {
  vi.stubGlobal(
    'matchMedia',
    (query: string): MediaQueryList =>
      ({
        get matches() {
          return reduzir && query.includes('prefers-reduced-motion');
        },
        media: query,
        onchange: null,
        addEventListener: (_evento: string, ouvinte: () => void) => {
          ouvintes.add(ouvinte);
        },
        removeEventListener: (_evento: string, ouvinte: () => void) => {
          ouvintes.delete(ouvinte);
        },
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
}

/** Troca a preferência e avisa quem a biblioteca inscreveu. */
export function preferirMovimentoReduzido(valor: boolean): void {
  reduzir = valor;
  for (const ouvinte of ouvintes) ouvinte();
}
