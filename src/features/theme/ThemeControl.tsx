import type { JSX } from 'react';
import { useId, useRef } from 'react';

import { THEME_PREFERENCES, type ThemePreference } from '@/domain/theme';
import { t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
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

const ICONS: Record<ThemePreference, JSX.Element> = {
  light: (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4" fill="currentColor">
      <circle cx="8" cy="8" r="3.25" />
      <path d="M8 .5v2M8 13.5v2M.5 8h2M13.5 8h2M2.7 2.7l1.4 1.4M11.9 11.9l1.4 1.4M13.3 2.7l-1.4 1.4M4.1 11.9l-1.4 1.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  dark: (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4" fill="currentColor">
      <path d="M13.5 9.6A5.8 5.8 0 0 1 6.4 2.5a5.8 5.8 0 1 0 7.1 7.1Z" />
    </svg>
  ),
  system: (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.3">
      <rect x="1.6" y="2.6" width="12.8" height="8.8" rx="1.2" />
      <path d="M5.5 13.8h5" strokeLinecap="round" />
    </svg>
  ),
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
            {ICONS[option]}
            {/*
              Abaixo do breakpoint da goteira sobra só o ícone. O rótulo vira
              `sr-only` em vez de sumir: o nome acessível continua sendo a
              palavra, não o desenho (FR-006, SC-010).
            */}
            <span className="sr-only gutter:not-sr-only">{LABELS[option]}</span>
          </button>
        );
      })}
    </div>
  );
}
