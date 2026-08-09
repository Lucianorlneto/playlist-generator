import type { AttentionReason, MatchStatus } from '@/domain/types';
import { t } from '@/i18n/pt-BR';
import { cx } from '@/ui/cx';
import { Icon } from '@/ui/Icon';
import type { IconRole } from '@/ui/icons';

/**
 * Selo de status (FR-022, FR-047, FR-048) e de duplicata (FR-018).
 *
 * **Onde a decisão do FR-047 mais importa.** A anatomia é fundo tingido + ícone
 * + rótulo textual + tinta na cor do estado, com filete de 1px — e **nunca**
 * preenchimento sólido. É essa separação por forma, não uma diferença de matiz,
 * que impede o selo "incerta" âmbar de ser lido como o botão primário âmbar.
 *
 * Três canais redundantes — cor, forma do ícone e palavra — porque o modo de
 * cores forçadas remove o primeiro e o daltonismo compromete a distinção
 * teal/âmbar para parte dos usuários. Restar dois canais é o objetivo.
 *
 * Mapa explícito de `MatchStatus` para classes literais. Montar
 * `` `border-state-${status}` `` pareceria mais curto e sumiria do CSS emitido —
 * a falha que só aparece no build (research §14).
 */

/**
 * Ícones de estado, pelos papéis do mapa único (FR-059).
 *
 * Os losangos desenhados à mão da 005 saíram. O papel `confident` é o `gem` que
 * o arquivo de design nomeia; `uncertain` e `missing` entram **por analogia**,
 * porque o design não desenha selo para incerta nem para não encontrada e
 * silêncio do design não é remoção (FR-063). A analogia está registrada em
 * `contracts/icons.md` §2 e no guia de estilo (FR-064).
 *
 * `pending`, `searching` e `discarded` continuam sem ícone: são ausência de
 * resultado, não um resultado. Dar-lhes um glifo sugeriria que algo foi decidido.
 */
const STATUS_ICON: Record<MatchStatus, IconRole | null> = {
  pending: null,
  searching: 'loading',
  confident: 'confident',
  uncertain: 'uncertain',
  not_found: 'missing',
  unparsed: 'uncertain',
  discarded: null,
};

const STATUS_CLASSES: Record<MatchStatus, string> = {
  pending: 'border-rule-strong bg-state-neutral-tint text-ink-muted',
  searching: 'border-rule-strong bg-state-neutral-tint text-ink-muted',
  confident: 'border-state-confident-edge bg-state-confident-tint text-state-confident',
  uncertain: 'border-state-uncertain-edge bg-state-uncertain-tint text-state-uncertain',
  not_found: 'border-state-missing-edge bg-state-missing-tint text-state-missing',
  unparsed: 'border-state-uncertain-edge bg-state-uncertain-tint text-state-uncertain',
  discarded: 'border-rule-strong bg-state-neutral-tint text-ink-muted',
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

const DUPLICATE_CLASSES = 'border-state-uncertain-edge bg-state-uncertain-tint text-state-uncertain';
const ERROR_CLASSES = 'border-state-missing-edge bg-state-missing-tint text-state-missing';

export interface StatusBadgeProps {
  status: MatchStatus;
  duplicate?: boolean;
  errored?: boolean;
}

export function StatusBadge({ status, duplicate = false, errored = false }: StatusBadgeProps) {
  const icon = STATUS_ICON[status];

  return (
    <span className="flex flex-wrap gap-1">
      <span className={cx('status-badge', STATUS_CLASSES[status])}>
        {/*
          Decorativo em todos os casos: o rótulo do estado está escrito ao lado.
          FR-042 proíbe o ícone de ser o único portador — aqui ele é o quarto
          canal, depois da tinta, do fundo tingido e da palavra.
        */}
        {icon !== null && <Icon role={icon} />}
        {STATUS_LABEL[status]}
      </span>
      {duplicate && (
        <span className={cx('status-badge', DUPLICATE_CLASSES)}>
          <Icon role="uncertain" />
          {t.review.status.duplicate}
        </span>
      )}
      {errored && (
        <span className={cx('status-badge', ERROR_CLASSES)}>
          <Icon role="missing" />
          {t.review.status.error}
        </span>
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
