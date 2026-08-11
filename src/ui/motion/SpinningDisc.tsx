import { motion, useReducedMotion } from 'motion/react';

import type { ReactNode } from 'react';

export interface SpinningDiscProps {
  /** O glifo que gira. O disco tingido fica **fora**, no chamador. */
  readonly children: ReactNode;
}

/**
 * Giro contínuo do glifo de carregamento (009/FR-014, 009/contracts/motion.md §2.1).
 *
 * **Gira o glifo, não o disco.** O substrato tingido é circular, e girá-lo não
 * produziria movimento visível nenhum — é por isso que o disco fica no chamador
 * e só o conteúdo entra aqui.
 *
 * A cadência é a do `animate-spin` que `RateLimitWaiting` já usa na busca: uma
 * volta por segundo, temporização linear. O produto não deve ter duas
 * velocidades de giro para a mesma ideia.
 *
 * Só `rotate` anima, e `rotate` compila para `transform` — composta pela GPU sem
 * recálculo de layout (FR-017a). Isso não é higiene abstrata: esta tela anima
 * **enquanto uma requisição está em voo**, e o pior caso é o YouTube, que faz
 * uma requisição por faixa.
 */
export function SpinningDisc({ children }: SpinningDiscProps) {
  const reduzido = useReducedMotion();

  /*
    O interruptor é JavaScript e não CSS, e a diferença é material
    (009/research §R6): a regra global de `prefers-reduced-motion` em
    `index.css` zera `animation-duration` e `transition-duration`, e **não
    alcança esta biblioteca** — ela anima por WAAPI e por atualização de valor,
    não por `@keyframes` que o CSS possa encurtar.

    O estado final de uma volta completa é a identidade, então "estático" aqui é
    literalmente o glifo parado onde ele já estava.
  */
  if (reduzido === true) return <span className="inline-flex">{children}</span>;

  return (
    <motion.span
      className="inline-flex"
      animate={{ rotate: 360 }}
      transition={{ duration: 1, ease: 'linear', repeat: Infinity, repeatType: 'loop' }}
    >
      {children}
    </motion.span>
  );
}
