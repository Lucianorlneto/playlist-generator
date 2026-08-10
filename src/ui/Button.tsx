import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cx } from './cx';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'md' | 'sm';

/**
 * Variantes resolvidas por mapa explícito de literais. Nunca por concatenação:
 * uma classe montada em tempo de execução não é emitida no CSS e a falha só
 * aparece no build (research §14).
 *
 * ## Preenchimento sólido significa acionável — e principal
 *
 * FR-024 fecha a regra do sistema: fundo cheio é reservado à ação primária.
 * Estado usa fundo **tingido** com contorno, ícone e rótulo; nunca preenchimento.
 * É o que impede o selo "incerta", que é âmbar, de ser confundido com o botão de
 * avançar, que também é âmbar.
 *
 * `primary` é por isso a única variante com fundo cheio. `danger` tem contorno
 * na cor do estado e fundo de superfície — um botão destrutivo preenchido
 * competiria com a ação primária da mesma tela pela mesma pista visual.
 *
 * ## Nunca texto claro sobre o âmbar
 *
 * `--accent` em cheia saturação dá 1,7:1 contra branco. O par aprovado é
 * `--accent-ink` sobre `--accent`, e ele é o único que aparece aqui — verificado
 * por `tests/unit/contrast.spec.ts` (FR-022).
 */
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-deep disabled:hover:bg-accent',
  secondary: 'bg-surface text-ink border border-rule-strong hover:bg-surface-raised',
  danger: 'bg-surface text-state-missing border border-state-missing hover:bg-state-missing-tint',
  ghost: 'bg-transparent text-ink-muted hover:bg-surface-raised hover:text-ink',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  md: 'px-4 py-2 text-body',
  sm: 'px-3 py-1 text-meta',
};

/**
 * `rounded-control` e não `rounded-card`.
 *
 * A feature 005 usava o raio de cartão nos botões, quando os dois mediam a mesma
 * coisa. A 007 os separou — controle a 8px, cartão a 12px — e um botão com raio
 * de cartão passaria a parecer um cartão pequeno em vez de um controle
 * (`contracts/tokens.md` §4).
 */
const BASE_CLASSES =
  'focus-ring inline-flex items-center justify-center gap-2 rounded-control font-semibold ' +
  'transition-colors disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(BASE_CLASSES, VARIANT_CLASSES[variant], SIZE_CLASSES[size], className)}
      {...rest}
    >
      {children}
    </button>
  );
}
