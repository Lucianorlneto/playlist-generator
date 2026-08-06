import { useMemo } from 'react';

import { buildSummary } from '@/domain/run/summary';
import { nameOf, textFor } from '@/features/credential/providerText';
import { FailedLines } from '@/features/result/FailedLines';
import { plural, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
import { Button } from '@/ui/Button';
import { StepHeading } from '@/ui/StepHeading';

/**
 * Etapa 5: resumo consolidado (US3, FR-040, FR-041, SC-018).
 *
 * Exibido **apenas** quando há mais de um destino (invariante U3, Q4): com um
 * serviço só, o resultado dele já é o resumo.
 *
 * Três coisas que esta tela existe para não deixar implícitas:
 *
 * - **o estado de cada serviço**, com a fronteira de FR-040 — "parcial" é a
 *   playlist que existe na conta com item confirmado faltando, sem limiar
 *   percentual;
 * - **em qual conta** cada playlist foi criada (FR-036);
 * - **a divergência de listas**, quando o usuário reduziu a lista entre os
 *   destinos (SC-018). O relato de um serviço concluído nunca é reescrito.
 */
export function SummaryScreen() {
  const stepToken = useAppStore((state) => state.stepToken);
  const resetWork = useAppStore((state) => state.resetWork);

  // As fontes são selecionadas cruas e o resumo é derivado em `useMemo`.
  // Selecionar `state.summary()` direto devolveria um objeto novo a cada
  // avaliação, e a comparação por identidade do store faria a tela re-renderizar
  // sem parar.
  const queue = useAppStore((state) => state.queue);
  const lines = useAppStore((state) => state.lines);
  const sessions = useAppStore((state) => state.sessions);
  const summary = useMemo(() => buildSummary(queue, { lines, sessions }), [queue, lines, sessions]);

  return (
    <section className="flex flex-col gap-4">
      <StepHeading title={t.summary.heading} description={t.summary.intro} focusToken={stepToken} />

      <ul aria-label={t.summary.listLabel} className="flex flex-col gap-4">
        {summary.entries.map((entry) => {
          const service = nameOf(entry.provider);
          const text = textFor(entry.provider);
          return (
            <li key={entry.provider} className="app-card flex flex-col gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-ink text-base font-bold">{service}</h3>
                <span className="text-ink-muted text-sm font-semibold">
                  {t.summary.outcome[entry.outcome]}
                </span>
              </div>

              <p className="field-message">{t.summary.outcomeHint[entry.outcome]}</p>

              {entry.accountLabel !== '' && (
                <p className="text-ink-muted text-sm">
                  {t.summary.accountLabel}: <strong className="text-ink">{entry.accountLabel}</strong>
                </p>
              )}

              <p className="text-ink-muted text-sm">
                {plural(entry.lineCount, t.summary.linesUsedOne, t.summary.linesUsedOther)} ·{' '}
                {t.result.added}: {entry.addedCount} · {t.result.skipped}: {entry.skippedCount}
              </p>

              {entry.incompleteByQuota && (
                <p role="alert" className="field-message text-status-uncertain">
                  {t.quota.incompleteWarning}
                </p>
              )}

              {entry.playlistUrl !== null && (
                <div>
                  <a
                    href={entry.playlistUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="focus-ring text-sm underline"
                  >
                    {text.openPlaylist}
                  </a>
                </div>
              )}

              <FailedLines provider={entry.provider} lines={entry.failedLines} />
            </li>
          );
        })}
      </ul>

      {summary.listsDiverged && (
        <section
          role="note"
          className="border-status-uncertain bg-status-uncertain-soft rounded-lg border p-3 text-sm"
        >
          <h3 className="text-ink font-bold">{t.summary.divergedHeading}</h3>
          <p className="text-ink mt-1">{t.summary.divergedBody}</p>
          {summary.removedForLater.length > 0 && (
            <>
              <h4 className="text-ink mt-2 font-semibold">{t.summary.removedForLater}</h4>
              <ul className="mt-1 flex flex-col gap-1">
                {summary.removedForLater.map((line, index) => (
                  <li key={`${line}-${index}`} className="text-ink font-mono break-words">
                    {line}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <div>
        <Button variant="secondary" onClick={resetWork}>
          {t.summary.startOver}
        </Button>
      </div>
    </section>
  );
}
