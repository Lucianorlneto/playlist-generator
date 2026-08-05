import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearCredential, loadCredential, saveCredential } from '@/services/storage/credentialRepo';
import { clearDraft, loadDraft, saveDraft } from '@/services/storage/draftRepo';
import { clearPkce, peekPkce, savePkce, takePkce } from '@/services/storage/pkceRepo';
import { onStorageWarning, STORAGE_KEYS } from '@/services/storage/schema';
import { clearSession, loadSession, saveSession } from '@/services/storage/sessionRepo';

import { makeCreation, makeDraft, makeSession, resetFactoryCounter } from '../fixtures/factories';

beforeEach(() => {
  resetFactoryCounter();
});

/** Todas as chaves gravadas, como texto — a superfície que os invariantes cobrem. */
function allStoredText(): string {
  const parts: string[] = [];
  for (const key of Object.values(STORAGE_KEYS)) {
    parts.push(localStorage.getItem(key) ?? '', sessionStorage.getItem(key) ?? '');
  }
  return parts.join('\n');
}

describe('contracts/storage.md — invariante 1: nenhum segredo de cliente', () => {
  it('não existe caminho que grave client_secret em nenhuma chave', () => {
    saveCredential('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6');
    saveSession(makeSession());
    saveDraft(makeDraft());
    savePkce({ codeVerifier: 'verifier', state: 'state', createdAt: Date.now() });

    const stored = allStoredText();
    expect(stored).not.toContain('client_secret');
    expect(stored).not.toContain('clientSecret');
  });

  it('descarta campos desconhecidos na leitura da credencial', () => {
    localStorage.setItem(
      STORAGE_KEYS.credential,
      JSON.stringify({ schemaVersion: 1, clientId: 'abc', clientSecret: 'não deveria existir' }),
    );

    expect(loadCredential()).toEqual({ clientId: 'abc' });
  });
});

describe('contracts/storage.md — invariante 2: o rascunho nunca contém token', () => {
  it('a serialização campo a campo descarta qualquer token infiltrado no estado', () => {
    const draft = makeDraft();
    const contaminated = {
      ...draft,
      accessToken: 'BQxxxxx',
      refreshToken: 'AQxxxxx',
    } as unknown as ReturnType<typeof makeDraft>;

    saveDraft(contaminated);

    const stored = localStorage.getItem(STORAGE_KEYS.draft) ?? '';
    expect(stored).not.toContain('accessToken');
    expect(stored).not.toContain('refreshToken');
    expect(stored).not.toContain('BQxxxxx');
    expect(stored).not.toContain('AQxxxxx');
  });

  it('preserva o conteúdo legítimo do rascunho na ida e na volta', () => {
    const draft = makeDraft({ creation: makeCreation({ committedBatches: 1, failedAt: 2 }) });
    saveDraft(draft);

    const loaded = loadDraft();
    expect(loaded).not.toBeNull();
    expect(loaded?.rawText).toBe(draft.rawText);
    expect(loaded?.step).toBe('review');
    expect(loaded?.items).toHaveLength(1);
    expect(loaded?.items[0]?.line.raw).toBe(draft.items[0]?.line.raw);
    expect(loaded?.creation?.committedBatches).toBe(1);
    expect(loaded?.creation?.failedAt).toBe(2);
  });
});

