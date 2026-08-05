import { useId } from 'react';

import { cx } from './cx';

export interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Rótulo do estado atual, lido junto do controle (ex.: "Privada" / "Pública"). */
  stateLabel: string;
  hint?: string;
  disabled?: boolean;
}

/**
 * Interruptor sobre `<button role="switch">`: elemento nativo, foco e ativação
 * por teclado de graça, estado exposto por `aria-checked` (FR-046).
 */
export function Toggle({
  label,
  checked,
  onChange,
  stateLabel,
  hint,
  disabled = false,
}: ToggleProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const hintId = `${id}-hint`;

  return (
    <div className="flex flex-col">
      <span id={labelId} className="text-ink text-sm font-semibold">
        {label}
      </span>
      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-labelledby={labelId}
          aria-describedby={hint === undefined ? undefined : hintId}
          disabled={disabled}
          onClick={() => {
            onChange(!checked);
          }}
          className={cx(
            'focus-ring inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors',
            checked ? 'border-accent-strong bg-accent' : 'border-border-strong bg-surface-sunken',
            disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
          )}
        >
          <span
            className={cx(
              'bg-surface ml-0.5 inline-block h-4.5 w-4.5 rounded-full shadow-sm transition-transform',
              checked ? 'translate-x-5' : 'translate-x-0',
            )}
          />
        </button>
        <span className="text-ink text-sm">{stateLabel}</span>
      </div>
      {hint !== undefined && (
        <p id={hintId} className="field-message">
          {hint}
        </p>
      )}
    </div>
  );
}
