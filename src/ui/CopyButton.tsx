import { useEffect, useRef, useState } from 'react';

import { t } from '@/i18n/pt-BR';

import { Button, type ButtonSize, type ButtonVariant } from './Button';
import { LiveRegion } from './LiveRegion';

export interface CopyButtonProps {
  value: string;
  /** Rótulo específico ("Copiar Redirect URI"); usa "Copiar" quando omitido. */
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/**
 * Copia para a área de transferência e anuncia o desfecho em região viva — sem
 * isso a confirmação seria puramente visual e invisível a leitor de tela (FR-046).
 */
export function CopyButton({ value, label, variant = 'secondary', size = 'sm' }: CopyButtonProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  async function copy(): Promise<void> {
    let ok = false;
    try {
      await navigator.clipboard.writeText(value);
      ok = true;
    } catch {
      ok = false;
    }
    setFeedback(ok ? t.common.copied : t.common.copyFailed);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setFeedback(null);
    }, 4000);
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button variant={variant} size={size} onClick={() => void copy()}>
        {label ?? t.common.copy}
      </Button>
      <LiveRegion message={feedback} />
    </span>
  );
}
