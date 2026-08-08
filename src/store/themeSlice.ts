/**
 * Preferência e tema efetivo (data-model.md §2).
 *
 * **Fatia deliberadamente isolada.** O invariante que amarra o resto do produto
 * é que trocar de tema altera `EffectiveTheme` e nada mais: não muda etapa, não
 * descarta entrada digitada, não interrompe busca em andamento, criação em lote
 * nem espera por limitação de taxa (FR-007).
 *
 * Na prática isso significa que o tema **não pode morar no caminho de
 * reidratação do rascunho** — e não mora: `toWorkDraft` é uma lista explícita de
 * campos e `resetWork` monta um objeto explícito, então nenhum dos dois alcança
 * o que está aqui. O isolamento é por construção, não por disciplina.
 */

import {
  resolveTheme,
  type EffectiveTheme,
  type ThemePreference,
} from '@/domain/theme';
import { saveThemePreference } from '@/services/storage/themeRepo';

import type { SliceCreator } from './types';

export interface ThemeSlice {
  /** O que o usuário escolheu. */
  themePreference: ThemePreference;
  /** O que o sistema operacional pede agora. */
  systemPrefersDark: boolean;
  /** O que está pintado. Derivado dos dois acima. */
  effectiveTheme: EffectiveTheme;

  /** Escolha explícita do usuário. Persiste. */
  setThemePreference: (preference: ThemePreference) => void;
  /**
   * Chegou um evento do sistema. **Só produz efeito quando a preferência é
   * `'system'`** — nos outros dois estados o evento é ignorado por decisão
   * (FR-009), e o registro de `systemPrefersDark` é mantido para que voltar a
   * "Sistema" já resolva com o valor certo, sem esperar o próximo evento.
   */
  setSystemPrefersDark: (prefersDark: boolean) => void;
  /** Semeadura do arranque, sem gravar — o valor acabou de vir do disco. */
  hydrateTheme: (preference: ThemePreference, prefersDark: boolean) => void;
}

export const createThemeSlice: SliceCreator<ThemeSlice> = (set) => ({
  themePreference: 'system',
  systemPrefersDark: false,
  effectiveTheme: 'light',

  setThemePreference: (preference) =>
    set((state) => {
      saveThemePreference(preference);
      return {
        themePreference: preference,
        effectiveTheme: resolveTheme(preference, state.systemPrefersDark),
      };
    }),

  setSystemPrefersDark: (prefersDark) =>
    set((state) => ({
      systemPrefersDark: prefersDark,
      effectiveTheme: resolveTheme(state.themePreference, prefersDark),
    })),

  hydrateTheme: (preference, prefersDark) =>
    set({
      themePreference: preference,
      systemPrefersDark: prefersDark,
      effectiveTheme: resolveTheme(preference, prefersDark),
    }),
});
