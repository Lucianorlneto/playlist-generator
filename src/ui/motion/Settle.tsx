import { animate, useReducedMotion } from 'motion/react';
import { Children, cloneElement, useCallback, useLayoutEffect, useRef } from 'react';

import type { ReactElement, Ref } from 'react';

import { CURVA, DURACAO } from './scale';

export interface SettleProps {
  /**
   * O portão de ociosidade. **Obrigatório e sem valor padrão** (FR-010a,
   * `010/contracts/motion-catalog.md` §4).
   *
   * Com `false`, os filhos são devolvidos sem animação **e sem medição**.
   *
   * Um padrão `true` faria o esquecimento abrir o portão, e o modo de falha de
   * um portão deve ser fechar. Um padrão `false` seria pior ainda: a primitiva
   * ficaria inerte em silêncio onde alguém esperava movimento.
   */
  readonly idle: boolean;
  /**
   * **Um único elemento**, que é o contêiner cujos filhos diretos acomodam.
   *
   * A primitiva não cria elemento nenhum: ela pendura uma referência no que o
   * chamador já escreveu. É o que permite `Settle` conviver com `Stagger` na
   * mesma lista — dois contêineres para o mesmo conjunto de irmãos seria um
   * envoltório a mais, e dentro de uma `<ul>` um envoltório é violação séria da
   * regra `list` do axe.
   */
  readonly children: ReactElement<{ ref?: Ref<HTMLElement> }>;
}

/**
 * Acomodação de posição em superfície ociosa — FR-010, FR-010a, FR-011
 * (`010/contracts/motion-catalog.md` §3 e §4).
 *
 * ## A única do catálogo que anima posição
 *
 * A 009 proibia animação de posição categoricamente. A proibição não foi
 * afrouxada: foi **substituída por uma fronteira**, com portão declarado por
 * quem chama. O que se preserva é a razão da proibição, não o texto — animação
 * de posição fica fora de todo momento com requisição em voo.
 *
 * ## A medição é o que custa, e é o que o portão fecha
 *
 * A técnica é FLIP: mede-se onde cada irmão estava, mede-se onde ele foi parar,
 * e a diferença é desfeita por transformação e animada de volta a zero. **A
 * composição é `translate`, nunca `top`/`left`** — mas o cálculo do delta exige
 * `getBoundingClientRect`, que força o navegador a resolver o layout pendente.
 *
 * É por isso que `idle={false}` não apenas deixa de animar: ele deixa de
 * **medir**, e descarta a linha de base. O primeiro render depois de o portão
 * reabrir estabelece a linha de base nova sem animar nada, que é o
 * comportamento certo — a mudança que aconteceu com o portão fechado não é uma
 * acomodação a mostrar.
 *
 * ## Por que um portão em vez de uma lista de arquivos permitidos
 *
 * Uma allowlist diria **onde** `Settle` pode aparecer. Não diria se ele está
 * ligado no momento errado — e a lista de revisão é exatamente uma superfície
 * que tem os dois momentos, com busca e sem busca (research §R8).
 */
export function Settle({ idle, children }: SettleProps) {
  const reduzido = useReducedMotion();
  const raiz = useRef<HTMLElement | null>(null);
  const linhaDeBase = useRef(new Map<Element, DOMRect>());

  const fixar = useCallback((no: HTMLElement | null) => {
    raiz.current = no;
  }, []);

  /*
    Sem lista de dependências: o gatilho é qualquer render que possa ter movido
    um irmão, e isso não é observável por prop nenhuma. O `return` antecipado com
    o portão fechado é o caminho barato, e é o comum enquanto há trabalho.
  */
  useLayoutEffect(() => {
    const no = raiz.current;
    if (no === null) return;

    if (idle === false || reduzido === true) {
      // A linha de base morre junto com o portão: retomá-la depois faria a
      // primeira acomodação animar um deslocamento que ninguém viu acontecer.
      linhaDeBase.current = new Map();
      return;
    }

    const antes = linhaDeBase.current;
    const agora = new Map<Element, DOMRect>();
    for (const irmao of no.children) agora.set(irmao, irmao.getBoundingClientRect());
    linhaDeBase.current = agora;

    for (const [irmao, depois] of agora) {
      const partida = antes.get(irmao);
      // Sem posição anterior o irmão acabou de entrar em cena — isso é entrada,
      // papel de `Stagger`, e não acomodação.
      if (partida === undefined) continue;

      const deslocamentoX = partida.left - depois.left;
      const deslocamentoY = partida.top - depois.top;
      if (deslocamentoX === 0 && deslocamentoY === 0) continue;

      void animate(
        irmao,
        { x: [deslocamentoX, 0], y: [deslocamentoY, 0] },
        { duration: DURACAO.settle, ease: CURVA.standard },
      );
    }
  });

  /*
    `useCallback` e não uma função inline: uma função de referência nova a cada
    render faria React chamá-la com `null` e de novo com o nó em toda passada,
    o que não quebra nada aqui mas é trabalho por nada.

    A supressão é necessária e o que ela cobre é preciso: a regra recusa
    **passar uma referência a uma função** durante o render, porque não tem como
    saber que a função não vai ler `.current`. `cloneElement` não lê — quem lê é
    o `useLayoutEffect` acima, depois da montagem, que é exatamente o que a
    regra existe para garantir. A alternativa seria esta primitiva criar um
    elemento próprio, e um envoltório dentro de uma `<ul>` é violação séria da
    regra `list` do axe.
  */
  // eslint-disable-next-line react-hooks/refs
  return cloneElement(Children.only(children), { ref: fixar });
}
