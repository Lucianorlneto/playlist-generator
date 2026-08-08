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
      <span id={labelId} className="text-ink text-body font-semibold">
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
            'focus-ring inline-flex h-6 w-12 shrink-0 items-center rounded-pill border transition-colors',
            checked ? 'border-accent-text bg-accent' : 'border-rule-strong bg-surface-raised',
            disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
          )}
        >
          {/*
            O botão perdeu a sombra própria: a profundidade tem um nível só, e
            um segundo degrau para um elemento de 16px seria escala fora da
            escala. Ele continua se separando do trilho por luminosidade, e o
            estado é anunciado por texto e não por relevo (FR-017).
          */}
          <span
            className={cx(
              'bg-surface ml-1 inline-block size-4 rounded-pill transition-transform',
              checked ? 'translate-x-6' : 'translate-x-0',
            )}
          />
        </button>
        <span className="text-ink text-body">{stateLabel}</span>
      </div>
      {hint !== undefined && (
        <p id={hintId} className="field-message">
          {hint}
        </p>
      )}
    </div>
  );
}
