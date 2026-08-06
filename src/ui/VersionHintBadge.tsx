import type { VersionHint } from '@/domain/types';
import { format, t } from '@/i18n/pt-BR';

export interface VersionHintBadgeProps {
  hints: readonly VersionHint[];
}

/**
 * Marcador visível de "pode ser outra versão" (FR-025).
 *
 * O indício aparece **na hora da decisão**, junto da candidata, não escondido
 * atrás de um clique: FR-025 pede que ele esteja à vista, e o rebaixamento
 * automático para `Incerta` só faz sentido se o usuário puder ver por quê.
 *
 * O rótulo acessível lista os indícios por extenso — um selo colorido sem nome
 * não diz nada a quem usa leitor de tela.
 */
export function VersionHintBadge({ hints }: VersionHintBadgeProps) {
  if (hints.length === 0) return null;

  const labels = hints.map((hint) => t.versionHints[hint]);

  return (
    <span
      className="border-status-uncertain text-status-uncertain inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold"
      aria-label={format(t.versionHints.badgeLabelFor, { hints: labels.join(', ') })}
    >
      <span aria-hidden="true">{t.versionHints.badgeLabel}</span>
      <span aria-hidden="true">· {labels.join(', ')}</span>
    </span>
  );
}
