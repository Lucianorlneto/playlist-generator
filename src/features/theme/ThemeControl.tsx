import { useId, useRef } from 'react';

import { THEME_PREFERENCES, type ThemePreference } from '@/domain/theme';
import { t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
import { Icon } from '@/ui/Icon';
import type { IconRole } from '@/ui/icons';
import { cx } from '@/ui/cx';

/**
 * Escolha de tema — três opções, não um interruptor (research §8).
 *
 * Um interruptor binário sol/lua satisfaz a letra do FR-006 e é mais compacto,
 * mas torna o comportamento do FR-009 inalcançável depois do primeiro clique: a
 * preferência do usuário existiria, sem caminho de volta a "acompanhar o
 * sistema" que não fosse limpar o armazenamento do navegador. Três segmentos
 * curtos custam pouco espaço e tornam legível um comportamento que, escondido,
 * parece mágica.
 *
 * Padrão de `radiogroup`: as setas movem **e** selecionam, e só o segmento
 * selecionado fica na ordem de tabulação — é o que faz o grupo inteiro contar
 * como uma parada de Tab, sem inflar o caminho de teclado do cabeçalho (SC-016).
 */

/**
 * Papéis do mapa único, no lugar dos três SVGs escritos à mão da 005.
 *
 * Os desenhos anteriores eram corretos e custavam zero dependência — a troca é
 * consequência da decisão de padronização registrada no **Complexity Tracking**
 * do plano, não de um defeito neles. O que se ganha aqui é concreto: o ícone
 * "sistema" era um retângulo com um traço embaixo, e nada no código dizia que
 * ele deveria ser um monitor. Agora diz: o papel `theme-system` resolve para
 * `monitor`, que é o nome no arquivo de design.
 */
const ICON_ROLE: Record<ThemePreference, IconRole> = {
  light: 'theme-light',
  dark: 'theme-dark',
  system: 'theme-system',
};

const LABELS: Record<ThemePreference, string> = {
  light: t.theme.light,
  dark: t.theme.dark,
  system: t.theme.system,
};

/**
 * Mapa explícito de literais, nunca concatenação: o scanner do Tailwind lê o
 * código como texto e não resolve expressão (`tp/no-dynamic-classname`).
 */
const SEGMENT = {
  selected: 'bg-surface-raised text-ink border-rule-strong',
  unselected: 'border-transparent text-ink-muted hover:text-ink',
} as const;

export function ThemeControl() {
  const preference = useAppStore((state) => state.themePreference);
  const setPreference = useAppStore((state) => state.setThemePreference);

  const groupId = useId();
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  function move(offset: number): void {
    const index = THEME_PREFERENCES.indexOf(preference);
    const next = THEME_PREFERENCES[(index + offset + THEME_PREFERENCES.length) % THEME_PREFERENCES.length];
    if (next === undefined) return;
    setPreference(next);
    // O foco acompanha a seleção — é o que o padrão de `radiogroup` espera, e
    // sem isso a seta seguinte partiria do segmento errado.
    buttons.current[THEME_PREFERENCES.indexOf(next)]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-labelledby={groupId}
      className="border-rule inline-flex items-center gap-0 rounded-pill border p-1"
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          event.preventDefault();
          move(1);
          return;
        }
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          event.preventDefault();
          move(-1);
        }
      }}
    >
      <span id={groupId} className="sr-only">
        {t.theme.groupLabel}
      </span>

      {THEME_PREFERENCES.map((option, index) => {
        const selected = option === preference;
        return (
          <button
            key={option}
            ref={(node) => {
              buttons.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            // Só o selecionado participa da tabulação: o grupo é uma parada de
            // Tab, e as setas navegam dentro dele.
            tabIndex={selected ? 0 : -1}
            onClick={() => {
              setPreference(option);
            }}
            className={cx(
              'focus-ring inline-flex cursor-pointer items-center gap-1 rounded-pill border px-2 py-1 text-meta',
              selected ? SEGMENT.selected : SEGMENT.unselected,
            )}
          >
            {/*
              Decorativo: acompanha o rótulo, que está logo ao lado. Mesmo
              quando o rótulo vira `sr-only` em largura estreita ele continua
              sendo o nome acessível do botão — o ícone nunca precisa carregar
              essa função (FR-058).
            */}
            <Icon role={ICON_ROLE[option]} />
            {/*
              Abaixo do ponto de corte da casca sobra só o ícone. O rótulo vira
              `sr-only` em vez de sumir: o nome acessível continua sendo a
              palavra, não o desenho (FR-058).

              O ponto de corte era `gutter:` (40rem) na 005 e passou a ser
              `shell:` porque é o mesmo evento — a largura em que a casca
              colapsa é a largura em que a barra superior deixa de ter espaço
              para três rótulos ao lado de dois chips de conexão (FR-029).
            */}
            <span className="sr-only shell:not-sr-only">{LABELS[option]}</span>
          </button>
        );
      })}
    </div>
  );
}
