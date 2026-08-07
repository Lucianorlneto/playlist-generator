import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadDraft } from '@/services/storage/draftRepo';
import { loadCredential } from '@/services/storage/credentialRepo';
import { migrateToV2, migrateToV3, needsMigration, upgradeDraftToV3 } from '@/services/storage/migrations';
import { LEGACY_KEYS, onStorageWarning, STORAGE_KEYS } from '@/services/storage/schema';
import { loadSession } from '@/services/storage/sessionRepo';
import { peekAuthRequest } from '@/services/storage/authRequestRepo';

import {
  makeDraft,
  makeItem,
  makeLine,
  makeQueue,
  makeRun,
  resetFactoryCounter,
} from '../fixtures/factories';

beforeEach(() => {
  resetFactoryCounter();
});

/**
 * A cadeia inteira, como o bootstrap a executa. Os testes de v1→v2 abaixo
 * inspecionam o resultado por `loadDraft`, que só aceita a versão corrente —
 * então precisam da conversão completa, não só do primeiro passo.
 */
function migrarTudo(): ReturnType<typeof migrateToV2> {
  const relatorio = migrateToV2();
  migrateToV3();
  return relatorio;
}

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
    migrarTudo();

    expect(loadCredential('spotify')).toEqual({ clientId: 'abc123' });
    expect(loadCredential('youtube')).toBeNull();
    expect(localStorage.getItem(LEGACY_KEYS.credential)).toBeNull();
  });

  it('a sessão ganha o campo provider', () => {
    legacySession();
    migrarTudo();

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
    migrarTudo();

    expect(peekAuthRequest('spotify')?.codeVerifier).toBe('verifier');
    expect(sessionStorage.getItem(LEGACY_KEYS.pkce)).toBeNull();
  });

  /** A conversão central do rascunho (FR-042). */
  it('o rascunho vira fluxo Spotify de destino único, na etapa gravada', () => {
    legacyDraft();
    const relatorio = migrarTudo();

    expect(relatorio.draft).toBe(true);

    const draft = loadDraft();
    // A cadeia termina na versão corrente: v1 → v2 → v3, sem parada no meio.
    expect(draft?.schemaVersion).toBe(3);
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

    migrarTudo();

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
      migrarTudo();

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

    migrarTudo();

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
    migrarTudo();
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
    migrarTudo();
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

    const relatorio = migrarTudo();

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

    migrarTudo();
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

    const relatorio = migrarTudo();
    desassinar();

    expect(relatorio.draftDiscarded).toBe(true);
    expect(avisos).toContain('invalid_shape');
    expect(localStorage.getItem(LEGACY_KEYS.draft)).toBeNull();
    expect(loadDraft()).toBeNull();
  });

  it('itens ilegíveis descartam o rascunho inteiro, sem meia migração', () => {
    legacyDraft({ items: [{ isto: 'não é um item' }] });
    const relatorio = migrarTudo();

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

// ---------------------------------------------------------------------------
// 003 — migração v2 → v3 (contracts/storage.md §5)
// ---------------------------------------------------------------------------

/** Grava um rascunho v2 cru: sem `shape`, sem `attentionReason`, sem reserva. */
function gravarV2(draft: Record<string, unknown>): void {
  localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify({ schemaVersion: 2, ...draft }));
}

/** Linha como a v2 a gravava: sem separador ⟹ inválida, título e artista vazios. */
function linhaV2Invalida(id: string, index: number, raw: string) {
  return { id, index, raw, title: '', artist: '', featuredArtists: [], parseStatus: 'unparsed' };
}

function linhaV2Valida(id: string, index: number, raw: string, title: string, artist: string) {
  return { id, index, raw, title, artist, featuredArtists: [], parseStatus: 'parsed' };
}

function rascunhoV2(lines: Record<string, unknown>[], items: Record<string, unknown>[] = []) {
  return {
    savedAt: 1_786_060_800_000,
    step: 'service',
    rawText: lines.map((line) => line['raw']).join('\n'),
    lines,
    playlistConfig: { name: 'Clássicos', description: '', isPublic: false },
    destinations: { selected: ['spotify'], locked: false },
    queue: {
      order: ['spotify'],
      currentIndex: 0,
      runs: {
        spotify: {
          provider: 'spotify',
          phase: 'review',
          lineIds: lines.map((line) => line['id']),
          items,
          frozenLines: null,
          estimate: null,
          creation: null,
          result: null,
          outcome: null,
          error: null,
        },
      },
    },
  };
}

describe('003/§11 — migração v2 → v3', () => {
  /**
   * O ganho de produto que a migração entrega, e a invariante W5: um rascunho
   * salvo antes desta feature volta com as linhas que estavam condenadas por
   * falta de separador novamente **buscáveis**.
   */
  it('W5 — linha v2 inválida por falta de separador volta válida na forma livre', () => {
    gravarV2(
      rascunhoV2([
        linhaV2Valida('l0', 0, 'Bohemian Rhapsody - Queen', 'Bohemian Rhapsody', 'Queen'),
        linhaV2Invalida('l1', 1, 'nao sei viver sem ter voce cpm 22'),
        linhaV2Invalida('l2', 2, '---'),
      ]),
    );

    const relatorio = migrateToV3();
    expect(relatorio.migrated).toBe(true);

    const draft = loadDraft();
    expect(draft?.schemaVersion).toBe(3);

    const [explicita, livre, lixo] = draft?.lines ?? [];
    expect(explicita?.shape).toBe('explicit');
    expect(explicita?.title).toBe('Bohemian Rhapsody');
    expect(explicita?.artist).toBe('Queen');

    expect(livre?.parseStatus).toBe('parsed');
    expect(livre?.shape).toBe('free');
    expect(livre?.title).toBe('nao sei viver sem ter voce cpm 22');

    // A única invalidez que sobra é a de conteúdo (L2).
    expect(lixo?.parseStatus).toBe('unparsed');
  });

  it('W5 — a migração nunca aumenta o número de linhas inválidas', () => {
    const lines = [
      linhaV2Invalida('l0', 0, 'primeira linha sem separador'),
      linhaV2Invalida('l1', 1, 'segunda linha sem separador'),
      linhaV2Invalida('l2', 2, '•••'),
      linhaV2Valida('l3', 3, 'Imagine - John Lennon', 'Imagine', 'John Lennon'),
    ];
    gravarV2(rascunhoV2(lines));

    const invalidasAntes = lines.filter((line) => line['parseStatus'] === 'unparsed').length;
    migrateToV3();
    const invalidasDepois = (loadDraft()?.lines ?? []).filter(
      (line) => line.parseStatus === 'unparsed',
    ).length;

    expect(invalidasDepois).toBeLessThanOrEqual(invalidasAntes);
    expect(invalidasDepois).toBe(1);
  });

  it('deriva o motivo de atenção do status já gravado, nunca inventa', () => {
    const linha = linhaV2Valida('l0', 0, 'Song - Artist', 'Song', 'Artist');
    const candidata = {
      uri: 'spotify:track:a',
      id: 'a',
      title: 'Song',
      artists: ['Artist'],
      album: 'Album',
      durationMs: 200_000,
      coverUrl: null,
      externalUrl: 'https://open.spotify.com/track/a',
      score: 0.7,
    };

    gravarV2(
      rascunhoV2(
        [linha],
        [
          {
            line: linha,
            status: 'uncertain',
            candidates: [{ ...candidata, versionHints: ['live'] }],
            selectedUri: 'spotify:track:a',
            included: false,
            duplicateOf: null,
            error: null,
            previousStatus: null,
          },
        ],
      ),
    );

    migrateToV3();
    expect(loadDraft()?.queue.runs.spotify?.items[0]?.attentionReason).toBe('version_hint');
  });

  it.each([
    ['not_found', 'not_found'],
    ['uncertain', 'no_artist_ambiguous'],
    ['confident', null],
  ] as const)('status %s gravado vira motivo %s', (status, esperado) => {
    const linha = linhaV2Valida('l0', 0, 'Song - Artist', 'Song', 'Artist');
    gravarV2(
      rascunhoV2(
        [linha],
        [
          {
            line: linha,
            status,
            candidates: [],
            selectedUri: null,
            included: false,
            duplicateOf: null,
            error: null,
            previousStatus: null,
          },
        ],
      ),
    );

    migrateToV3();
    expect(loadDraft()?.queue.runs.spotify?.items[0]?.attentionReason).toBe(esperado);
  });

  it('zera retriesUsed e recalcula a reserva a partir das linhas (O5)', () => {
    gravarV2(
      rascunhoV2([
        linhaV2Valida('l0', 0, 'Imagine - John Lennon', 'Imagine', 'John Lennon'),
        linhaV2Invalida('l1', 1, 'so o titulo'),
      ]),
    );

    migrateToV3();
    const run = loadDraft()?.queue.runs.spotify;
    expect(run?.retriesUsed).toBe(0);
  });

  /** Invariante W4. */
  it('aplicar a migração a um rascunho v3 é no-op', () => {
    gravarV2(rascunhoV2([linhaV2Invalida('l0', 0, 'linha livre qualquer')]));

    expect(migrateToV3().migrated).toBe(true);
    const depoisDaPrimeira = localStorage.getItem(STORAGE_KEYS.draft);

    const segunda = migrateToV3();
    expect(segunda.ran).toBe(false);
    expect(segunda.migrated).toBe(false);
    expect(localStorage.getItem(STORAGE_KEYS.draft)).toBe(depoisDaPrimeira);
  });

  /** `upgradeDraftToV3` é puro: idempotência verificável sem armazenamento. */
  it('W4 — upgradeDraftToV3 aplicado duas vezes dá o mesmo resultado', () => {
    const draft = makeDraft();
    const uma = upgradeDraftToV3(draft);
    const duas = upgradeDraftToV3(uma);
    expect(duas).toEqual(uma);
  });

  /** `002/SC-018`: o relato de um serviço que terminou é imutável. */
  it('execução concluída atravessa a migração byte a byte', () => {
    const concluida = makeRun('spotify', {
      phase: 'done',
      outcome: 'completed',
      items: [makeItem({ status: 'uncertain' })],
    });
    const draft = makeDraft({ queue: makeQueue(['spotify'], { runs: { spotify: concluida } }) });

    const migrado = upgradeDraftToV3(draft);
    expect(migrado.queue.runs.spotify).toEqual(concluida);
  });

  it('rascunho v2 corrompido é descartado com aviso, sem exceção', () => {
    const avisos: string[] = [];
    const desassinar = onStorageWarning((warning) => avisos.push(warning.reason));

    gravarV2({ savedAt: 1, step: 'service' });

    let relatorio!: ReturnType<typeof migrateToV3>;
    expect(() => {
      relatorio = migrateToV3();
    }).not.toThrow();
    desassinar();

    expect(relatorio.discarded).toBe(true);
    expect(avisos).toContain('invalid_shape');
    expect(loadDraft()).toBeNull();
  });

  it('versão desconhecida é descartada, jamais lida às cegas', () => {
    localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify({ schemaVersion: 99, savedAt: 1 }));

    const relatorio = migrateToV3();
    expect(relatorio.discarded).toBe(true);
    expect(localStorage.getItem(STORAGE_KEYS.draft)).toBeNull();
  });

  it('sem rascunho algum, não faz nada', () => {
    expect(migrateToV3()).toEqual({ ran: false, migrated: false, discarded: false });
  });
});
