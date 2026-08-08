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

  /** Fração preenchida da régua. A etapa atual conta como alcançada. */
  const progresso = steps.length === 0 ? 0 : (currentIndex + 1) / steps.length;

  return (
    <nav aria-label={t.steps.progressLabel} className="flex flex-col gap-2">
      {/*
        A régua é `aria-hidden`: ela duplica visualmente o que a lista abaixo já
        diz por `aria-current` e pela contagem "N de T". Anunciá-la de novo faria
        o leitor de tela ouvir a mesma informação duas vezes
        (contracts/components.md §6).
      */}
      <div aria-hidden="true" className="bg-rule h-1 w-full overflow-hidden rounded-pill">
        <div
          className="bg-accent h-full rounded-pill transition-[width] duration-200 motion-reduce:transition-none"
          style={{ width: `${String(Math.round(progresso * 100))}%` }}
        />
      </div>

      {/*
        Semântica preservada da versão em pílulas: continua `nav` + `ol`, com
        `aria-current="step"` e a contagem para leitor de tela. Saíram as pílulas
        e os separadores `›`; entrou a régua acima — o indicador de etapa feito
        quieto, para não competir com a goteira numerada, que é a assinatura
        (design.md §6).
      */}
      <ol className="flex flex-wrap items-center gap-x-4 gap-y-1 text-meta">
        {steps.map((step, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          return (
            <li key={step}>
              <span
                aria-current={active ? 'step' : undefined}
                className={cx(
                  active ? 'text-ink font-semibold' : null,
                  done ? 'text-ink-muted' : null,
                  !active && !done ? 'text-ink-muted opacity-60' : null,
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
            </li>
          );
        })}
      </ol>

      {current === 'service' && provider !== null && run !== null && (
        <p className="text-ink-muted text-meta">
          {nameOf(provider)} · {t.queue.phase[run.phase]}
        </p>
      )}
    </nav>
  );
}
