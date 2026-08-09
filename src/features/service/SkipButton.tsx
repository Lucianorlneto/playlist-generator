import { useId, useState } from 'react';

import type { ProviderId } from '@/domain/providers';
import { exitAfterSkip } from '@/domain/run/exit';
import { nameOf } from '@/features/credential/providerText';
import { format, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
import { Button, type ButtonSize, type ButtonVariant } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';

export interface SkipButtonProps {
  provider: ProviderId;
  /**
   * Rótulo alternativo. A tela de estimativa diz "Pular o {serviço} desta vez",
   * porque ali a decisão é sobre o orçamento do dia e não sobre o destino em si.
   * O que esta feature unifica é o **comportamento** (FR-008); uniformizar a
   * escrita seria uma revisão de copy que nenhum requisito pediu.
   */
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/**
 * O gatilho único de "pular o {serviço}" (`006/FR-008`).
 *
 * Antes da `006` esta ação estava escrita seis vezes na interface — quatro fases
 * de `ServiceStep`/`QuotaEstimateScreen`/`ReviewScreen` mais o botão que dispensa
 * o próximo destino em `ResultScreen` — e em cinco delas estava **incompleta**:
 * só encerrava a execução, sem avançar a fila. O resultado era a etapa
 * continuar exibindo a mesma execução, agora encerrada e sem resultado, como
 * "Criando playlist no {serviço}…" (`006/research §1`).
 *
 * FR-008 exige comportamento idêntico nas quatro fases. Um componente só é o que
 * torna esse requisito verificável por um teste rodado quatro vezes, em vez de
 * seis cópias que alguém precisa lembrar de manter iguais.
 *
 * **A confirmação vive aqui, não na ação** (invariante S3): `skipService` é
 * transição de estado e não abre diálogo. Quem decide se pergunta é a interface,
 * consultando `exitAfterSkip` antes — e ela pergunta em **um** caso só.
 *
 * `provider` é o destino a pular, que **nem sempre é o corrente**: em
 * `ResultScreen` o botão dispensa o destino seguinte, a partir do resultado do
 * anterior.
 */
export function SkipButton({
  provider,
  label,
  variant = 'ghost',
  size = 'md',
}: SkipButtonProps) {
  const queue = useAppStore((state) => state.queue);
  const skipService = useAppStore((state) => state.skipService);
  const [confirming, setConfirming] = useState(false);
  const titleId = useId();

  const service = nameOf(provider);
  const texto = label ?? format(t.queue.skipService, { service });

  /**
   * `discard` é o único desfecho em que pular apaga trabalho: último destino de
   * uma fila em que nada rodou. O Princípio V exige ação **explícita** de
   * descarte, e um botão escrito "Pular o {serviço}" não anuncia um descarte —
   * a confirmação é o que torna a ação explícita (`006/plan.md`, D1).
   *
   * Nos outros dois desfechos não há diálogo: pular continua sendo um clique só
   * (FR-012).
   */
  const descarta = exitAfterSkip(queue, provider).kind === 'discard';

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => {
          if (descarta) setConfirming(true);
          else skipService(provider);
        }}
      >
        {texto}
      </Button>

      {descarta && (
        <Dialog
          open={confirming}
          labelledBy={titleId}
          onClose={() => {
            setConfirming(false);
          }}
        >
          <h2 id={titleId} className="text-ink text-step font-bold">
            {format(t.queue.skipEndsFlowTitle, { service })}
          </h2>
          <p className="text-ink-muted mt-2 text-body">{t.queue.skipEndsFlowBody}</p>
          <p className="text-ink-muted mt-1 text-body">{t.flow.resetKeeps}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="danger"
              onClick={() => {
                setConfirming(false);
                skipService(provider);
              }}
            >
              {t.common.discard}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setConfirming(false);
              }}
            >
              {t.common.cancel}
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
