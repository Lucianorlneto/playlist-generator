/**
 * Persistência da preferência de tema (contracts/storage.md).
 *
 * Não há tratamento de erro próprio aqui, e isso é a decisão, não a omissão:
 * `readVersioned` já devolve `null` com aviso para armazenamento indisponível,
 * JSON corrompido, forma inválida e versão divergente — exatamente o
 * comportamento que FR-011 pede. Repetir esse tratamento criaria um segundo
 * lugar onde ele pode divergir.
 */

import { toThemePreference, type ThemePreference } from '@/domain/theme';

import { asString, readVersioned, STORAGE_KEYS, writeVersioned } from './schema';

interface ThemeRecord {
  readonly preference: ThemePreference;
}

/**
 * Lê a preferência gravada.
 *
 * Devolve `'system'` em **toda** situação de falha, incluindo a ausência da
 * chave — que é o estado inicial legítimo e não uma anomalia (FR-011, FR-012).
 */
export function loadThemePreference(): ThemePreference {
  const record = readVersioned<ThemeRecord>(
    'local',
    STORAGE_KEYS.theme,
    (value) => {
      const raw = asString(value['preference']);
      if (raw === null) return null;
      // Valor fora do conjunto é descartado pelo `null`, e o descarte emite o
      // aviso — que o consumidor filtra para esta chave.
      return raw === toThemePreference(raw) ? { preference: raw } : null;
    },
  );

  return record?.preference ?? 'system';
}

/**
 * Grava a preferência.
 *
 * Falha de gravação **não é reportada a quem chama**: a troca vale na sessão
 * atual de qualquer forma, porque o tema efetivo mora no estado e no atributo
 * do elemento raiz, não no armazenamento. Não poder lembrar da escolha na
 * próxima visita não é assunto do usuário (contracts/storage.md §3).
 */
export function saveThemePreference(preference: ThemePreference): void {
  writeVersioned('local', STORAGE_KEYS.theme, { preference });
}
