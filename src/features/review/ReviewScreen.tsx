import { useMemo } from 'react';

import { format, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
import { Button } from '@/ui/Button';
import { cx } from '@/ui/cx';
import { StepHeading } from '@/ui/StepHeading';

import { MatchRow } from './MatchRow';
import { PlaylistConfigForm } from './PlaylistConfigForm';
import { REVIEW_GRID } from './reviewGrid';
import { SearchProgress } from './SearchProgress';

/**
 * Etapa 3: revisão obrigatória antes de qualquer escrita na conta (FR-031).
 *
 * A lista é renderizada na ordem de `line.index` e **nunca reordenada** (FR-019).
 * Ordenar por status agruparia os problemas — e destruiria a correspondência
 * visual com o texto que o usuário colou.
 */
export function ReviewScreen() {
  const stepToken = useAppStore((state) => state.stepToken);
  const items = useAppStore((state) => state.items);
  const goToStep = useAppStore((state) => state.goToStep);

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
      <StepHeading title={t.review.heading} description={t.review.intro} focusToken={stepToken} />

      <SearchProgress />

      <p className="text-ink-muted text-sm">
        {format(t.review.summaryConfident, { count: summary.confident })} ·{' '}
        {format(t.review.summaryUncertain, { count: summary.uncertain })} ·{' '}
        {format(t.review.summaryNotFound, { count: summary.notFound })}
      </p>
      <p className="text-ink text-sm font-semibold">
        {format(t.review.selectedCount, { selected: summary.selected, total: items.length })}
      </p>

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
          <MatchRow key={item.line.id} item={item} />
        ))}
      </ul>

      <PlaylistConfigForm />

      <div>
        <Button
          variant="ghost"
          onClick={() => {
            goToStep('input');
          }}
        >
          {t.common.back}
        </Button>
      </div>
    </section>
  );
}
