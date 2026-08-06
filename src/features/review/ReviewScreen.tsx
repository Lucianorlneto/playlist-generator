import { useMemo } from 'react';

import type { ProviderId } from '@/domain/providers';
import { nameOf } from '@/features/credential/providerText';
import { format, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
import { Button } from '@/ui/Button';
import { cx } from '@/ui/cx';
import { StepHeading } from '@/ui/StepHeading';

import { MatchRow } from './MatchRow';
import { PlaylistConfigForm } from './PlaylistConfigForm';
import { REVIEW_GRID } from './reviewGrid';
import { SearchProgress } from './SearchProgress';

export interface ReviewScreenProps {
  provider: ProviderId;
}

/**
 * Revisão obrigatória antes de qualquer escrita na conta **daquele** serviço
 * (FR-019, Princípio V).
 *
 * Confirmar o primeiro destino não libera escrita no segundo: cada `ServiceRun`
 * tem sua própria revisão e seu próprio evento de confirmação.
 *
 * A lista é renderizada na ordem de `line.index` e **nunca reordenada**. Ordenar
 * por status agruparia os problemas — e destruiria a correspondência visual com
 * o texto que o usuário colou.
 */
export function ReviewScreen({ provider }: ReviewScreenProps) {
  const stepToken = useAppStore((state) => state.stepToken);
  const run = useAppStore((state) => state.queue.runs[provider] ?? null);
  const dispatchRun = useAppStore((state) => state.dispatchRun);

  // Estabilizado: `run?.items ?? []` cria um array novo quando não há execução,
  // o que invalidaria os `useMemo` abaixo a cada render.
  const items = useMemo(() => run?.items ?? [], [run]);
  const service = nameOf(provider);

  const ordered = useMemo(() => [...items].sort((a, b) => a.line.index - b.line.index), [items]);

  const summary = useMemo(() => {
    let confident = 0;
    let uncertain = 0;
    let notFound = 0;
    let selected = 0;
    for (const item of items) {
      if (item.status === 'confident') confident += 1;
      if (item.status === 'uncertain') uncertain += 1;
      if (item.status === 'not_found' || item.status === 'unparsed') notFound += 1;
      if (item.included) selected += 1;
    }
    return { confident, uncertain, notFound, selected };
  }, [items]);

  return (
    <section className="flex flex-col gap-4">
      <StepHeading
        title={format(t.review.heading, { service })}
        description={t.review.intro}
        focusToken={stepToken}
      />

      <SearchProgress provider={provider} />

      <p className="text-ink-muted text-sm">
        {format(t.review.summaryConfident, { count: summary.confident })} ·{' '}
        {format(t.review.summaryUncertain, { count: summary.uncertain })} ·{' '}
        {format(t.review.summaryNotFound, { count: summary.notFound })}
      </p>
      <p className="text-ink text-sm font-semibold">
        {format(t.review.selectedCount, { selected: summary.selected, total: items.length })}
      </p>
      <p className="field-message">{t.review.editLinePropagates}</p>

      {/* Cabeçalho de colunas: só existe a partir de `sm:`, onde a lista deixa
          de ser uma pilha de cartões e passa a ter colunas alinhadas. */}
      <div
        aria-hidden="true"
        className={cx(REVIEW_GRID, 'text-ink-muted hidden px-4 text-xs font-semibold sm:grid')}
      >
        <span>{t.review.columnInclude}</span>
        <span>{t.review.columnOriginal}</span>
        <span>{t.review.columnMatch}</span>
        <span className="text-right">{t.review.columnStatus}</span>
      </div>

      <ul aria-label={t.review.listLabel} className="flex flex-col gap-3">
        {ordered.map((item) => (
          <MatchRow key={item.line.id} item={item} provider={provider} />
        ))}
      </ul>

      <PlaylistConfigForm provider={provider} />

      <div>
        <Button
          variant="ghost"
          onClick={() => {
            dispatchRun({ type: 'skipped' }, provider);
          }}
        >
          {format(t.queue.skipService, { service })}
        </Button>
      </div>
    </section>
  );
}
