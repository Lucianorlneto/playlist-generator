import { useId, useState } from 'react';

import { PROVIDER_ORDER } from '@/domain/providers';
import { hasWork } from '@/domain/work';
import { t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
import { Button } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';

/**
 * Recomeçar o fluxo de qualquer etapa (`006/FR-013` a FR-022).
 *
 * Até a `006` não havia saída de dentro do ciclo de um serviço: descartar o
 * trabalho só era possível pela faixa de rascunho, que aparece na recuperação,
 * na migração e no esgotamento de cota. Quem se arrependia no meio do caminho
 * não tinha o que clicar.
 *
 * Vive em `app/` e não em `features/` porque é cromo de aplicação e não pertence
 * a nenhuma etapa — mesmo critério que já colocou `StepIndicator` e
 * `DraftRecoveryBanner` aqui.
 *
 * **Variante `ghost`, e não `danger`** (FR-026): este botão não descarta, ele
 * *pergunta*. O peso destrutivo pertence ao botão dentro do diálogo. Um `danger`
 * permanente no cabeçalho de todas as etapas competiria com a ação primária de
 * cada uma delas — que é exatamente o que a 005 corrigiu na faixa de rascunho.
 */
export function ResetFlow() {
  const rawText = useAppStore((state) => state.rawText);
  const lines = useAppStore((state) => state.lines);
  const queue = useAppStore((state) => state.queue);
  const resetWork = useAppStore((state) => state.resetWork);

  const [confirming, setConfirming] = useState(false);
  const titleId = useId();

  // `queueCounts`: quem escolheu destinos e avançou **tem** o que descartar,
  // mesmo sem ter digitado nada ainda. A restauração do rascunho usa a mesma
  // função com a fronteira mais estreita (`006/data-model §2`).
  if (!hasWork({ rawText, lines, queue }, { queueCounts: true })) return null;

  // FR-015 e US4: só afirmamos que playlists permanecem quando alguma existe.
  // Dizer isso sempre transformaria uma garantia em ruído — e, pior, sugeriria
  // que há algo na conta do usuário quando não há.
  const criouAlguma = PROVIDER_ORDER.some((provider) => queue.runs[provider]?.result != null);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setConfirming(true);
        }}
      >
        {t.flow.reset}
      </Button>

      <Dialog
        open={confirming}
        labelledBy={titleId}
        onClose={() => {
          setConfirming(false);
        }}
      >
        <h2 id={titleId} className="text-ink text-step font-bold">
          {t.flow.resetTitle}
        </h2>
        <p className="text-ink-muted mt-2 text-body">{t.flow.resetBody}</p>
        <p className="text-ink-muted mt-1 text-body">{t.flow.resetKeeps}</p>
        {criouAlguma && (
          <p className="text-ink-muted mt-1 text-body">{t.flow.resetKeepsPlaylist}</p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="danger"
            onClick={() => {
              setConfirming(false);
              resetWork();
            }}
          >
            {t.flow.resetConfirm}
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
    </>
  );
}
