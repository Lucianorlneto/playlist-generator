import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PREFERENCE,
  isThemePreference,
  resolveTheme,
  THEME_PREFERENCES,
  toThemePreference,
  type ThemePreference,
} from '@/domain/theme';

/**
 * O núcleo testável da feature (T021).
 *
 * A tabela de quatro linhas de data-model.md §2 é a especificação inteira de
 * FR-005, FR-008 e FR-009 — e cabe aqui. Tudo o que parece complicado no
 * recurso está no I/O, que estes casos não tocam.
 */

describe('FR-005 e FR-008 · resolveTheme cobre as quatro combinações', () => {
  it.each([
    ['light', false, 'light'],
    ['light', true, 'light'],
    ['dark', false, 'dark'],
    ['dark', true, 'dark'],
    ['system', false, 'light'],
    ['system', true, 'dark'],
  ] as const)(
    'preferência %s com sistema em escuro=%s resolve para %s',
    (preference, systemPrefersDark, expected) => {
      expect(resolveTheme(preference, systemPrefersDark)).toBe(expected);
    },
  );
});

describe('FR-009 · a escolha manual ignora a preferência do sistema', () => {
  it.each(['light', 'dark'] as const)(
    'com preferência %s, alternar o sistema não muda o tema efetivo',
    (preference) => {
      expect(resolveTheme(preference, false)).toBe(resolveTheme(preference, true));
    },
  );

  it('com preferência "system", alternar o sistema muda o tema efetivo', () => {
    expect(resolveTheme('system', false)).not.toBe(resolveTheme('system', true));
  });
});

describe('FR-011 · valor desconhecido volta a acompanhar o sistema, em silêncio', () => {
  it('o estado inicial é "system"', () => {
    expect(DEFAULT_PREFERENCE).toBe('system');
  });

  it.each([
    ['string fora do conjunto', 'roxo'],
    ['string vazia', ''],
    ['nulo', null],
    ['indefinido', undefined],
    ['número', 1],
    ['booleano', true],
    ['objeto', { preference: 'dark' }],
    ['arranjo', ['dark']],
    ['diferença de caixa', 'Dark'],
  ])('%s vira "system" sem lançar', (_rotulo, value) => {
    expect(() => toThemePreference(value)).not.toThrow();
    expect(toThemePreference(value)).toBe('system');
  });

  it.each(THEME_PREFERENCES)('a preferência válida %s é preservada', (preference) => {
    expect(toThemePreference(preference)).toBe(preference);
  });

  it('isThemePreference aceita exatamente os três valores do conjunto', () => {
    const aceitos = ['light', 'dark', 'system', 'auto', 'Dark', '', null].filter((v) =>
      isThemePreference(v),
    );
    expect(aceitos).toEqual<ThemePreference[]>(['light', 'dark', 'system']);
  });
});
