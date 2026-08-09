/**
 * Controle de tema (US1, FR-006, FR-022, SC-010).
 *
 * Três propriedades que o componente precisa cumprir literalmente:
 *
 * - **operável por teclado** no padrão de `radiogroup` — setas movem e
 *   selecionam, e o grupo inteiro é uma única parada de Tab (SC-016);
 * - **estado anunciado** por `aria-checked`, não só pela aparência do segmento;
 * - **nome acessível preservado no modo colapsado**, onde só o ícone aparece —
 *   o rótulo vira `sr-only`, não desaparece.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ThemeControl } from '@/features/theme/ThemeControl';
import { t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';

function segments(): HTMLElement[] {
  return screen.getAllByRole('radio');
}

describe('FR-006 · três opções, não um interruptor', () => {
  it('expõe um radiogroup rotulado com os três temas', () => {
    render(<ThemeControl />);

    const group = screen.getByRole('radiogroup', { name: t.theme.groupLabel });
    expect(group).toBeInTheDocument();

    expect(segments().map((node) => node.textContent)).toEqual([
      t.theme.light,
      t.theme.dark,
      t.theme.system,
    ]);
  });

  it('o nome acessível é a palavra, não o ícone — inclusive no modo colapsado', () => {
    // O rótulo é `sr-only` abaixo do ponto de corte da casca, e `sr-only`
    // continua na árvore de acessibilidade. Se ele fosse removido do DOM, esta
    // consulta por nome falharia — que é exatamente a regressão a impedir.
    render(<ThemeControl />);

    for (const label of [t.theme.light, t.theme.dark, t.theme.system]) {
      expect(screen.getByRole('radio', { name: label })).toBeInTheDocument();
    }
  });

  it('007/FR-030 · os ícones vêm do mapa de papéis e são decorativos', () => {
    // Os três SVGs escritos à mão da 005 saíram; entraram `theme-light`,
    // `theme-dark` e `theme-system` do mapa único. O que **não** pode mudar é a
    // semântica: o ícone acompanha um rótulo e por isso é decoração — se ele
    // ganhasse nome acessível, o leitor de tela leria "sol Claro" (FR-058).
    const { container } = render(<ThemeControl />);

    const glifos = container.querySelectorAll('.icon-glyph');
    expect(glifos).toHaveLength(3);
    for (const glifo of glifos) {
      expect(glifo.getAttribute('aria-hidden')).toBe('true');
      // Herda a cor do contexto; nunca fixa a própria (SC-017).
      expect(glifo.getAttribute('color')).toBe('currentColor');
    }
  });

  it('parte de "Sistema" selecionado, que é o estado inicial de todos', () => {
    render(<ThemeControl />);

    expect(screen.getByRole('radio', { name: t.theme.system })).toBeChecked();
    expect(screen.getByRole('radio', { name: t.theme.light })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: t.theme.dark })).not.toBeChecked();
  });
});

describe('SC-010 · seleção por teclado', () => {
  it('o grupo é uma única parada de Tab: só o selecionado é tabulável', () => {
    render(<ThemeControl />);

    const tabbable = segments().filter((node) => node.getAttribute('tabindex') === '0');
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0]).toBeChecked();
  });

  it('a seta para a direita move e seleciona o segmento seguinte', async () => {
    const user = userEvent.setup();
    render(<ThemeControl />);

    await user.tab();
    expect(screen.getByRole('radio', { name: t.theme.system })).toHaveFocus();

    await user.keyboard('{ArrowRight}');

    const claro = screen.getByRole('radio', { name: t.theme.light });
    expect(claro).toBeChecked();
    expect(claro).toHaveFocus();
    expect(useAppStore.getState().themePreference).toBe('light');
  });

  it('a seta para a esquerda percorre na outra direção e dá a volta', async () => {
    const user = userEvent.setup();
    render(<ThemeControl />);

    await user.tab();
    await user.keyboard('{ArrowLeft}');

    expect(screen.getByRole('radio', { name: t.theme.dark })).toBeChecked();
    expect(useAppStore.getState().themePreference).toBe('dark');
  });

  it('a seta para baixo e para cima fazem o mesmo que direita e esquerda', async () => {
    const user = userEvent.setup();
    render(<ThemeControl />);

    await user.tab();
    await user.keyboard('{ArrowDown}');
    expect(useAppStore.getState().themePreference).toBe('light');

    await user.keyboard('{ArrowUp}');
    expect(useAppStore.getState().themePreference).toBe('system');
  });

  it('o clique seleciona e o estado é anunciado por aria-checked', async () => {
    const user = userEvent.setup();
    render(<ThemeControl />);

    await user.click(screen.getByRole('radio', { name: t.theme.dark }));

    expect(screen.getByRole('radio', { name: t.theme.dark })).toBeChecked();
    expect(screen.getByRole('radio', { name: t.theme.system })).not.toBeChecked();
    expect(useAppStore.getState().themePreference).toBe('dark');
  });
});

describe('FR-009 · voltar a acompanhar o sistema continua alcançável', () => {
  it('depois de escolher "Escuro", "Sistema" ainda é selecionável', async () => {
    const user = userEvent.setup();
    render(<ThemeControl />);

    await user.click(screen.getByRole('radio', { name: t.theme.dark }));
    await user.click(screen.getByRole('radio', { name: t.theme.system }));

    expect(useAppStore.getState().themePreference).toBe('system');
    expect(screen.getByRole('radio', { name: t.theme.system })).toBeChecked();
  });
});
