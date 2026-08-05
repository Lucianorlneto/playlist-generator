import { t } from '@/i18n/pt-BR';
import { Button } from '@/ui/Button';

export interface MaskedValueProps {
  value: string;
  revealed: boolean;
  onToggle: () => void;
}

const VISIBLE_TAIL = 4;

export function maskValue(value: string, visibleTail = VISIBLE_TAIL): string {
  if (value.length <= visibleTail) return '•'.repeat(value.length);
  return '•'.repeat(value.length - visibleTail) + value.slice(-visibleTail);
}

/**
 * Credencial mascarada com botão de revelar (FR-003, SC-004).
 *
 * O botão é um `<button aria-pressed>` com rótulo textual que muda de "Revelar"
 * para "Ocultar" — nunca um ícone sem nome acessível (research §12).
 */
export function MaskedValue({ value, revealed, onToggle }: MaskedValueProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <output
        aria-label={t.credential.maskedLabel}
        className="border-border bg-surface-sunken text-ink rounded-lg border px-3 py-2 font-mono text-sm break-all"
      >
        {revealed ? value : maskValue(value)}
      </output>
      <Button size="sm" aria-pressed={revealed} onClick={onToggle}>
        {revealed ? t.credential.hide : t.credential.reveal}
      </Button>
    </div>
  );
}
