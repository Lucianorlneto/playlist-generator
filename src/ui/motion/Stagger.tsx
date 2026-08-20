import { animate, useReducedMotion } from 'motion/react';
import { useLayoutEffect, useRef } from 'react';

import type { ReactNode, Ref } from 'react';

import { atrasoEscalonado, CURVA, DURACAO } from './scale';

/**
 * Os dois papéis, e eles são fechados (FR-004,
 * `010/contracts/motion-catalog.md` §2.2).
 *
 * | Papel | Quem pede |
 * | --- | --- |
 * | `enter` | lista de correspondências da revisão; aviso de recuperação de rascunho |
 * | `decor` | faixa de adesivos de Destinos |
 *
 * Um terceiro papel exige entrada nova nesta tabela, na do contrato e no teste
 * de identidade — a mesma disciplina de `<Icon role="…" />`. **Nenhuma
 * superfície configura duração, curva ou atraso**: quem precisa de tempo próprio
 * não ganha um parâmetro, vira papel.
 *
 * `enter` serve **um ou mais** irmãos: com um só a fórmula devolve defasagem
 * zero e o papel degenera em entrada simples. É por isso que o aviso de rascunho
 * não custa entrada nova no catálogo (FR-021b).
 */
const PAPEL = {
  enter: { opacity: [0, 1], y: [8, 0] },
  decor: { opacity: [0, 1], scale: [0.92, 1] },
};

export interface StaggerProps {
  /** O papel, nunca o tempo. */
  readonly role: keyof typeof PAPEL;
  /**
   * O elemento do contêiner, de um conjunto fechado.
   *
   * **Não é configuração de animação — é semântica de documento**, e por isso é
   * a única variação estrutural que a primitiva aceita. Ela existe porque o
   * contêiner tem de ser o elemento do chamador: um envoltório genérico dentro
   * de uma `<ul>` produziria `ul > div > li`, que reprova na regra `list` do
   * axe, e um envoltório em volta de cada adesivo criaria bloco de contenção
   * para os `position: absolute` deles e desmontaria a composição.
   */
  readonly as: 'ul' | 'div';
  readonly className?: string;
  /** Nome acessível, quando o contêiner é uma lista. */
  readonly label?: string;
  /** Camada sem informação: some inteira da árvore de acessibilidade. */
  readonly decorative?: boolean;
  /**
   * Referência ao contêiner, para quem precisa do mesmo nó.
   *
   * Existe por um consumidor só: `Settle`, que não cria elemento e pendura a
   * referência dele no que o chamador já escreveu. Sem isto, uma lista que
   * entra escalonada **e** acomoda depois teria dois contêineres — e dentro de
   * uma `<ul>` um contêiner a mais é violação séria da regra `list` do axe.
   */
  readonly ref?: Ref<HTMLElement>;
  /** Os irmãos a escalonar. Cada um entra como o próprio elemento dele. */
  readonly children: ReactNode;
}

/**
 * Entrada escalonada com teto (FR-013, SC-009; `010/contracts/motion-catalog.md` §2).
 *
 * ## O que é escalonado, e por que não há envoltório por irmão
 *
 * A primitiva anima os **filhos diretos do contêiner**, que continuam sendo os
 * elementos que o chamador escreveu — `<li>` na revisão, `<img>` nos adesivos.
 * Envolver cada irmão num `motion.div` teria dois custos concretos e nenhum
 * ganho: `ul > div > li` é violação séria na regra `list` do axe, e um
 * envoltório com `transform` vira bloco de contenção para descendente
 * `position: absolute` — o que moveria os onze adesivos para o canto de uma
 * caixa de altura zero.
 *
 * O contêiner é o único elemento que a primitiva cria, e ele é o que o chamador
 * já ia escrever de qualquer forma.
 *
 * ## Só o que acabou de montar anima
 *
 * O `WeakSet` guarda os nós que já entraram em cena. É o que faz o FR-026a valer
 * sem tratamento especial: numa **execução retomada**, as linhas que já estavam
 * na tela antes da busca não remontam, logo não estão fora do conjunto, logo não
 * animam. E é o que permite a lista chegar inteira em `search_done` — cento e
 * vinte nós novos de uma vez — e ser escalonada como um lote só.
 *
 * O índice da defasagem é o do irmão **dentro do lote que entrou**, não o da
 * lista inteira: uma linha que aparecesse sozinha depois não deve esperar o teto.
 *
 * ## Nenhum estado inicial é escrito à mão
 *
 * O primeiro quadro de cada animação é o `0` do próprio keyframe, e não uma
 * opacidade zerada por este componente antes de animar. A diferença é o modo de
 * falha: com a opacidade zerada aqui, uma animação que não chegasse a rodar
 * deixaria o conteúdo **invisível para sempre** — perda de informação, que é o
 * que o FR-015 proíbe. Do jeito que está, o estado em repouso do DOM já é o
 * estado final, e a animação é puramente aditiva.
 *
 * `useLayoutEffect` e não `useEffect` pela mesma família de razão: ele roda
 * antes da pintura, de modo que o primeiro quadro do keyframe é o primeiro
 * quadro que aparece.
 */
export function Stagger({
  role,
  as,
  className,
  label,
  decorative,
  ref,
  children,
}: StaggerProps) {
  const reduzido = useReducedMotion();
  /*
    `useRef` e o `animate` avulso, e não o par `useAnimate`: o escopo daquele
    hook é somente-leitura, e este contêiner precisa aceitar **duas**
    referências — a própria e a de quem compõe, `Settle`.
  */
  const raiz = useRef<HTMLElement | null>(null);
  const jaEmCena = useRef(new WeakSet<Element>());

  /*
    Sem lista de dependências, de propósito: o gatilho não é uma prop, é a
    chegada de nós novos ao contêiner — e ela acontece num render em que
    `children` pode ser uma referência nova sem que nada tenha entrado. A
    varredura é uma consulta a `WeakSet` por filho, e o `return` antecipado
    quando não há nada novo é o caso comum.
  */
  useLayoutEffect(() => {
    const no = raiz.current;
    if (no === null) return;

    const novos = [...no.children].filter((filho) => !jaEmCena.current.has(filho));
    for (const filho of novos) jaEmCena.current.add(filho);
    if (novos.length === 0) return;

    /*
      Movimento reduzido: os nós ficam marcados como já em cena — eles estão, e
      no estado final — e nenhuma animação é criada. A consulta é por primitiva
      porque nenhum interruptor de cima serve: a regra de CSS não alcança a
      biblioteca, e `MotionConfig reducedMotion="user"` **preserva** a `opacity`
      que o FR-014 manda suprimir (009/research §R6).
    */
    if (reduzido === true) return;

    void animate(novos, PAPEL[role], {
      duration: DURACAO.base,
      ease: CURVA.standard,
      // O índice é o da posição dentro do lote que acabou de entrar.
      delay: (indice: number) => atrasoEscalonado(indice),
    });
  });

  /** A referência própria e a de quem compõe, no mesmo nó. */
  const fixar = (no: HTMLElement | null) => {
    raiz.current = no;
    if (typeof ref === 'function') ref(no);
    else if (ref != null) ref.current = no;
  };

  if (as === 'ul') {
    return (
      <ul ref={fixar} className={className} aria-label={label}>
        {children}
      </ul>
    );
  }

  return (
    <div ref={fixar} className={className} aria-hidden={decorative === true ? 'true' : undefined}>
      {children}
    </div>
  );
}
