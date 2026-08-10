import type { VersionHint } from '@/domain/types';
import { format, t } from '@/i18n/pt-BR';

import { Icon } from './Icon';

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
    /*
      **A analogia adotada** (FR-063, FR-064): o design não desenha este selo, e
      o mais próximo que ele define é o selo de correspondência. Daí vem a
      anatomia completa de FR-024 — fundo tingido, contorno na cor do estado,
      ícone e rótulo —, e **nunca** preenchimento sólido, que neste sistema
      significa acionável. Um selo âmbar preenchido seria indistinguível do botão
      primário, que também é âmbar.

      O `status-badge` é o utilitário que carrega essa anatomia base; o que muda
      por estado é só a tinta.

      **Reconferido na 008** (FR-008, T021a): o selo aparece exclusivamente
      dentro da linha de correspondência e do painel de alternativas, e os dois
      correspondem a cartões que o arquivo desenha (`g3IhDr`, `bC8Yk`). O
      substrato atrás dele **não** mudou com a saída da moldura do `Wizard`, e
      por isso nada aqui precisou ser redesenhado.
    */
    <span className="status-badge border-state-uncertain-edge bg-state-uncertain-tint text-state-uncertain">
      <span className="sr-only">
        {format(t.versionHints.badgeLabelFor, { hints: labels.join(', ') })}
      </span>
      {/*
        Decorativo: o selo já tem rótulo, e FR-042 proíbe o ícone de ser o único
        portador do estado. Ele é a quarta pista, depois da tinta, do contorno e
        do texto.
      */}
      <Icon role="uncertain" />
      <span aria-hidden="true">{t.versionHints.badgeLabel}</span>
      <span aria-hidden="true">· {labels.join(', ')}</span>
    </span>
  );
}
