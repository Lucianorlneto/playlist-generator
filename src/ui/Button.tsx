import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cx } from './cx';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'md' | 'sm';

/**
 * Variantes resolvidas por mapa explícito de literais. Nunca por concatenação:
 * uma classe montada em tempo de execução não é emitida no CSS e a falha só
 * aparece no build (research §14).
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

const BASE_CLASSES =
  'focus-ring inline-flex items-center justify-center gap-2 rounded-card font-semibold ' +
  'transition-colors disabled:cursor-not-allowed disabled:opacity-50';

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
