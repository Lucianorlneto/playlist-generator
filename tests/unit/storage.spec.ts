import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PROVIDER_ORDER, type ProviderId } from '@/domain/providers';
import {
  clearAuthRequest,
  peekAuthRequest,
  saveAuthRequest,
  takeAuthRequest,
} from '@/services/storage/authRequestRepo';
import {
  clearCredential,
  loadAllCredentials,
  loadCredential,
  saveCredential,
} from '@/services/storage/credentialRepo';
import { clearDraft, loadDraft, saveDraft } from '@/services/storage/draftRepo';
import { loadConsumption, saveConsumption } from '@/services/storage/quotaRepo';
import { onStorageWarning, STORAGE_KEYS } from '@/services/storage/schema';
import {
  clearSession,
  loadAllSessions,
  loadSession,
  saveSession,
} from '@/services/storage/sessionRepo';

import { makeCreation, makeDraft, makeSession, resetFactoryCounter } from '../fixtures/factories';

beforeEach(() => {
  resetFactoryCounter();
});

/** Todas as chaves gravadas, como texto — a superfície que os invariantes cobrem. */
function allStoredText(): string {
  const parts: string[] = [localStorage.getItem(STORAGE_KEYS.draft) ?? ''];
  for (const provider of PROVIDER_ORDER) {
    parts.push(
      localStorage.getItem(STORAGE_KEYS.credential(provider)) ?? '',
      localStorage.getItem(STORAGE_KEYS.session(provider)) ?? '',
      localStorage.getItem(STORAGE_KEYS.quota(provider)) ?? '',
      sessionStorage.getItem(STORAGE_KEYS.authRequest(provider)) ?? '',
    );
  }
  return parts.join('\n');
}

