import { AnimatePresence, motion, useIsPresent, usePresenceData, useReducedMotion } from 'motion/react';

import type { ReactNode } from 'react';

import { CURVA, DURACAO } from './scale';

/**
 * O deslocamento horizontal da entrada e da saída, em pixels.
 *
 * Não é degrau da escala de tempo e não pertence a `scale.ts`: é uma distância,
 * e distância pequena o bastante para ler como direção sem ler como viagem. O
 * mesmo valor serve aos dois sentidos, com o sinal invertido.
 */
const DESLOCAMENTO = 16;

const TROCA = { duration: DURACAO.base, ease: CURVA.standard } as const;

export interface StepTransitionProps {
  /**
   * Identidade do que está em cena. **Trocar é o que dispara a transição**, e
   * manter é o que a impede — daí o `key` sair daqui e não de `children`.
   */
  readonly step: string;
  /**
   * `1` avanço, `-1` retorno, `0` nenhum dos dois.
   *
   * Vem de `stepDirection` em `src/domain/rail/`, que é onde a regra mora. Esta
   * primitiva desenha a direção; ela não a decide (Princípio III).
   */
  readonly direction: -1 | 0 | 1;
  readonly children: ReactNode;
}

/**
 * A tela da etapa que entra, e a que sai — FR-016, FR-017, FR-021, FR-022,
 * FR-024 (`010/contracts/surfaces.md` §1).
 *
 * ## Nenhum dos dois modos da biblioteca serve
 *
 * - **`mode="wait"`** monta o novo só depois que o antigo sai. `StepHeading`
 *   foca no efeito disparado por `focusToken`; o foco chegaria 200ms depois. É
 *   violação direta do FR-016 e do SC-008, e a mesma falha que a 009 já recusou
 *   no cartão de criação.
 * - **`mode="popLayout"`** faz o certo automaticamente, mas exige que o filho
 *   encaminhe `ref` até o nó do DOM — o que obrigaria as cinco telas de etapa a
 *   virarem `forwardRef`.
 *
 * O arranjo é o que `CrossFade` já usa e que `009/research §R7` já justifica: o
 * bloco que **sai** vai para `position: absolute`, e o que **entra** fica no
 * fluxo e define a altura. Com o envoltório sendo nosso, nenhuma `ref` atravessa
 * as telas, e o projeto passa a ter **um** mecanismo de saída fora de fluxo.
 *
 * ## A direção é lida por quem sai, não recebida como prop
 *
 * `usePresenceData()` devolve o `custom` que valia **quando o nó saiu**. Esse
 * mecanismo existe justamente para isto: uma prop mudaria embaixo dele, e a
 * etapa que sai voaria para o lado errado quando a direção seguinte fosse outra
 * (research §R6).
 *
 * ## A altura é a da etapa que entra, do primeiro quadro ao último
 *
 * Não é regressão — é o que já acontece hoje, e animar altura é proibido pelo
 * FR-009. O que o FR-023 proíbe é salto **causado pela transição**: ir à altura
 * do maior, ou a zero, e voltar. Nenhum dos dois ocorre neste arranjo
 * (contracts/surfaces.md §1.3).
 */
function Etapa({ children }: { readonly children: ReactNode }) {
  const presente = useIsPresent();

  /*
    `usePresenceData()` é tipado como `any` pela biblioteca porque o `custom` do
    `AnimatePresence` é livre. O estreitamento é nosso e explícito: o que chega
    aqui é o que `StepTransition` passa, e qualquer outra coisa vira `0` — que é
    "sem movimento", o padrão seguro.
  */
  const bruto: unknown = usePresenceData();
  const direcao = bruto === 1 || bruto === -1 ? bruto : 0;

  return (
    <motion.div
      data-etapa={presente ? 'entrando' : 'saindo'}
      /*
        O que sai fica **fora do fluxo**, e por isso não soma altura nem empurra
        a barra de ação. O que entra fica no fluxo e é ele que define a altura.

        Aqui a classe pode depender do nó que anima — diferente de `CrossFade`,
        onde ela precisava morar no envoltório: `useIsPresent()` assina o
        contexto de presença e **re-renderiza** o nó que saiu com o valor novo,
        de modo que ele já está absoluto quando a saída começa.

        A coluna do assistente distribui altura por `flex-1`, e quem entra tem de
        continuar recebendo essa altura: a etapa Destinos ancora a faixa de
        adesivos no pé da coluna com `mt-auto`, e um elo `block` no meio do
        caminho prenderia a folga acima dela, invisível.
      */
      className={presente ? 'flex min-w-0 grow flex-col' : 'absolute inset-x-0 top-0'}
      /*
        Por 200ms existem dois cabeçalhos de etapa e dois conjuntos de controles.
        Sem `inert` + `aria-hidden`, a transição alteraria a ordem de leitura e a
        contagem de controles alcançáveis — exatamente o que o FR-017 proíbe,
        ainda que por um quinto de segundo (contracts/surfaces.md §1.2).
      */
      inert={!presente}
      aria-hidden={presente ? undefined : 'true'}
      initial={{ opacity: 0, x: direcao * DESLOCAMENTO }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: direcao * -DESLOCAMENTO }}
      transition={TROCA}
    >
      {children}
    </motion.div>
  );
}

export function StepTransition({ step, direction, children }: StepTransitionProps) {
  const reduzido = useReducedMotion();

  /*
    Sob movimento reduzido a etapa que entra é o **único** conteúdo, no primeiro
    quadro: sem `AnimatePresence`, sem bloco de saída, sem deslocamento. O
    interruptor é JavaScript e não CSS porque a regra global de `index.css` não
    alcança a biblioteca, e `MotionConfig reducedMotion="user"` preservaria a
    `opacity` que o FR-014 manda suprimir (009/research §R6).
  */
  if (reduzido === true) {
    return <div className="relative flex min-w-0 grow flex-col">{children}</div>;
  }

  return (
    <div className="relative flex min-w-0 grow flex-col">
      {/*
        `initial={false}`: recarregar a página, voltar do retorno de autorização
        ou restaurar um rascunho **não é uma troca** e não deve animar (FR-024).
        É o precedente que `CrossFade` já estabeleceu, e `stepDirection` devolve
        `0` no mesmo caso pela mesma razão.

        Sem `mode`, de propósito: os dois que a biblioteca oferece foram
        descartados por motivo concreto, registrado acima.
      */}
      <AnimatePresence initial={false} custom={direction}>
        <Etapa key={step}>{children}</Etapa>
      </AnimatePresence>
    </div>
  );
}
