import { WIZARD_STEPS, type WizardStep } from '@/domain/types';
import { nameOf } from '@/features/credential/providerText';
import { format, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
import { cx } from '@/ui/cx';

const STEP_LABEL: Record<WizardStep, string> = {
  credential: t.steps.credential,
  destinations: t.steps.destinations,
  input: t.steps.input,
  service: t.steps.service,
  summary: t.steps.summary,
};

export interface StepIndicatorProps {
  current: WizardStep;
}

/**
 * Indicador das etapas globais (FR-043). É uma lista, não uma barra de
 * navegação: o fluxo é linear e o avanço acontece pelas ações de cada etapa.
 *
 * A etapa "Resumo" só aparece quando há mais de um destino (FR-040, invariante
 * Q4) — anunciar uma etapa que nunca vai acontecer seria informação falsa.
 *
 * Dentro de "Serviço", a fase do ciclo aparece como sublinha: são seis fases por
 * serviço, e transformá-las em etapas globais tornaria o indicador ilegível.
 */
export function StepIndicator({ current }: StepIndicatorProps) {
  const queue = useAppStore((state) => state.queue);

  const steps = WIZARD_STEPS.filter((step) => step !== 'summary' || queue.order.length > 1);
  const currentIndex = steps.indexOf(current);

  const provider = queue.order[queue.currentIndex] ?? null;
  const run = provider === null ? null : (queue.runs[provider] ?? null);

  return (
    <nav aria-label={t.steps.progressLabel} className="flex flex-col gap-1">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm">
        {steps.map((step, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          return (
            <li key={step} className="flex items-center gap-2">
              <span
                aria-current={active ? 'step' : undefined}
                className={cx(
                  'rounded-full px-2 py-0.5 font-semibold',
                  active ? 'bg-accent text-ink-inverse' : null,
                  done ? 'bg-accent-soft text-accent-strong' : null,
                  !active && !done ? 'text-ink-muted' : null,
                )}
              >
                <span className="sr-only">
                  {format('{n} {of} {total}: ', {
                    n: index + 1,
                    of: t.steps.of,
                    total: steps.length,
                  })}
                </span>
                {STEP_LABEL[step]}
              </span>
              {index < steps.length - 1 && (
                <span aria-hidden="true" className="text-border-strong">
                  ›
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {current === 'service' && provider !== null && run !== null && (
        <p className="text-ink-muted text-xs">
          {nameOf(provider)} · {t.queue.phase[run.phase]}
        </p>
      )}
    </nav>
  );
}
