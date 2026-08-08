/**
 * A regra de tema, inteira, como dado puro (data-model.md §2).
 *
 * Toda a complexidade aparente do recurso — `matchMedia`, `localStorage`, o
 * atributo no elemento raiz, o script que roda antes da primeira pintura — mora
 * **fora** daqui, no I/O (Princípio III). O que sobra é uma tabela de quatro
 * linhas, e é ela que FR-005, FR-008 e FR-009 especificam.
 */

/** O que o usuário escolheu. Persiste. */
export type ThemePreference = 'light' | 'dark' | 'system';

/** O que está pintado na tela. Nunca persiste — é derivado. */
export type EffectiveTheme = 'light' | 'dark';

export const THEME_PREFERENCES: readonly ThemePreference[] = ['light', 'dark', 'system'] as const;

/**
 * Estado inicial de todos.
 *
 * `'system'` **é gravado**, não representado por ausência da chave. Voltar a
 * acompanhar o sistema é escolha tão explícita quanto as outras, e apagar a
 * chave em vez de gravar tornaria os dois estados indistinguíveis para qualquer
 * teste (data-model.md §1).
 */
export const DEFAULT_PREFERENCE: ThemePreference = 'system';

/** Guarda de forma para valor vindo do armazenamento ou da URL. */
export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (THEME_PREFERENCES as readonly string[]).includes(value);
}

/**
 * Normaliza qualquer entrada para uma preferência válida.
 *
 * Valor desconhecido vira `'system'` em silêncio (FR-011). Não é tolerância
 * frouxa: uma preferência de cor corrompida não é assunto do usuário, e
 * qualquer tratamento visível seria pior que o problema.
 */
export function toThemePreference(value: unknown): ThemePreference {
  return isThemePreference(value) ? value : DEFAULT_PREFERENCE;
}

/**
 * A tabela de quatro linhas de data-model.md §2.
 *
 * | preferência | sistema em escuro | resultado |
 * | --- | --- | --- |
 * | `'light'`  | qualquer | `'light'` |
 * | `'dark'`   | qualquer | `'dark'`  |
 * | `'system'` | `false`  | `'light'` |
 * | `'system'` | `true`   | `'dark'`  |
 *
 * Mudança na preferência do sistema só produz efeito no estado `'system'`. Nos
 * outros dois o evento chega e é **ignorado deliberadamente** — a escolha manual
 * vence (FR-009).
 */
export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): EffectiveTheme {
  if (preference === 'light') return 'light';
  if (preference === 'dark') return 'dark';
  return systemPrefersDark ? 'dark' : 'light';
}
