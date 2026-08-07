import type { AttentionReason, MatchStatus } from '@/domain/types';
import { t } from '@/i18n/pt-BR';
import { cx } from '@/ui/cx';

/**
 * Selo de status (FR-022) e de duplicata (FR-018).
 *
 * Mapa explícito de `MatchStatus` para classes literais. Montar
 * `` `border-status-${status}` `` pareceria mais curto e sumiria do CSS emitido —
 * a falha que só aparece no build (research §14).
 */
const STATUS_CLASSES: Record<MatchStatus, string> = {
  pending: 'border-border-strong bg-status-neutral-soft text-status-neutral',
  searching: 'border-border-strong bg-status-neutral-soft text-status-neutral',
  confident: 'border-status-confident bg-status-confident-soft text-status-confident',
  uncertain: 'border-status-uncertain bg-status-uncertain-soft text-status-uncertain',
  not_found: 'border-status-not-found bg-status-not-found-soft text-status-not-found',
  unparsed: 'border-status-uncertain bg-status-uncertain-soft text-status-uncertain',
  discarded: 'border-border-strong bg-status-neutral-soft text-status-neutral',
};

const STATUS_LABEL: Record<MatchStatus, string> = {
  pending: t.review.status.pending,
  searching: t.review.status.searching,
  confident: t.review.status.confident,
  uncertain: t.review.status.uncertain,
  not_found: t.review.status.notFound,
  unparsed: t.review.status.unparsed,
  discarded: t.review.status.discarded,
};

const DUPLICATE_CLASSES = 'border-status-uncertain bg-status-uncertain-soft text-status-uncertain';
const ERROR_CLASSES = 'border-status-not-found bg-status-not-found-soft text-status-not-found';

export interface StatusBadgeProps {
  status: MatchStatus;
  duplicate?: boolean;
  errored?: boolean;
}

export function StatusBadge({ status, duplicate = false, errored = false }: StatusBadgeProps) {
  return (
    <span className="flex flex-wrap gap-1">
      <span className={cx('status-badge', STATUS_CLASSES[status])}>{STATUS_LABEL[status]}</span>
      {duplicate && (
        <span className={cx('status-badge', DUPLICATE_CLASSES)}>{t.review.status.duplicate}</span>
      )}
      {errored && (
        <span className={cx('status-badge', ERROR_CLASSES)}>{t.review.status.error}</span>
      )}
    </span>
  );
}

const STATUS_HINT: Partial<Record<MatchStatus, string>> = {
  confident: t.review.statusHint.confident,
  uncertain: t.review.statusHint.uncertain,
  not_found: t.review.statusHint.notFound,
  unparsed: t.review.statusHint.unparsed,
};

export function statusHint(status: MatchStatus, duplicate: boolean): string | null {
  if (duplicate) return t.review.statusHint.duplicate;
  return STATUS_HINT[status] ?? null;
}

/**
 * Frase do motivo de atenção (`003/FR-017`).
 *
 * O motivo é dado no domínio e traduzido aqui — o mapa existe para que a
 * exaustividade seja verificada pelo compilador: um motivo novo em
 * `AttentionReason` quebra este `Record` antes de chegar à tela sem texto.
 */
const REASON_TEXT: Record<AttentionReason, string> = {
  no_artist_ambiguous: t.review.attentionReason.noArtistAmbiguous,
  version_hint: t.review.attentionReason.versionHint,
  not_found: t.review.attentionReason.notFound,
  retry_skipped_quota: t.review.attentionReason.retrySkippedQuota,
};

export function attentionText(reason: AttentionReason | null): string | null {
  return reason === null ? null : REASON_TEXT[reason];
}
