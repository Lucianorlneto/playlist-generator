import { useState } from 'react';

import { totalBatches } from '@/domain/batching';
import type { ProviderId } from '@/domain/providers';
import { linesFor } from '@/domain/run/lines';
import { nameOf, textFor } from '@/features/credential/providerText';
import { QueueIndicator } from '@/features/queue/QueueIndicator';
import { ListReduction } from '@/features/input/ListReduction';
import { SkipButton } from '@/features/service/SkipButton';
import { format, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
import { Button } from '@/ui/Button';
import { cx } from '@/ui/cx';
import { Icon } from '@/ui/Icon';
import { StepHeading } from '@/ui/StepHeading';

import { committedItemCount } from './creationRunner';
import { FailedLines } from './FailedLines';
import { FolderNotice } from './FolderNotice';
import { RetryRemaining } from './RetryRemaining';

export interface ResultScreenProps {
  provider: ProviderId;
}

/**
 * Mapas explícitos de literais, nunca concatenação: o scanner do Tailwind lê o
 * código como texto e não resolve expressão (`tp/no-dynamic-classname`).
 *
 * `text-*` tinge o glifo, que herda `currentColor`. **Nunca `bg-*`** — o
 * substrato tingido de 008/FR-004 é exceção nomeada do cartão de destino e não
 * alcança este cabeçalho (008/contracts/destinations.md §4).
 */
const PROVIDER_ICON = {
  spotify: 'provider-spotify',
  youtube: 'provider-youtube',
} as const;

const BRAND_INK = {
  spotify: 'text-brand-spotify',
  youtube: 'text-brand-youtube',
} as const;

/**
 * **O cabeçalho do cartão de fase** (008/FR-001; nós `EvlNu` em `C13Hj` e
 * `FWym9` em `SjphR`).
 *
 * Um componente local, e não duas cópias, porque a criação em andamento e o
 * resultado concluído são a mesma superfície do arquivo de design em dois
 * momentos — e o cabeçalho é literalmente o mesmo nó.
 */
function CardHeader({ provider }: { readonly provider: ProviderId }) {
  return (
    <header className="flex items-center gap-2">
      {/* Decorativo: o nome do serviço está escrito no título logo abaixo. */}
      <Icon role={PROVIDER_ICON[provider]} className={cx('text-section', BRAND_INK[provider])} />
      {/*
        A repetição **visual** da posição na fila (008/FR-013), `aria-hidden`:
        ela existe para quem está lendo o cartão sem ter voltado o olho ao topo
        da tela, e a linha de contexto é quem a anuncia.
      */}
      <QueueIndicator />
    </header>
  );
}

/**
 * Resultado de **um** serviço (FR-020, FR-021, FR-027, FR-028, FR-032).
 *
 * A mesma tela cobre criação em andamento, falha parcial e conclusão — para o
 * usuário é um lugar só: onde ele descobre o que aconteceu com a lista dele
 * naquele destino.
 *
 * É também o segundo ponto de entrada do ajuste de lista (FR-013): daqui o
 * usuário pode remover linhas antes de o próximo destino começar.
 */
export function ResultScreen({ provider }: ResultScreenProps) {
  const stepToken = useAppStore((state) => state.stepToken);
  const queue = useAppStore((state) => state.queue);
  const run = useAppStore((state) => state.queue.runs[provider] ?? null);
  const lines = useAppStore((state) => state.lines);
  const sessions = useAppStore((state) => state.sessions);
  const creating = useAppStore((state) => state.creating);
  const creationError = useAppStore((state) => state.creationError);
  const advance = useAppStore((state) => state.advance);
  const reduceUpcoming = useAppStore((state) => state.reduceUpcoming);
  const goToStep = useAppStore((state) => state.goToStep);
  const resetWork = useAppStore((state) => state.resetWork);

  const [reducing, setReducing] = useState(false);

  if (run === null) return null;

  const service = nameOf(provider);
  const text = textFor(provider);
  const result = run.result;
  const creation = run.creation;

  const nextProvider = queue.order[queue.currentIndex + 1] ?? null;
  const isLast = nextProvider === null;
  const nextRun = nextProvider === null ? null : (queue.runs[nextProvider] ?? null);

  // --- Criação em andamento ou interrompida -------------------------------

  if (result === null) {
    return (
      /*
        **O cartão de fase** (008/FR-006, 008/T021; nó `qBqxK — Service Result ·
        Loading`, instanciado em `SjphR`). Mesma superfície do resultado
        concluído: para o arquivo, criar e ter criado são dois momentos do mesmo
        cartão.
      */
      <section className="app-card flex flex-col gap-4">
        <CardHeader provider={provider} />
        <StepHeading
          title={format(t.playlistConfig.creating, { service })}
          focusToken={stepToken}
        />

        {creating && creation !== null && (
          <p role="status" className="text-ink-muted text-body">
            {format(t.result.creationProgress, {
              current: Math.min(creation.orderedUris.length, committedItemCount(creation) + 1),
              total: creation.orderedUris.length,
            })}
            {creation.batchSize > 1 && ` · ${String(totalBatches(creation))}`}
          </p>
        )}

        {creationError !== null && creation === null && (
          <div role="alert" className="border-state-missing bg-state-missing-tint rounded-card border p-3 text-body">
            <p className="font-bold">{creationError.info.title}</p>
            <p>{creationError.info.cause}</p>
            <p>{creationError.info.nextStep}</p>
          </div>
        )}

        {creationError !== null && <RetryRemaining provider={provider} />}

        {run.error !== null && (
          <div role="alert" className="border-state-missing bg-state-missing-tint rounded-card border p-3 text-body">
            <p className="font-bold">{run.error.title}</p>
            <p>{run.error.cause}</p>
            <p>{run.error.nextStep}</p>
          </div>
        )}

        {run.outcome !== null && (
          <div>
            <Button
              variant="primary"
              onClick={() => {
                advance();
                if (isLast) goToStep(queue.order.length > 1 ? 'summary' : 'service');
              }}
            >
              {isLast
                ? t.result.startOver
                : format(t.result.continueNext, { service: nameOf(nextProvider) })}
            </Button>
          </div>
        )}
      </section>
    );
  }

  // --- Ajuste da lista para o próximo destino ------------------------------

  if (reducing && nextProvider !== null && nextRun !== null) {
    return (
      <ListReduction
        provider={nextProvider}
        lines={linesFor(lines, nextRun.lineIds)}
        lineIds={nextRun.lineIds}
        onConfirm={(lineIds) => {
          reduceUpcoming(nextProvider, lineIds);
          setReducing(false);
        }}
        onCancel={() => {
          setReducing(false);
        }}
      />
    );
  }

  // --- Concluído ----------------------------------------------------------

  const account = sessions[provider]?.user.displayName ?? '';

  return (
    /*
      **O cartão de fase** (008/FR-006, 008/T021; nó `yTOJb — Success Card` em
      `C13Hj`).

      `--surface` com contorno `--rule`, e o título "Playlist criada no
      {serviço}" é filho dele — a linha de contexto é que fica fora, no cabeçalho
      da etapa. É também o que devolve o degrau às caixas internas (`Info Box`,
      `hHyQ6`), que o arquivo desenha em `--bg` sobre este `--surface`.
    */
    <section className="app-card flex flex-col gap-4">
      <CardHeader provider={provider} />
      <StepHeading title={format(t.result.heading, { service })} focusToken={stepToken} />

      <dl className="grid gap-2 text-body sm:grid-cols-2">
        <div>
          <dt className="text-ink font-semibold">{t.result.playlistName}</dt>
          <dd className="text-ink-muted">{result.playlistName}</dd>
        </div>
        <div>
          <dt className="text-ink font-semibold">{t.result.added}</dt>
          <dd className="text-ink-muted">{result.addedCount}</dd>
        </div>
        <div>
          <dt className="text-ink font-semibold">{t.result.skipped}</dt>
          <dd className="text-ink-muted">{result.skippedCount}</dd>
        </div>
        <div>
          <dt className="text-ink font-semibold">{t.result.effectivePath}</dt>
          <dd className="text-ink-muted break-words">{result.effectivePath}</dd>
        </div>
      </dl>

      <p className="field-message">{t.result.skippedHint}</p>
      {account !== '' && (
        <p className="field-message">{format(t.result.accountNotice, { account })}</p>
      )}

      {result.incompleteByQuota && (
        <div
          role="alert"
          className="border-state-uncertain-edge bg-state-uncertain-tint rounded-card border p-3 text-body"
        >
          <p className="font-bold">{format(t.quota.exhaustedHeading, { service })}</p>
          <p>
            {format(t.quota.exhaustedBody, {
              name: result.playlistName,
              added: result.addedCount,
              total: (creation?.orderedUris.length ?? result.addedCount).toString(),
            })}
          </p>
          <p className="mt-1">{t.quota.incompleteWarning}</p>
          <p className="mt-1">{t.quota.exhaustedNextStep}</p>
          <p className="field-message">{t.draft.keptAfterQuota}</p>
        </div>
      )}

      <div>
        <a
          href={result.playlistUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="focus-ring bg-accent text-accent-ink inline-flex rounded-card px-4 py-2 text-body font-semibold"
        >
          {text.openPlaylist}
        </a>
      </div>

      <FolderNotice provider={provider} />
      <FailedLines
        provider={provider}
        lines={result.failedLines}
        indices={result.failedIndices}
      />

      <div className="flex flex-wrap gap-2">
        {isLast ? (
          <Button
            variant="primary"
            onClick={() => {
              advance();
              if (queue.order.length > 1) goToStep('summary');
              else resetWork();
            }}
          >
            {queue.order.length > 1 ? t.common.next : t.result.startOver}
          </Button>
        ) : (
          <>
            <Button
              variant="primary"
              onClick={() => {
                advance();
              }}
            >
              {format(t.result.continueNext, { service: nameOf(nextProvider) })}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setReducing(true);
              }}
            >
              {t.result.adjustList}
            </Button>
            {/*
              Pular o destino seguinte **não** desfaz nem oculta o que já foi
              criado neste (FR-020). `exitAfterSkip` devolve `summary` aqui,
              porque o destino de onde o usuário olha rodou — e é por isso que
              este caminho, o único dos seis que já funcionava, sai da `006` com
              o comportamento inalterado (`006/ui-contract §4`).
            */}
            <SkipButton provider={nextProvider} />
          </>
        )}
      </div>
    </section>
  );
}
