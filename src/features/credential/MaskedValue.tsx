import type { ProviderId } from '@/domain/providers';
import { format, t } from '@/i18n/pt-BR';
import { Button } from '@/ui/Button';

import { nameOf } from './providerText';

export interface MaskedValueProps {
  value: string;
  revealed: boolean;
  provider: ProviderId;
  onToggle: () => void;
}

const VISIBLE_TAIL = 4;

export function maskValue(value: string, visibleTail = VISIBLE_TAIL): string {
  if (value.length <= visibleTail) return '•'.repeat(value.length);
  return '•'.repeat(value.length - visibleTail) + value.slice(-visibleTail);
}

/**
 * Credencial mascarada com botão de revelar (FR-003).
 *
 * O rótulo nomeia o serviço: com dois formulários na mesma tela, "Revelar
 * credencial" sozinho não diria qual.
 *
 * O botão é um `<button aria-pressed>` com rótulo textual que muda de "Revelar"
 * para "Ocultar" — nunca um ícone sem nome acessível.
 */
export function MaskedValue({ value, revealed, provider, onToggle }: MaskedValueProps) {
  const service = nameOf(provider);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <output
        aria-label={format(t.credential.maskedLabel, { service })}
        className="border-rule bg-surface-raised text-ink rounded-card border px-3 py-2 font-mono text-body break-all"
      >
        {revealed ? value : maskValue(value)}
      </output>
      <Button size="sm" aria-pressed={revealed} onClick={onToggle}>
        {format(revealed ? t.credential.hide : t.credential.reveal, { service })}
      </Button>
    </div>
  );
}
