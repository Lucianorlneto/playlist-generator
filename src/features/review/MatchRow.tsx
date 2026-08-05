import { useState } from 'react';

import type { MatchItem } from '@/domain/types';
import { format, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
import { Button } from '@/ui/Button';

import { Alternatives } from './Alternatives';
import { formatDuration } from './formatDuration';
import { LineEditor } from './LineEditor';
import { REVIEW_GRID } from './reviewGrid';
import { StatusBadge, statusHint } from './StatusBadge';

export interface MatchRowProps {
  item: MatchItem;
}

/**
 * Um item da revisão: linha original, faixa escolhida e ações.
 *
 * Layout **mobile-first** (research §12): cartão empilhado por padrão, virando
 * colunas alinhadas a partir de `sm:` (640 px). A inversão é o que garante
 * SC-012 — o caso estreito é o comportamento padrão, não uma exceção que alguém
 * precisa lembrar de escrever. Nenhuma largura fixa em pixels: as colunas usam
 * `minmax(0, …)`, o que permite o conteúdo encolher em vez de estourar a página.
 */
export function MatchRow({ item }: MatchRowProps) {
  const toggleIncluded = useAppStore((state) => state.toggleIncluded);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [editing, setEditing] = useState(false);

  const selected = item.candidates.find((candidate) => candidate.uri === item.selectedUri) ?? null;
  const duplicate = item.duplicateOf !== null;
  const hint = statusHint(item.status, duplicate);

  if (editing) {
    return (
      <li className="app-card flex flex-col gap-2">
        <p className="text-ink-muted font-mono text-sm break-words">{item.line.raw}</p>
        <LineEditor
          item={item}
          onDone={() => {
            setEditing(false);
          }}
        />
      </li>
    );
  }

  return (
    <li className="app-card flex flex-col gap-2">
      <div className={REVIEW_GRID}>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            className="focus-ring accent-accent size-4"
            checked={item.included}
            disabled={item.selectedUri === null || item.status === 'discarded'}
            aria-label={format(t.review.includeLabelFor, { line: item.line.raw })}
            onChange={() => {
              toggleIncluded(item.line.id);
            }}
          />
        </div>

        <div className="min-w-0">
          <p className="text-ink-muted text-xs sm:hidden">{t.review.originalLine}</p>
          <p className="text-ink font-mono text-sm break-words">{item.line.raw}</p>
        </div>

        <div className="min-w-0">
          {selected === null ? (
            <p className="text-ink-muted text-sm">{t.review.noSelection}</p>
          ) : (
            <div className="flex min-w-0 items-center gap-2">
              {selected.coverUrl === null ? (
                <span className="border-border bg-surface-sunken text-ink-muted flex size-10 shrink-0 items-center justify-center rounded border text-center text-[0.6rem]">
                  {t.review.noCover}
                </span>
              ) : (
                <img
                  src={selected.coverUrl}
                  alt={format(t.review.coverAlt, { album: selected.album })}
                  className="border-border size-10 shrink-0 rounded border object-cover"
                  loading="lazy"
                />
              )}
              <div className="min-w-0 text-sm">
                <p className="text-ink truncate font-semibold">{selected.title}</p>
                <p className="text-ink-muted truncate">
                  {selected.artists.join(', ')} · {selected.album} ·{' '}
                  {formatDuration(selected.durationMs)}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col items-start gap-1 sm:items-end">
          <StatusBadge status={item.status} duplicate={duplicate} errored={item.error !== null} />
        </div>
      </div>

      {hint !== null && <p className="field-message">{hint}</p>}
      {item.error !== null && <p className="field-message text-status-not-found">{item.error}</p>}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="ghost"
          aria-expanded={showAlternatives}
          onClick={() => {
            setShowAlternatives((open) => !open);
          }}
        >
          {t.review.alternatives}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setEditing(true);
          }}
        >
          {t.review.editLine}
        </Button>
        {selected !== null && selected.externalUrl !== '' && (
          <a
            href={selected.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring self-center text-sm underline"
          >
            {t.review.openInSpotify}
          </a>
        )}
      </div>

      {showAlternatives && <Alternatives item={item} />}
    </li>
  );
}
