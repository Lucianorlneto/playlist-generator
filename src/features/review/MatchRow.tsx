import { useState } from 'react';

import { capabilitiesOf, type ProviderId } from '@/domain/providers';
import type { MatchItem } from '@/domain/types';
import { nameOf } from '@/features/credential/providerText';
import { format, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
import { Button } from '@/ui/Button';
import { VersionHintBadge } from '@/ui/VersionHintBadge';

import { Alternatives } from './Alternatives';
import { formatDuration } from './formatDuration';
import { LineEditor } from './LineEditor';
import { REVIEW_GRID } from './reviewGrid';
import { StatusBadge, statusHint } from './StatusBadge';

export interface MatchRowProps {
  item: MatchItem;
  provider: ProviderId;
}

/**
 * Um item da revisão: linha original, faixa escolhida e ações.
 *
 * **Álbum ou canal, nunca os dois, e nunca álbum vazio** (FR-024, invariante
 * K1): a segunda linha lê `capabilities.showsAlbum` para decidir. No catálogo de
 * vídeo não existe álbum, e exibir um campo vazio rotulado "Álbum" prometeria um
 * dado que a plataforma não tem.
 *
 * Layout **mobile-first**: cartão empilhado por padrão, virando colunas
 * alinhadas a partir de `sm:` (640 px). Nenhuma largura fixa em pixels — as
 * colunas usam `minmax(0, …)`, o que permite o conteúdo encolher em vez de
 * estourar a página.
 */
export function MatchRow({ item, provider }: MatchRowProps) {
  const toggleIncluded = useAppStore((state) => state.toggleIncluded);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [editing, setEditing] = useState(false);

  const selected = item.candidates.find((candidate) => candidate.uri === item.selectedUri) ?? null;
  const duplicate = item.duplicateOf !== null;
  const hint = statusHint(item.status, duplicate);
  const showsAlbum = capabilitiesOf(provider).showsAlbum;
  const service = nameOf(provider);
  const hints = selected?.versionHints ?? [];

  if (editing) {
    return (
      <li className="app-card flex flex-col gap-2">
        <p className="text-ink-muted font-mono text-sm break-words">{item.line.raw}</p>
        <LineEditor
          item={item}
          provider={provider}
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
                  alt={
                    showsAlbum
                      ? format(t.review.coverAlt, { album: selected.album })
                      : format(t.review.thumbnailAlt, { title: selected.title })
                  }
                  className="border-border size-10 shrink-0 rounded border object-cover"
                  loading="lazy"
                />
              )}
              <div className="min-w-0 text-sm">
                <p className="text-ink truncate font-semibold">{selected.title}</p>
                <p className="text-ink-muted truncate">
                  {showsAlbum
                    ? `${selected.artists.join(', ')} · ${selected.album} · ${formatDuration(selected.durationMs)}`
                    : `${t.review.channel}: ${selected.channel ?? selected.artists.join(', ')} · ${formatDuration(selected.durationMs)}`}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col items-start gap-1 sm:items-end">
          <StatusBadge status={item.status} duplicate={duplicate} errored={item.error !== null} />
          <VersionHintBadge hints={hints} />
        </div>
      </div>

      {hints.length > 0 && <p className="field-message">{t.review.statusHint.versionHint}</p>}
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
            {format(t.review.openExternal, { service })}
          </a>
        )}
      </div>

      {showAlternatives && <Alternatives item={item} provider={provider} />}
    </li>
  );
}
