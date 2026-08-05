import { useId, type ReactNode, type TextareaHTMLAttributes } from 'react';

import { cx } from './cx';

export interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string;
  hint?: ReactNode;
  error?: string | null;
}

export function TextArea({ label, hint, error = null, className, ...rest }: TextAreaProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const describedBy = cx(hint !== undefined ? hintId : null, error !== null ? errorId : null);

  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="text-ink text-sm font-semibold">
        {label}
      </label>
      <textarea
        id={id}
        className={cx(
          'focus-ring bg-surface text-ink mt-1 w-full rounded-lg border px-3 py-2 font-mono text-sm',
          error === null ? 'border-border-strong' : 'border-danger',
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
      {error !== null && (
        <p id={errorId} role="alert" className="field-message text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
