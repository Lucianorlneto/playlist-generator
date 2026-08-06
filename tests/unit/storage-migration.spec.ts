import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadDraft } from '@/services/storage/draftRepo';
import { loadCredential } from '@/services/storage/credentialRepo';
import { migrateToV2, needsMigration } from '@/services/storage/migrations';
import { LEGACY_KEYS, onStorageWarning, STORAGE_KEYS } from '@/services/storage/schema';
import { loadSession } from '@/services/storage/sessionRepo';
import { peekAuthRequest } from '@/services/storage/authRequestRepo';

import { makeItem, makeLine, resetFactoryCounter } from '../fixtures/factories';

beforeEach(() => {
  resetFactoryCounter();
});

/** Rascunho no formato exato que a 001 gravava. */
function legacyDraft(overrides: Record<string, unknown> = {}): void {
  const line = makeLine({ index: 0 });
  const item = makeItem({ line });
  localStorage.setItem(
    LEGACY_KEYS.draft,
    JSON.stringify({
      schemaVersion: 1,
      savedAt: 1_786_060_800_000,
      step: 'review',
      rawText: 'Bohemian Rhapsody - Queen',
      playlistConfig: { name: 'Clássicos', description: '', isPublic: false },
      items: [item],
      creation: null,
      ...overrides,
    }),
  );
}

function legacyCredential(clientId = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'): void {
  localStorage.setItem(LEGACY_KEYS.credential, JSON.stringify({ schemaVersion: 1, clientId }));
}

function legacySession(): void {
  localStorage.setItem(
    LEGACY_KEYS.session,
    JSON.stringify({
      schemaVersion: 1,
      accessToken: 'access-token-1',
      refreshToken: 'refresh-token-1',
      expiresAt: Date.now() + 3_600_000,
      scopes: ['playlist-modify-private'],
      user: { id: 'usuario_teste', displayName: 'Fulano de Teste' },
    }),
  );
}

