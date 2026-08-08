/**
 * Persistência da preferência de tema (US1, FR-011, FR-012, FR-032, SC-005).
 *
 * A regra que atravessa o arquivo inteiro: **em nenhum caso a aplicação quebra
 * ou exibe aviso**. Falhar em gravar uma preferência de cor não é assunto do
 * usuário — a troca vale na sessão de qualquer forma, porque o tema efetivo mora
 * no estado e no atributo do elemento raiz, não no armazenamento
 * (contracts/storage.md §3).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadThemePreference, saveThemePreference } from '@/services/storage/themeRepo';
import { onStorageWarning, STORAGE_KEYS } from '@/services/storage/schema';

const KEY = STORAGE_KEYS.theme;

/** Captura os avisos emitidos durante um trecho. */
function capturingWarnings<T>(run: () => T): { result: T; keys: string[] } {
  const keys: string[] = [];
  const unsubscribe = onStorageWarning((warning) => keys.push(warning.key));
  try {
    return { result: run(), keys };
  } finally {
    unsubscribe();
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SC-005 · a escolha sobrevive ao fechamento do navegador', () => {
  it.each(['light', 'dark', 'system'] as const)(
    'grava e relê a preferência %s',
    (preference) => {
      saveThemePreference(preference);
      expect(loadThemePreference()).toBe(preference);
    },
  );

  it('grava "system" explicitamente, em vez de representar por ausência', () => {
    saveThemePreference('dark');
    saveThemePreference('system');

    // Se voltar a "Sistema" apagasse a chave, este registro não existiria — e
    // "nunca escolheu" ficaria indistinguível de "escolheu acompanhar o
    // sistema" para qualquer teste (data-model.md §1).
    expect(localStorage.getItem(KEY)).not.toBeNull();
    expect(JSON.parse(localStorage.getItem(KEY) ?? '{}')).toEqual({
      schemaVersion: 2,
      preference: 'system',
    });
  });

  it('o registro não contém token, credencial nem dado pessoal (FR-012)', () => {
    saveThemePreference('dark');
    const record = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>;
    expect(Object.keys(record).sort()).toEqual(['preference', 'schemaVersion']);
  });
});

describe('FR-011 · toda degradação volta a "system", em silêncio para o usuário', () => {
  it('chave ausente devolve "system" e não emite aviso nenhum', () => {
    const { result, keys } = capturingWarnings(() => loadThemePreference());
    expect(result).toBe('system');
    expect(keys).toEqual([]);
  });

  it.each([
    ['JSON corrompido', '{ isto não é json'],
    ['forma inválida', JSON.stringify({ schemaVersion: 2, preferencia: 'dark' })],
    ['preferência desconhecida', JSON.stringify({ schemaVersion: 2, preference: 'roxo' })],
    ['preferência não textual', JSON.stringify({ schemaVersion: 2, preference: 7 })],
    ['versão divergente', JSON.stringify({ schemaVersion: 99, preference: 'dark' })],
    ['conteúdo não é objeto', JSON.stringify('dark')],
  ])('%s é descartado e volta a "system"', (_rotulo, raw) => {
    localStorage.setItem(KEY, raw);

    expect(loadThemePreference()).toBe('system');
    // Descartado, não mantido: um registro que a leitura recusa não pode
    // continuar no disco para ser recusado de novo a cada carga.
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('o aviso emitido nas degradações é sempre da chave de tema, e só dela', () => {
    localStorage.setItem(KEY, '{ corrompido');

    const { keys } = capturingWarnings(() => loadThemePreference());

    // O consumidor de `onStorageWarning` filtra esta chave (bootstrap.ts), e é
    // por isso que ela pode emitir sem produzir mensagem visível.
    expect(new Set(keys)).toEqual(new Set([KEY]));
  });
});

describe('FR-011 · armazenamento indisponível não quebra e não fala', () => {
  it('leitura com getItem lançando devolve "system"', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    expect(() => loadThemePreference()).not.toThrow();
    expect(loadThemePreference()).toBe('system');
  });

  it('gravação que estoura a cota não lança para quem chamou', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      const error = new Error('cheio');
      error.name = 'QuotaExceededError';
      throw error;
    });

    expect(() => {
      saveThemePreference('dark');
    }).not.toThrow();
  });

  it('gravação que falha por outro motivo também não lança', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });

    expect(() => {
      saveThemePreference('light');
    }).not.toThrow();
  });
});

describe('FR-013 · isolamento por construção', () => {
  it('a chave de tema é literal, não função de provedor', () => {
    expect(STORAGE_KEYS.theme).toBe('tp.v2.theme');
    expect(typeof STORAGE_KEYS.theme).toBe('string');
    // As chaves de provedor são funções; nenhum caminho que apaga dados de um
    // serviço consegue alcançar uma chave literal.
    expect(typeof STORAGE_KEYS.credential).toBe('function');
    expect(typeof STORAGE_KEYS.session).toBe('function');
  });

  it('remover credenciais e sessões de todos os provedores não toca o tema', () => {
    saveThemePreference('dark');

    for (const provider of ['spotify', 'youtube'] as const) {
      localStorage.removeItem(STORAGE_KEYS.credential(provider));
      localStorage.removeItem(STORAGE_KEYS.session(provider));
      localStorage.removeItem(STORAGE_KEYS.quota(provider));
    }
    localStorage.removeItem(STORAGE_KEYS.draft);

    expect(loadThemePreference()).toBe('dark');
  });
});