describe('contracts/storage.md — invariante 3: encerrar a sessão preserva o resto', () => {
  it('clearSession não toca em credencial nem em rascunho (FR-044, SC-006)', () => {
    saveCredential('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6');
    saveSession(makeSession());
    saveDraft(makeDraft());

    clearSession();

    expect(loadSession()).toBeNull();
    expect(loadCredential()).toEqual({ clientId: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6' });
    expect(loadDraft()).not.toBeNull();
  });
});

describe('contracts/storage.md — invariante 4: criação bem-sucedida apaga só o rascunho', () => {
  it('clearDraft preserva credencial e sessão (FR-045)', () => {
    saveCredential('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6');
    saveSession(makeSession());
    saveDraft(makeDraft());

    clearDraft();

    expect(loadDraft()).toBeNull();
    expect(loadCredential()).not.toBeNull();
    expect(loadSession()).not.toBeNull();
  });

  it('remover a credencial não derruba a sessão nem o rascunho', () => {
    saveCredential('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6');
    saveSession(makeSession());
    saveDraft(makeDraft());

    clearCredential();

    expect(loadCredential()).toBeNull();
    expect(loadSession()).not.toBeNull();
    expect(loadDraft()).not.toBeNull();
  });
});

describe('contracts/storage.md — invariante 5: toda leitura valida a forma', () => {
  it('descarta JSON corrompido com aviso, sem lançar', () => {
    const warnings: string[] = [];
    const unsubscribe = onStorageWarning((warning) => warnings.push(warning.reason));
    localStorage.setItem(STORAGE_KEYS.draft, '{isto não é json');

    expect(() => loadDraft()).not.toThrow();
    expect(loadDraft()).toBeNull();
    expect(warnings).toContain('corrupted');
    expect(localStorage.getItem(STORAGE_KEYS.draft)).toBeNull();
    unsubscribe();
  });

  it('descarta schemaVersion desconhecida sem migrar às cegas', () => {
    const warnings: string[] = [];
    const unsubscribe = onStorageWarning((warning) => warnings.push(warning.reason));
    localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify({ ...makeDraft(), schemaVersion: 99 }));

    expect(loadDraft()).toBeNull();
    expect(warnings).toContain('unknown_version');
    unsubscribe();
  });

  it('descarta conteúdo com forma inválida', () => {
    const warnings: string[] = [];
    const unsubscribe = onStorageWarning((warning) => warnings.push(warning.reason));
    localStorage.setItem(
      STORAGE_KEYS.session,
      JSON.stringify({ schemaVersion: 1, accessToken: 'a' }),
    );

    expect(loadSession()).toBeNull();
    expect(warnings).toContain('invalid_shape');
    unsubscribe();
  });

  it('nunca lança quando o armazenamento está indisponível', () => {
    const spy = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('acesso negado');
    });

    expect(() => loadCredential()).not.toThrow();
    expect(loadCredential()).toBeNull();
    spy.mockRestore();
  });
});

describe('PKCE — o verifier morre com o consumo do código', () => {
  it('takePkce lê e destrói o registro na mesma operação', () => {
    savePkce({ codeVerifier: 'verifier', state: 'state-1', createdAt: 1 });
    expect(peekPkce()).not.toBeNull();

    const taken = takePkce();

    expect(taken?.codeVerifier).toBe('verifier');
    expect(peekPkce()).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEYS.pkce)).toBeNull();
  });

  it('destrói o registro mesmo quando o conteúdo é inválido', () => {
    sessionStorage.setItem(STORAGE_KEYS.pkce, JSON.stringify({ codeVerifier: 'só isso' }));

    expect(takePkce()).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEYS.pkce)).toBeNull();
  });

  it('vive em sessionStorage, não em localStorage', () => {
    savePkce({ codeVerifier: 'verifier', state: 'state-1', createdAt: 1 });

    expect(sessionStorage.getItem(STORAGE_KEYS.pkce)).not.toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.pkce)).toBeNull();
    clearPkce();
  });
});

describe('degradação por cota (research §8)', () => {
  it('regrava mantendo só a candidata escolhida quando estoura a cota', () => {
    const draft = makeDraft();
    let attempt = 0;
    let lastWrite = '';
    const spy = vi
      .spyOn(localStorage, 'setItem')
      .mockImplementation((_key: string, value: string) => {
        attempt += 1;
        if (attempt === 1) {
          const error = new Error('cheio');
          error.name = 'QuotaExceededError';
          throw error;
        }
        // Segunda tentativa passa: guarda o valor para inspeção.
        lastWrite = value;
      });

    const outcome = saveDraft({
      ...draft,
      items: [
        {
          ...draft.items[0]!,
          candidates: [
            draft.items[0]!.candidates[0]!,
            { ...draft.items[0]!.candidates[0]!, uri: 'spotify:track:outra', id: 'outra' },
          ],
        },
      ],
    });

    expect(outcome).toBe('degraded');
    expect(lastWrite).not.toContain('spotify:track:outra');
    spy.mockRestore();
  });

  it('devolve "failed" quando nem a versão reduzida cabe', () => {
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      const error = new Error('cheio');
      error.name = 'QuotaExceededError';
      throw error;
    });

    expect(saveDraft(makeDraft())).toBe('failed');
    spy.mockRestore();
  });
});
