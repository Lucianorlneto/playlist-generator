import { totalBatches } from '@/domain/batching';
import { format, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
import { Button } from '@/ui/Button';
import { StepHeading } from '@/ui/StepHeading';

import { failedLines } from './creationRunner';
import { FailedLines } from './FailedLines';
import { FolderNotice } from './FolderNotice';
import { RetryRemaining } from './RetryRemaining';

/**
 * Etapa 4: resultado (FR-036, FR-037, FR-039, FR-040).
 *
 * A mesma tela cobre três estados — criação em andamento, falha parcial e
 * conclusão — porque para o usuário é um lugar só: onde ele descobre o que
 * aconteceu com a lista dele.
 */
export function ResultScreen() {
  const stepToken = useAppStore((state) => state.stepToken);
  const result = useAppStore((state) => state.result);
  const creation = useAppStore((state) => state.creation);
  const creating = useAppStore((state) => state.creating);
  const creationError = useAppStore((state) => state.creationError);
  const items = useAppStore((state) => state.items);
  const resetWork = useAppStore((state) => state.resetWork);
  const goToStep = useAppStore((state) => state.goToStep);

  if (result === null) {
    return (
      <section className="flex flex-col gap-4">
        <StepHeading title={t.playlistConfig.creating} focusToken={stepToken} />

        {creating && creation !== null && (
          <p role="status" className="text-ink-muted text-sm">
            {format(t.result.creationProgress, {
              current: creation.committedBatches + 1,
              total: totalBatches(creation),
            })}
          </p>
        )}

        {creationError !== null && creation === null && (
          <div role="alert" className="border-danger bg-danger-soft rounded-lg border p-3 text-sm">
            <p className="font-bold">{creationError.info.title}</p>
            <p>{creationError.info.cause}</p>
            <p>{creationError.info.nextStep}</p>
          </div>
        )}

        {creationError !== null && <RetryRemaining />}

        <div>
          <Button
            variant="ghost"
            onClick={() => {
              goToStep('review');
            }}
          >
            {t.common.back}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <StepHeading title={t.result.heading} focusToken={stepToken} />

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
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

      <div>
        <a
          href={result.playlistUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="focus-ring bg-accent text-ink-inverse inline-flex rounded-lg px-4 py-2 text-sm font-semibold"
        >
          {t.result.openPlaylist}
        </a>
      </div>

      <FolderNotice />
      <FailedLines
        lines={result.failedLines.length > 0 ? result.failedLines : failedLines(items)}
      />

      <div>
        <Button variant="secondary" onClick={resetWork}>
          {t.result.startOver}
        </Button>
      </div>
    </section>
  );
}