describe('FR-042 — migração v1 → v2', () => {
  it('não faz nada quando não há chave v1', () => {
    expect(needsMigration()).toBe(false);
    expect(migrateToV2().ran).toBe(false);
  });

  it('a credencial vira a credencial do Spotify', () => {
    legacyCredential('abc123');
    migrateToV2();

    expect(loadCredential('spotify')).toEqual({ clientId: 'abc123' });
    expect(loadCredential('youtube')).toBeNull();
    expect(localStorage.getItem(LEGACY_KEYS.credential)).toBeNull();
  });

  it('a sessão ganha o campo provider', () => {
    legacySession();
    migrateToV2();

    const sessao = loadSession('spotify');
    expect(sessao?.provider).toBe('spotify');
    expect(sessao?.refreshToken).toBe('refresh-token-1');
    expect(loadSession('youtube')).toBeNull();
    expect(localStorage.getItem(LEGACY_KEYS.session)).toBeNull();
  });

  it('o registro PKCE vira registro de autorização do Spotify', () => {
    sessionStorage.setItem(
      LEGACY_KEYS.pkce,
      JSON.stringify({ codeVerifier: 'verifier', state: 'state', createdAt: 1 }),
    );
    migrateToV2();

    expect(peekAuthRequest('spotify')?.codeVerifier).toBe('verifier');
    expect(sessionStorage.getItem(LEGACY_KEYS.pkce)).toBeNull();
  });

  /** A conversão central do rascunho (FR-042). */
  it('o rascunho vira fluxo Spotify de destino único, na etapa gravada', () => {
    legacyDraft();
    const relatorio = migrateToV2();

    expect(relatorio.draft).toBe(true);

    const draft = loadDraft();
    expect(draft?.schemaVersion).toBe(2);
    expect(draft?.destinations.selected).toEqual(['spotify']);
    expect(draft?.destinations.locked).toBe(false);
    expect(draft?.queue.order).toEqual(['spotify']);
    expect(draft?.queue.runs.youtube).toBeUndefined();
    // `review` da v1 é uma **fase** do ciclo na v2, dentro da etapa `service`.
    expect(draft?.step).toBe('service');
    expect(draft?.queue.runs.spotify?.phase).toBe('review');
    expect(localStorage.getItem(LEGACY_KEYS.draft)).toBeNull();
  });

  it('a fonte única de linhas nasce dos itens, na ordem de index', () => {
    const linhaA = makeLine({ index: 1, id: 'lb', raw: 'B - Artista' });
    const linhaB = makeLine({ index: 0, id: 'la', raw: 'A - Artista' });
    legacyDraft({ items: [makeItem({ line: linhaA }), makeItem({ line: linhaB })] });

    migrateToV2();

    const draft = loadDraft();
    expect(draft?.lines.map((line) => line.id)).toEqual(['la', 'lb']);
    expect(draft?.queue.runs.spotify?.lineIds).toEqual(['la', 'lb']);
  });

  it('as etapas da v1 mapeiam para etapa + fase da v2', () => {
    const casos: [string, string, string][] = [
      ['credential', 'credential', 'pending'],
      ['input', 'input', 'pending'],
      ['review', 'service', 'review'],
      ['result', 'service', 'creating'],
    ];

    for (const [legado, etapa, fase] of casos) {
      localStorage.clear();
      legacyDraft({ step: legado });
      migrateToV2();

      const draft = loadDraft();
      expect(draft?.step, `step ${legado}`).toBe(etapa);
      expect(draft?.queue.runs.spotify?.phase, `phase de ${legado}`).toBe(fase);
    }
  });

  /** Regra 2 do contrato: a retomada continua exata. */
  it('committedBatches × 100 vira committedItems', () => {
    const uris = Array.from({ length: 250 }, (_, index) => `spotify:track:${index}`);
    legacyDraft({
      step: 'result',
      creation: {
        playlistId: 'playlist-1',
        playlistUrl: 'https://open.spotify.com/playlist/playlist-1',
        orderedUris: uris,
        batchSize: 100,
        committedBatches: 2,
        failedAt: null,
      },
    });

    migrateToV2();

    const creation = loadDraft()?.queue.runs.spotify?.creation;
    expect(creation?.committedItems).toBe(200);
    expect(creation?.batchSize).toBe(100);
    expect(creation?.playlistId).toBe('playlist-1');
  });

  it('committedItems nunca passa do total de itens', () => {
    legacyDraft({
      step: 'result',
      creation: {
        playlistId: 'p',
        playlistUrl: 'u',
        orderedUris: ['a', 'b'],
        batchSize: 100,
        committedBatches: 1,
        failedAt: null,
      },
    });
    migrateToV2();
    expect(loadDraft()?.queue.runs.spotify?.creation?.committedItems).toBe(2);
  });

  it('criação já iniciada trava a seleção de destinos (FR-012)', () => {
    legacyDraft({
      step: 'result',
      creation: {
        playlistId: 'p',
        playlistUrl: 'u',
        orderedUris: ['a'],
        batchSize: 100,
        committedBatches: 0,
        failedAt: null,
      },
    });
    migrateToV2();
    expect(loadDraft()?.destinations.locked).toBe(true);
  });

  /** Regra 1 do contrato: a chave v1 só some depois da gravação bem-sucedida. */
  it('falha de gravação preserva a chave v1', () => {
    legacyDraft();
    const espia = vi.spyOn(globalThis.localStorage, 'setItem').mockImplementation(() => {
      const erro = new Error('cheio');
      erro.name = 'QuotaExceededError';
      throw erro;
    });

    const relatorio = migrateToV2();

    espia.mockRestore();

    expect(relatorio.draft).toBe(false);
    expect(localStorage.getItem(LEGACY_KEYS.draft)).not.toBeNull();
  });

  it('a credencial v1 também sobrevive à falha de gravação', () => {
    legacyCredential();
    const espia = vi.spyOn(globalThis.localStorage, 'setItem').mockImplementation(() => {
      const erro = new Error('cheio');
      erro.name = 'QuotaExceededError';
      throw erro;
    });

    migrateToV2();
    espia.mockRestore();

    expect(localStorage.getItem(LEGACY_KEYS.credential)).not.toBeNull();
  });

  /** Regra 3: rascunho ilegível é descartado com aviso, como já acontecia. */
  it('rascunho v1 ilegível é descartado com aviso', () => {
    const avisos: string[] = [];
    const desassinar = onStorageWarning((warning) => avisos.push(warning.reason));

    localStorage.setItem(
      LEGACY_KEYS.draft,
      JSON.stringify({ schemaVersion: 1, savedAt: 1, step: 'review' }),
    );

    const relatorio = migrateToV2();
    desassinar();

    expect(relatorio.draftDiscarded).toBe(true);
    expect(avisos).toContain('invalid_shape');
    expect(localStorage.getItem(LEGACY_KEYS.draft)).toBeNull();
    expect(loadDraft()).toBeNull();
  });

  it('itens ilegíveis descartam o rascunho inteiro, sem meia migração', () => {
    legacyDraft({ items: [{ isto: 'não é um item' }] });
    const relatorio = migrateToV2();

    expect(relatorio.draftDiscarded).toBe(true);
    expect(loadDraft()).toBeNull();
  });
});

describe('invariante M1 — nenhuma leitura interpreta v1 como v2', () => {
  it('conteúdo v1 sob a chave v2 é recusado, não reinterpretado', () => {
    localStorage.setItem(
      STORAGE_KEYS.credential('spotify'),
      JSON.stringify({ schemaVersion: 1, clientId: 'abc' }),
    );
    expect(loadCredential('spotify')).toBeNull();
  });

  it('a migração é idempotente', () => {
    legacyCredential('abc');
    legacyDraft();

    const primeira = migrateToV2();
    expect(primeira.ran).toBe(true);

    const antes = localStorage.getItem(STORAGE_KEYS.draft);
    const segunda = migrateToV2();

    expect(segunda.ran).toBe(false);
    expect(localStorage.getItem(STORAGE_KEYS.draft)).toBe(antes);
    expect(loadCredential('spotify')).toEqual({ clientId: 'abc' });
  });
});
