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
 *
 * **Por que texto oculto e não `aria-label`**: o ARIA proíbe nomear um elemento
 * sem papel semântico, e um `<span>` é `role="generic"`. Um `aria-label` ali é
 * ignorado por parte dos leitores de tela e acusado pelo axe
 * (`aria-prohibited-attr`) — ou seja, a versão anterior deste selo prometia
 * acessibilidade que não entregava. A frase completa vive em um `sr-only`, e a
 * abreviada continua visível.
 */
export function VersionHintBadge({ hints }: VersionHintBadgeProps) {
  if (hints.length === 0) return null;

  const labels = hints.map((hint) => t.versionHints[hint]);

  return (
    <span className="border-state-uncertain-edge text-state-uncertain inline-flex items-center gap-1 rounded-pill border px-2 py-1 text-meta font-semibold">
      <span className="sr-only">
        {format(t.versionHints.badgeLabelFor, { hints: labels.join(', ') })}
      </span>
      <span aria-hidden="true">{t.versionHints.badgeLabel}</span>
      <span aria-hidden="true">· {labels.join(', ')}</span>
    </span>
  );
}
