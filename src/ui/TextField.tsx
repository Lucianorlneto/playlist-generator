import { useId, type InputHTMLAttributes, type ReactNode } from 'react';

import { cx } from './cx';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  /** Texto de apoio permanente, associado por `aria-describedby` (FR-046). */
  hint?: ReactNode;
  /** Mensagem de erro; marca o campo com `aria-invalid` e assume a descrição. */
  error?: string | null;
  /** Aviso não bloqueante — descreve sem invalidar. */
  warning?: string | null;
}

export function TextField({
  label,
  hint,
  error = null,
  warning = null,
  className,
  ...rest
}: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const warningId = `${id}-warning`;

  const describedBy = cx(
    hint !== undefined ? hintId : null,
    error !== null ? errorId : null,
    warning !== null ? warningId : null,
  );

  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="text-ink text-body font-semibold">
        {label}
      </label>
      <input
        id={id}
        className={cx(
          // `rounded-control` (8px) — campo é controle, não cartão. O contorno é
          // `--rule-strong` porque carrega significado: é ele que separa a área
          // digitável do substrato, e `--rule` dá 1,37:1, que é filete.
          //
          // `focus:bg-surface-raised` é o degrau de luminosidade que marca o
          // campo em foco. Some sob cores forçadas, mas o `outline` do
          // `focus-ring` não — a pista principal nunca é a cor de fundo.
          'focus-ring bg-surface text-ink focus:bg-surface-raised mt-1 w-full rounded-control border px-3 py-2 text-body',
          error === null ? 'border-rule-strong' : 'border-state-missing',
          className,
        )}
        aria-invalid={error === null ? undefined : true}
        aria-describedby={describedBy === '' ? undefined : describedBy}
        {...rest}
      />
      {hint !== undefined && (
        <p id={hintId} className="field-message">
          {hint}
        </p>
      )}
      {warning !== null && (
        <p id={warningId} className="field-message text-state-uncertain">
          {warning}
        </p>
      )}
      {error !== null && (
        <p id={errorId} role="alert" className="field-message text-state-missing">
          {error}
        </p>
      )}
    </div>
  );
}
