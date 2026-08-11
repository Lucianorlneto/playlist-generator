import { motion, useReducedMotion } from 'motion/react';

/**
 * Os dois extremos da pulsação (009/FR-015, 009/contracts/motion.md §2.2).
 *
 * **A barra nunca chega a zero.** O esqueleto existe para ocupar espaço
 * visível; uma barra que some periodicamente pisca o cartão inteiro, que é o
 * oposto do papel dela.
 */
const OPACIDADE_CHEIA = 1;
const OPACIDADE_MINIMA = 0.5;

/** Ida e volta, em segundos. */
const CICLO = 1.2;

export interface PulsingBarProps {
  /** Dimensão e tinta da barra. Vêm do chamador, da camada de tokens. */
  readonly className: string;
}

/**
 * Pulsação contínua de uma barra de esqueleto (009/FR-015).
 *
 * **Todas as instâncias pulsam em fase única, sem defasagem.** É decisão, não
 * simplificação: oito barras defasadas produzem uma onda que puxa o olho para a
 * grade — exatamente o oposto do papel dela, que é reservar espaço sem pedir
 * atenção. A fase é única porque as oito montam no mesmo quadro e nenhuma
 * recebe `delay`.
 *
 * Só `opacity` anima (FR-017a). A grade inteira é `aria-hidden` no chamador, de
 * modo que nada aqui é anunciado.
 */
export function PulsingBar({ className }: PulsingBarProps) {
  const reduzido = useReducedMotion();

  // O estado final estático é a barra **cheia** — visível, ocupando o espaço
  // que ela existe para reservar. Ver o comentário de `SpinningDisc` sobre por
  // que a regra de CSS global não bastaria (009/research §R6).
  if (reduzido === true) return <div className={className} />;

  return (
    <motion.div
      className={className}
      animate={{ opacity: [OPACIDADE_CHEIA, OPACIDADE_MINIMA, OPACIDADE_CHEIA] }}
      transition={{ duration: CICLO, ease: 'easeInOut', repeat: Infinity, repeatType: 'loop' }}
    />
  );
}
