import { useEffect, useRef } from 'react';

import { linesFor } from '@/domain/run/lines';
import { nameOf } from '@/features/credential/providerText';
import { AuthError } from '@/features/connect/AuthError';
import { ConnectButton } from '@/features/connect/ConnectButton';
import { runMatching } from '@/features/input/matchRunner';
import { QueueIndicator } from '@/features/queue/QueueIndicator';
import { QuotaEstimateScreen } from '@/features/quota/QuotaEstimateScreen';
import { ResultScreen } from '@/features/result/ResultScreen';
import { startCreation } from '@/features/result/creationRunner';
import { refreshExistingNames } from '@/features/review/nameCheck';
import { ReviewScreen } from '@/features/review/ReviewScreen';
import { format, t } from '@/i18n/pt-BR';
import { providerFor } from '@/services/providers/registry';
import { retryReserveOf } from '@/services/providers/retryPlan';
import { toErrorInfo, toAppError } from '@/services/providers/errors';
import { useAppStore } from '@/store';
import { Button } from '@/ui/Button';
import { StepHeading } from '@/ui/StepHeading';

/**
 * Etapa 4: o ciclo de **um** serviço por vez (FR-016 a FR-021, FR-043).
 *
 * ```text
 * connect → estimate? → search → review → creating → result
 * ```
 *
 * A tela não decide transições: ela observa a fase da execução corrente e
 * dispara o efeito daquela fase. Quem decide é `reduceRun`, puro e testado sem
 * DOM — e é por isso que "nenhuma escrita sem confirmação daquele serviço"
 * (FR-019) não depende de nenhuma tela lembrar de checar.
 *
 * A fase `estimate` só existe para provedor com orçamento diário; nos demais é
 * pulada sem deixar rastro na interface (research §12).
 */
export function ServiceStep() {
  const stepToken = useAppStore((state) => state.stepToken);
  const queue = useAppStore((state) => state.queue);
  const sessions = useAppStore((state) => state.sessions);
  const lines = useAppStore((state) => state.lines);
  const authError = useAppStore((state) => state.authError);

  const provider = queue.order[queue.currentIndex] ?? null;
  const run = provider === null ? null : (queue.runs[provider] ?? null);

  // Guarda contra reexecução do efeito de uma fase — o StrictMode monta duas
  // vezes, e disparar a busca duas vezes custaria o dobro da cota.
  const startedFor = useRef<string | null>(null);

  useEffect(() => {
    if (provider === null || run === null) return;
    const key = `${provider}:${run.phase}`;
    if (startedFor.current === key) return;

    const store = useAppStore.getState();

    // Rede de segurança: `pending` não tem tela. A fila já inicia o serviço que
    // entra, mas um rascunho restaurado pode trazer a execução corrente parada
    // aqui — e sem isto o usuário veria uma tela vazia sem saída.
    if (run.phase === 'pending') {
      startedFor.current = key;
      store.dispatchRun({ type: 'started' }, provider);
      return;
    }

    if (run.phase === 'connect') {
      if (sessions[provider] !== null) {
        startedFor.current = key;
        store.dispatchRun({ type: 'authorized' }, provider);
      }
      return;
    }

    if (run.phase === 'estimate') {
      startedFor.current = key;
      const adapter = providerFor(provider);
      if (adapter.estimate === undefined) {
        store.dispatchRun({ type: 'estimate_ok' }, provider);
        return;
      }
      // Custo nominal supondo **todas** as linhas confirmadas: é o cenário mais
      // caro, e por isso não há segunda checagem depois da revisão (FR-029).
      //
      // A reserva de retentativa entra aqui, contada exatamente a partir do
      // texto das linhas deste destino (`003/FR-010`, invariante O5). É o mesmo
      // número que vira teto de execução mais abaixo — contá-lo duas vezes por
      // caminhos diferentes é o que faria SC-007 depender de sorte.
      const estimate = adapter.estimate(
        run.lineIds.length,
        run.lineIds.length,
        Date.now(),
        retryReserveOf(provider, linesFor(lines, run.lineIds)),
      );
      store.dispatchRun({ type: 'estimate_ready', estimate }, provider);
      // Avançar sozinho aqui deixaria a estimativa invisível — SC-011 exige que
      // ela seja **exibida** antes de qualquer busca, em 100% das execuções que
      // incluem o serviço de vídeo. Quem emite `estimate_ok` é o usuário, pelo
      // botão da tela; `estimate_blocked` apenas registra que não há saída por ali.
      if (estimate.blocked) store.dispatchRun({ type: 'estimate_blocked' }, provider);
      return;
    }

    if (run.phase === 'search') {
      startedFor.current = key;
      const controller = new AbortController();
      const target = linesFor(lines, run.lineIds);
      store.startSearch(target.length, controller);

      // Teto de retentativas desta execução (invariante O4): o que a estimativa
      // reservou, menos o que uma execução anterior já gastou. Sem descontar
      // `retriesUsed`, uma busca retomada após recarga gastaria a reserva duas
      // vezes e o consumo real passaria do estimado.
      const reserved = run.estimate?.retryReserve;
      const remainingRetries =
        reserved === undefined ? undefined : Math.max(0, reserved - run.retriesUsed);

      void runMatching(provider, target, {
        signal: controller.signal,
        onProgress: (done) => {
          useAppStore.getState().reportSearchProgress(done);
        },
        ...(remainingRetries === undefined ? {} : { retryBudget: remainingRetries }),
        onRetry: (total) => {
          useAppStore.getState().recordRetries(provider, run.retriesUsed + total);
        },
      })
        .then((items) => {
          useAppStore.getState().dispatchRun({ type: 'search_done', items }, provider);
          useAppStore.getState().finishSearch(controller.signal.aborted);
        })
        .catch((error: unknown) => {
          useAppStore.getState().finishSearch(true);
          useAppStore
            .getState()
            .dispatchRun(
              { type: 'failed', error: toErrorInfo(toAppError(error, provider), provider) },
              provider,
            );
        });
      return;
    }

    if (run.phase === 'review') {
      startedFor.current = key;
      // A checagem de nome duplicado é local a este serviço (FR-022).
      store.setExistingNames(null);
      void refreshExistingNames(provider);
      return;
    }

    if (run.phase === 'creating') {
      startedFor.current = key;
      void startCreation();
    }
  }, [provider, run, sessions, lines]);

  if (provider === null || run === null) return null;

  const service = nameOf(provider);
  const finished = run.outcome !== null;

  return (
    <section className="flex flex-col gap-4">
      <QueueIndicator />

      {run.phase === 'connect' && (
        <>
          <StepHeading
            title={format(t.connect.heading, { service })}
            description={format(t.connect.intro, { service })}
            focusToken={stepToken}
          />
          <AuthError error={authError} />
          <ConnectButton provider={provider} />
          <div>
            <Button
              variant="ghost"
              onClick={() => {
                useAppStore.getState().dispatchRun({ type: 'skipped' }, provider);
              }}
            >
              {format(t.queue.skipService, { service })}
            </Button>
          </div>
        </>
      )}

      {run.phase === 'estimate' && <QuotaEstimateScreen provider={provider} />}

      {(run.phase === 'search' || run.phase === 'review') && <ReviewScreen provider={provider} />}

      {(run.phase === 'creating' || finished) && <ResultScreen provider={provider} />}
    </section>
  );
}