function fillEverything(): void {
  saveCredential('spotify', 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6');
  saveCredential('youtube', '123-abc.apps.googleusercontent.com');
  saveSession(makeSession('spotify'));
  saveSession(makeSession('youtube'));
  saveDraft(makeDraft());
  saveAuthRequest({
    provider: 'spotify',
    state: 'state-s',
    codeVerifier: 'verifier',
    createdAt: Date.now(),
  });
  saveAuthRequest({ provider: 'youtube', state: 'state-y', createdAt: Date.now() });
  saveConsumption({ provider: 'youtube', ptDate: '2026-08-05', units: 100 });
}

describe('contracts/storage.md — invariante 1: as chaves são por provedor', () => {
  it('cada provedor grava em uma chave própria e distinta', () => {
    fillEverything();

    for (const provider of PROVIDER_ORDER) {
      expect(localStorage.getItem(STORAGE_KEYS.credential(provider))).not.toBeNull();
      expect(localStorage.getItem(STORAGE_KEYS.session(provider))).not.toBeNull();
    }
    expect(STORAGE_KEYS.credential('spotify')).not.toBe(STORAGE_KEYS.credential('youtube'));
    expect(STORAGE_KEYS.session('spotify')).not.toBe(STORAGE_KEYS.session('youtube'));
  });

  it('as chaves usam o prefixo versionado v2', () => {
    expect(STORAGE_KEYS.credential('spotify')).toBe('tp.v2.credential.spotify');
    expect(STORAGE_KEYS.session('youtube')).toBe('tp.v2.session.youtube');
    expect(STORAGE_KEYS.authRequest('youtube')).toBe('tp.v2.authreq.youtube');
    expect(STORAGE_KEYS.quota('youtube')).toBe('tp.v2.quota.youtube');
    expect(STORAGE_KEYS.draft).toBe('tp.v2.draft');
  });
});

describe('FR-006 — isolamento entre provedores', () => {
  it('remover a credencial de um serviço não alcança a do outro', () => {
    saveCredential('spotify', 'spotify-client-id');
    saveCredential('youtube', 'youtube-client-id');

    clearCredential('spotify');

    expect(loadCredential('spotify')).toBeNull();
    expect(loadCredential('youtube')).toEqual({ clientId: 'youtube-client-id' });
  });

  it('encerrar a sessão de um serviço não alcança a do outro (invariante S2)', () => {
    saveSession(makeSession('spotify'));
    saveSession(makeSession('youtube'));

    clearSession('youtube');

    expect(loadSession('youtube')).toBeNull();
    expect(loadSession('spotify')?.provider).toBe('spotify');
  });

  it('remover a credencial não toca em sessão, rascunho nem cota', () => {
    fillEverything();

    clearCredential('spotify');
    clearCredential('youtube');

    expect(loadSession('spotify')).not.toBeNull();
    expect(loadDraft()).not.toBeNull();
    expect(loadConsumption('youtube')).not.toBeNull();
  });

  it('encerrar a sessão não toca em credencial nem rascunho', () => {
    fillEverything();

    clearSession('spotify');
    clearSession('youtube');

    expect(loadCredential('spotify')).not.toBeNull();
    expect(loadDraft()).not.toBeNull();
  });

  it('loadAll devolve um mapa completo, com null onde não há nada', () => {
    saveCredential('youtube', 'só-o-youtube');
    const credenciais = loadAllCredentials();
    expect(credenciais.spotify).toBeNull();
    expect(credenciais.youtube).toEqual({ clientId: 'só-o-youtube' });

    saveSession(makeSession('spotify'));
    const sessoes = loadAllSessions();
    expect(sessoes.spotify?.provider).toBe('spotify');
    expect(sessoes.youtube).toBeNull();
  });

  it('a sessão de um provedor não é lida sob a chave de outro', () => {
    // Conteúdo do Spotify gravado à força na chave do YouTube: recusado.
    localStorage.setItem(
      STORAGE_KEYS.session('youtube'),
      localStorage.getItem(STORAGE_KEYS.session('spotify')) ??
        JSON.stringify({ schemaVersion: 2, provider: 'spotify', accessToken: 'x' }),
    );
    expect(loadSession('youtube')).toBeNull();
  });
});

describe('Princípio II — nenhum segredo em nenhuma chave', () => {
  it('não existe caminho que grave segredo de cliente', () => {
    fillEverything();

    const stored = allStoredText();
    expect(stored).not.toContain('client_secret');
    expect(stored).not.toContain('clientSecret');
  });

  it('descarta campos desconhecidos na leitura da credencial', () => {
    localStorage.setItem(
      STORAGE_KEYS.credential('spotify'),
      JSON.stringify({ schemaVersion: 2, clientId: 'abc', clientSecret: 'não deveria existir' }),
    );

    expect(loadCredential('spotify')).toEqual({ clientId: 'abc' });
  });
});

describe('contracts/storage.md — invariante 2: o rascunho nunca contém token', () => {
  it('a serialização campo a campo descarta qualquer token infiltrado no estado', () => {
    const draft = makeDraft();
    const contaminated = {
      ...draft,
      accessToken: 'BQxxxxx',
      refreshToken: 'AQxxxxx',
      clientId: 'a1b2c3',
    } as unknown as ReturnType<typeof makeDraft>;

    saveDraft(contaminated);

    const stored = localStorage.getItem(STORAGE_KEYS.draft) ?? '';
    expect(stored).not.toContain('accessToken');
    expect(stored).not.toContain('refreshToken');
    expect(stored).not.toContain('BQxxxxx');
    expect(stored).not.toContain('clientId');
  });

  it('o rascunho v2 guarda linhas, destinos e a fila', () => {
    saveDraft(makeDraft());
    const carregado = loadDraft();

    expect(carregado?.lines).toHaveLength(1);
    expect(carregado?.destinations.selected).toEqual(['spotify']);
    expect(carregado?.queue.order).toEqual(['spotify']);
    expect(carregado?.queue.runs.spotify?.phase).toBe('review');
  });

  it('o progresso é gravado em itens, não em lotes', () => {
    const draft = makeDraft();
    const run = draft.queue.runs.spotify;
    if (run !== undefined) {
      run.creation = makeCreation({ committedItems: 137, batchSize: 100 });
    }
    saveDraft(draft);

    const stored = localStorage.getItem(STORAGE_KEYS.draft) ?? '';
    expect(stored).toContain('committedItems');
    expect(stored).not.toContain('committedBatches');
    expect(loadDraft()?.queue.runs.spotify?.creation?.committedItems).toBe(137);
  });
});

describe('contracts/storage.md — invariante 3: nunca lança', () => {
  it('JSON corrompido devolve null e avisa', () => {
    const avisos: string[] = [];
    const desassinar = onStorageWarning((warning) => avisos.push(warning.reason));

    localStorage.setItem(STORAGE_KEYS.draft, '{ isto não é json');
    expect(loadDraft()).toBeNull();
    expect(avisos).toContain('corrupted');

    desassinar();
  });

  it('versão desconhecida é descartada, nunca migrada às cegas', () => {
    const avisos: string[] = [];
    const desassinar = onStorageWarning((warning) => avisos.push(warning.reason));

    localStorage.setItem(
      STORAGE_KEYS.credential('spotify'),
      JSON.stringify({ schemaVersion: 99, clientId: 'abc' }),
    );
    expect(loadCredential('spotify')).toBeNull();
    expect(avisos).toContain('unknown_version');

    desassinar();
  });

  it('armazenamento indisponível devolve null sem lançar', () => {
    const espia = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });

    expect(() => loadCredential('spotify')).not.toThrow();
    expect(loadCredential('spotify')).toBeNull();

    espia.mockRestore();
  });
});

