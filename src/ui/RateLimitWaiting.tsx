import { useEffect, useState } from 'react';

import { t } from '@/i18n/pt-BR';
import { onWaitStateChange, type WaitState } from '@/services/rate-limiter';

import { Button } from './Button';
import { Icon } from './Icon';

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
    /*
      **A analogia adotada** (FR-063, FR-064): o design não desenha aviso de
      espera. O mais próximo é a caixa de dica — cartão baixo, fundo tingido,
      contorno na cor do estado. A tinta é a de "incerta" e não a de erro: uma
      pausa por limite de taxa é o serviço pedindo calma, não uma falha, e pintá-la
      de vermelho ensinaria o usuário a temer o normal.

      **Reconferido na 008** (FR-008, T021a). Com a saída da moldura do `Wizard`,
      este aviso passou a repousar sobre `--bg` quando aparece na revisão — a
      única das duas posições que não tem cartão de fase em volta. O substrato
      tingido continua se destacando porque ele é derivado de `--surface`, e o
      **contorno na cor do estado** é o que garante a separação sem depender
      disso: ele sobrevive inclusive ao modo de cores forçadas, que descarta
      preenchimento e preserva contorno.
    */
    <div
      role="status"
      className="border-state-uncertain-edge bg-state-uncertain-tint text-ink flex flex-wrap items-center gap-2 rounded-card border px-3 py-2 text-body"
    >
      {/* Decorativo: a espera está escrita ao lado, e o giro comunica duração. */}
      <Icon role="loading" className="text-state-uncertain motion-safe:animate-spin" />
      <span>{label ?? t.review.progressWaiting}</span>
      {onCancel !== undefined && (
        <Button size="sm" variant="ghost" onClick={onCancel}>
          {t.review.cancelSearch}
        </Button>
      )}
    </div>
  );
}
