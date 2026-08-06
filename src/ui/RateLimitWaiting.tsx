import { useEffect, useState } from 'react';

import { t } from '@/i18n/pt-BR';
import { onWaitStateChange, type WaitState } from '@/services/rate-limiter';

import { Button } from './Button';

export interface RateLimitWaitingProps {
  /** Quando presente, o cancelamento continua alcançável durante a espera. */
  onCancel?: () => void;
  /** Mensagem já resolvida com o nome do serviço que pediu a pausa (FR-046). */
  label?: string;
}

/**
 * Estado de espera por limitação de requisições (FR-034, SC-011).
 *
 * Usado tanto na busca quanto na criação. O botão de cancelar fica **dentro** do
 * aviso de propósito: SC-011 exige que cancelar funcione inclusive enquanto o
 * app aguarda, e é aqui que o usuário está olhando quando isso acontece.
 */
export function RateLimitWaiting({ onCancel, label }: RateLimitWaitingProps) {
  const [wait, setWait] = useState<WaitState | null>(null);

  useEffect(() => onWaitStateChange(setWait), []);

  if (wait === null) return null;

  return (
    <div
      role="status"
      className="border-status-uncertain bg-status-uncertain-soft text-ink flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm"
    >
      <span>{label ?? t.review.progressWaiting}</span>
      {onCancel !== undefined && (
        <Button size="sm" variant="ghost" onClick={onCancel}>
          {t.review.cancelSearch}
        </Button>
      )}
    </div>
  );
}
