import { WIZARD_STEPS, type WizardStep } from '@/domain/types';
import { format, t } from '@/i18n/pt-BR';
import { cx } from '@/ui/cx';

const STEP_LABEL: Record<WizardStep, string> = {
  credential: t.steps.credential,
  input: t.steps.input,
  review: t.steps.review,
  result: t.steps.result,
};

export interface StepIndicatorProps {
  current: WizardStep;
}

/**
 * Indicador das quatro etapas (FR-041). É uma lista, não uma barra de navegação:
 * o fluxo é linear e o avanço acontece pelas ações de cada etapa.
 */
export function StepIndicator({ current }: StepIndicatorProps) {
  const currentIndex = WIZARD_STEPS.indexOf(current);

  return (
    <nav aria-label={t.steps.progressLabel}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm">
        {WIZARD_STEPS.map((step, index) => {
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
                    total: WIZARD_STEPS.length,
                  })}
                </span>
                {STEP_LABEL[step]}
              </span>
              {index < WIZARD_STEPS.length - 1 && (
                <span aria-hidden="true" className="text-border-strong">
                  ›
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