describe('Registro de autorização em voo', () => {
  it('PKCE só existe no Spotify; o YouTube grava apenas o state', () => {
    saveAuthRequest({
      provider: 'spotify',
      state: 's',
      codeVerifier: 'verifier',
      createdAt: 1,
    });
    saveAuthRequest({ provider: 'youtube', state: 'y', createdAt: 1 });

    expect(peekAuthRequest('spotify')?.codeVerifier).toBe('verifier');
    expect(peekAuthRequest('youtube')?.codeVerifier).toBeUndefined();
    expect(peekAuthRequest('youtube')?.state).toBe('y');
  });

  it('take lê e destrói na mesma operação', () => {
    saveAuthRequest({ provider: 'youtube', state: 'y', createdAt: 1 });

    expect(takeAuthRequest('youtube')?.state).toBe('y');
    expect(peekAuthRequest('youtube')).toBeNull();
  });

  it('take de um provedor não destrói o registro do outro', () => {
    saveAuthRequest({ provider: 'spotify', state: 's', codeVerifier: 'v', createdAt: 1 });
    saveAuthRequest({ provider: 'youtube', state: 'y', createdAt: 1 });

    takeAuthRequest('youtube');

    expect(peekAuthRequest('spotify')?.state).toBe('s');
  });

  it('vive em sessionStorage, não em localStorage', () => {
    saveAuthRequest({ provider: 'youtube', state: 'y', createdAt: 1 });
    expect(sessionStorage.getItem(STORAGE_KEYS.authRequest('youtube'))).not.toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.authRequest('youtube'))).toBeNull();
    clearAuthRequest('youtube');
  });
});

describe('Registro de Consumo Diário (FR-029, FR-030)', () => {
  it('grava e lê por provedor', () => {
    saveConsumption({ provider: 'youtube', ptDate: '2026-08-05', units: 7_556 });
    expect(loadConsumption('youtube')).toEqual({
      provider: 'youtube',
      ptDate: '2026-08-05',
      units: 7_556,
    });
  });

  it('registro corrompido devolve null — que o domínio trata como zero (O2)', () => {
    localStorage.setItem(
      STORAGE_KEYS.quota('youtube'),
      JSON.stringify({ schemaVersion: 2, ptDate: 'ontem', units: 'muitas' }),
    );
    expect(loadConsumption('youtube')).toBeNull();
  });

  it('unidades negativas são recusadas', () => {
    localStorage.setItem(
      STORAGE_KEYS.quota('youtube'),
      JSON.stringify({ schemaVersion: 2, ptDate: '2026-08-05', units: -1 }),
    );
    expect(loadConsumption('youtube')).toBeNull();
  });
});

describe('Ciclo de vida do rascunho', () => {
  it('clearDraft apaga só o rascunho', () => {
    fillEverything();
    clearDraft();

    expect(loadDraft()).toBeNull();
    expect(loadCredential('spotify')).not.toBeNull();
    expect(loadSession('spotify')).not.toBeNull();
  });

  it('degrada descartando alternativas quando o armazenamento enche', () => {
    const draft = makeDraft();
    const original = globalThis.localStorage.setItem.bind(globalThis.localStorage);
    let tentativas = 0;

    const espia = vi
      .spyOn(globalThis.localStorage, 'setItem')
      .mockImplementation((key: string, value: string) => {
        tentativas += 1;
        // A primeira tentativa (íntegra) não cabe; as demais cabem.
        if (tentativas === 1) {
          const erro = new Error('cheio');
          erro.name = 'QuotaExceededError';
          throw erro;
        }
        original(key, value);
      });

    expect(saveDraft(draft)).toBe('degraded');
    expect(tentativas).toBeGreaterThan(1);

    espia.mockRestore();
  });

  it('devolve failed quando nem a versão mais enxuta cabe', () => {
    const espia = vi.spyOn(globalThis.localStorage, 'setItem').mockImplementation(() => {
      const erro = new Error('cheio');
      erro.name = 'QuotaExceededError';
      throw erro;
    });

    expect(saveDraft(makeDraft())).toBe('failed');

    espia.mockRestore();
  });
});

describe('a chave de um provedor nunca aparece na de outro', () => {
  const chavesDe = (provider: ProviderId) => [
    STORAGE_KEYS.credential(provider),
    STORAGE_KEYS.session(provider),
    STORAGE_KEYS.authRequest(provider),
    STORAGE_KEYS.quota(provider),
  ];

  it('os conjuntos de chaves são disjuntos', () => {
    const spotify = new Set(chavesDe('spotify'));
    for (const chave of chavesDe('youtube')) {
      expect(spotify.has(chave)).toBe(false);
    }
  });
});
