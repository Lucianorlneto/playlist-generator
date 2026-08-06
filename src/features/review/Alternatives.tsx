import { capabilitiesOf, type ProviderId } from '@/domain/providers';
import type { MatchItem } from '@/domain/types';
import { format, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
import { Button } from '@/ui/Button';
import { VersionHintBadge } from '@/ui/VersionHintBadge';

import { formatDuration } from './formatDuration';

export interface AlternativesProps {
  item: MatchItem;
  provider: ProviderId;
}

/**
 * Até cinco candidatas por item (FR-023), com troca da escolhida ou descarte do
 * item inteiro. A lista já vem ordenada por pontuação decrescente do adaptador —
 * a ordem devolvida pela plataforma não é usada como verdade.
 *
 * Cada candidata carrega seu próprio marcador de versão (FR-025): é aqui que a
 * escolha entre "a oficial" e "a ao vivo" acontece, então é aqui que o indício
 * precisa estar visível.
 */
export function Alternatives({ item, provider }: AlternativesProps) {
  const chooseCandidate = useAppStore((state) => state.chooseCandidate);
  const discardItem = useAppStore((state) => state.discardItem);
  const restoreItem = useAppStore((state) => state.restoreItem);

  const discarded = item.status === 'discarded';
  const showsAlbum = capabilitiesOf(provider).showsAlbum;

  return (
    <div className="border-border bg-surface-muted mt-2 rounded-lg border p-2">
      <h4 className="text-ink text-sm font-semibold">
        {format(t.review.alternativesHeading, { line: item.line.raw })}
      </h4>

      {item.candidates.length === 0 ? (
        <p className="field-message">{t.review.alternativesEmpty}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {item.candidates.map((candidate) => {
            const chosen = candidate.uri === item.selectedUri;
            return (
              <li
                key={candidate.uri}
                className="border-border bg-surface flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2"
              >
                <div className="min-w-0 text-sm">
                  <p className="text-ink font-semibold">{candidate.title}</p>
                  <p className="text-ink-muted">
                    {showsAlbum
                      ? `${candidate.artists.join(', ')} · ${candidate.album} · ${formatDuration(candidate.durationMs)}`
                      : `${t.review.channel}: ${candidate.channel ?? candidate.artists.join(', ')} · ${formatDuration(candidate.durationMs)}`}
                  </p>
                  <VersionHintBadge hints={candidate.versionHints ?? []} />
                </div>
                {chosen ? (
                  <span className="text-status-confident text-xs font-semibold">
                    {t.review.chosenCandidate}
                  </span>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => {
                      chooseCandidate(item.line.id, candidate.uri);
                    }}
                  >
                    {t.review.chooseCandidate}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-2">
        <Button
          size="sm"
          variant={discarded ? 'secondary' : 'danger'}
          onClick={() => {
            if (discarded) restoreItem(item.line.id);
            else discardItem(item.line.id);
          }}
        >
          {discarded ? t.review.restoreItem : t.review.discardItem}
        </Button>
      </div>
    </div>
  );
}
