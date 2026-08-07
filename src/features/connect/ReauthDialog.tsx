import { useId, useState } from 'react';

import { committedItemCount } from '@/domain/batching';
import { capabilitiesOf, type ProviderId } from '@/domain/providers';
import { nominalCost } from '@/domain/quota';
import { linesFor, remainingLineIds } from '@/domain/run/lines';
import { nameOf } from '@/features/credential/providerText';
import { ConnectButton } from '@/features/connect/ConnectButton';
import { resumePointOf } from '@/features/connect/reconnect';
import { format, plural, t } from '@/i18n/pt-BR';
import { retryReserveOf } from '@/services/providers/retryPlan';
import { useAppStore } from '@/store';
import { Button } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';

export interface ReauthDialogProps {
  provider: ProviderId;
  /** Injetável para teste: em produção é a navegação real do navegador. */
  navigate?: (url: string) => void;
}

/**
 * Pedido de reautorização em primeiro plano (`004/ui-contract §2`, FR-009 a
 * FR-011).
 *
 * **Aberto por estado derivado, não por sinalizador imperativo**: ele aparece
 * quando a execução corrente está em `awaiting_reauth` e o usuário não o
 * dispensou nesta visita. A consequência é estrutural — o pedido não existe como
 * registro próprio e, portanto, **não pode** conter token nem credencial. O
 * Princípio II é satisfeito por construção, não por disciplina.
 *
 * A dispensa é estado local e **nunca** persistida (R3): recarregar reapresenta
 * o pedido, como US4 cenário 3 exige. Guardá-la no rascunho transformaria um
 * "agora não" em silêncio permanente sobre trabalho que ainda espera o usuário.
 */
export function ReauthDialog({ provider, navigate }: ReauthDialogProps) {
  const run = useAppStore((state) => state.queue.runs[provider] ?? null);
  const credential = useAppStore((state) => state.credentials[provider]);
  const goToStep = useAppStore((state) => state.goToStep);

  const [dismissed, setDismissed] = useState(false);
  const titleId = useId();

  const open = run !== null && run.phase === 'awaiting_reauth' && !dismissed;
  if (run === null) return null;

  const service = nameOf(provider);
  const resumeFrom = resumePointOf(provider);

  return (
    <Dialog
      open={open}
      onClose={() => {
        setDismissed(true);
      }}
      labelledBy={titleId}
    >
      <h2 id={titleId} className="text-ink text-base font-bold">
        {format(t.connect.reauthTitle, { service })}
      </h2>

      <p className="text-ink mt-2 text-sm">{format(t.connect.reconnectNeeded, { service })}</p>
      <p className="text-ink-muted mt-1 text-sm">{t.connect.reauthPreserved}</p>
      <p className="text-ink-muted mt-1 text-sm">
        {format(t.connect.resumeAt, { where: t.connect.resumePoint[resumeFrom] })}
      </p>

      <Progresso provider={provider} />

      {resumeFrom === 'search' && <CustoDaRetomada provider={provider} />}

      {credential === null ? (
        <div className="mt-4 flex flex-col gap-2">
          {/* R5, FR-016a: sem credencial não há o que reconectar — mas o
              trabalho **não** é descartado, e o caminho de saída é oferecido. */}
          <p className="field-message">
            {format(t.connect.reauthNeedsCredential, { service })}
          </p>
          <div>
            <Button
              variant="primary"
              onClick={() => {
                setDismissed(true);
                goToStep('credential');
              }}
            >
              {t.connect.reauthGoToCredential}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          {/* R1, FR-024: o mesmo caminho de `ConnectButton` — grava o rascunho
              antes de navegar e pede autorização **só** ao serviço afetado. */}
          <ConnectButton provider={provider} {...(navigate === undefined ? {} : { navigate })} />
        </div>
      )}

      <div className="mt-3">
        <Button
          variant="ghost"
          onClick={() => {
            setDismissed(true);
          }}
        >
          {t.connect.reauthDismiss}
        </Button>
      </div>
    </Dialog>
  );
}

/**
 * Quanto do trabalho sobreviveu, na medida da fase de origem: linhas buscadas
 * quando a perda foi na busca, faixas já escritas quando foi na criação
 * (FR-009, FR-028).
 */
function Progresso({ provider }: { provider: ProviderId }) {
  const run = useAppStore((state) => state.queue.runs[provider] ?? null);
  if (run === null) return null;

  if (run.resumeFrom === 'creating') {
    const creation = run.creation;
    if (creation === null) return null;
    return (
      <p className="text-ink mt-2 text-sm">
        {format(t.connect.reauthCreationProgress, {
          added: committedItemCount(creation),
          total: creation.orderedUris.length,
        })}
      </p>
    );
  }

  const total = run.lineIds.length;
  return (
    <p className="text-ink mt-2 text-sm">
      {format(t.connect.reauthSearchProgress, {
        done: total - remainingLineIds(run).length,
        total,
      })}
    </p>
  );
}

/**
 * Custo da retomada (FR-013, `004/provider-contract §5`).
 *
 * Calculado por `nominalCost` sobre **`remainingLineIds`** — a mesma função que
 * decide o que é de fato buscado na retomada. Uma fonte só é o que faz SC-008
 * (desvio nulo entre o informado e o real) verdadeiro por construção.
 *
 * Provedor sem orçamento diário não exibe nada (C4): não há o que dizer, e
 * inventar um número seria a desonestidade que a constituição proíbe.
 */
function CustoDaRetomada({ provider }: { provider: ProviderId }) {
  const run = useAppStore((state) => state.queue.runs[provider] ?? null);
  const lines = useAppStore((state) => state.lines);

  const quota = capabilitiesOf(provider).quota;
  if (quota === null || run === null) return null;

  const restantes = remainingLineIds(run);
  if (restantes.length === 0) {
    return <p className="text-ink-muted mt-2 text-sm">{t.connect.reauthCostNone}</p>;
  }

  const alvo = linesFor(lines, restantes);
  // A reserva é recontada **sobre o subconjunto**, e `retriesUsed` continua
  // descontado (C3): a execução interrompida já gastou parte dela.
  const reserva = Math.max(0, retryReserveOf(provider, alvo) - run.retriesUsed);
  // Sem componente de criação: o que a retomada da busca custa é busca.
  const units = nominalCost(quota, restantes.length, 0, reserva);

  return (
    <p className="text-ink-muted mt-2 text-sm">
      {format(
        plural(restantes.length, t.connect.reauthCostOne, t.connect.reauthCostOther),
        { units, count: restantes.length },
      )}
    </p>
  );
}
