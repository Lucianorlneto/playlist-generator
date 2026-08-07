/**
 * V24, V26, V27 — a perda de autorização durante a **criação** (`004/US2`,
 * FR-027 a FR-032, SC-010, SC-011).
 *
 * É o caso de maior consequência da feature: aqui já existe coisa escrita na
 * conta do usuário. As garantias que estes casos protegem são, nesta ordem de
 * gravidade:
 *
 * 1. a playlist parcial **não** é removida, recriada nem renomeada (FR-030);
 * 2. **nada** é escrito entre a interrupção e a reconexão (FR-032, SC-011);
 * 3. a retomada não duplica nem pula faixa (FR-029, SC-010);
 * 4. reconectar a **outra conta** não cria uma segunda playlist (FR-031).
 *
 * A retomada por lote em si **já existia** (`004/research §5`) e não foi
 * alterada — `partial-failure.spec.ts` passa sem edição e é a prova disso (V25).
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { retryRemaining, startCreation } from '@/features/result/creationRunner';
import { configureProviderClient } from '@/services/providers/http';
import { classifyYouTubeError } from '@/services/providers/youtube/errors';
import { recordConsumption } from '@/services/providers/youtube/quota';
import { loadDraft } from '@/services/storage/draftRepo';
import { useAppStore } from '@/store';
import { attachDraftPersistence } from '@/store/draftPersistence';

import {
  makeCreation,
  makeCredentials,
  makeItem,
  makeLine,
  makeQueue,
  makeRun,
  makeSession,
  makeSessions,
  makeVideoCandidate,
} from '../fixtures/factories';
import {
  createdYouTubePlaylist,
  PASS_THROUGH,
  program,
  programUnauthorized,
  requestsTo,
  seedCreatedYouTubePlaylist,
  YT_RESPONSES,
} from '../msw/handlers';
import { countRequestsFrom, useFastLimiters } from './support/clients';

const CLIENT_ID = '123-abc.apps.googleusercontent.com';
const TOTAL = 5;

function semear(overrides: Partial<ReturnType<typeof makeRun>> = {}) {
  const lines = Array.from({ length: TOTAL }, (_, index) =>
    makeLine({ id: `l${index}`, index, raw: `Faixa ${index} - Artista` }),
  );
  const items = lines.map((line, index) =>
    makeItem({
      line,
      candidates: [makeVideoCandidate({ id: `v${index}` })],
      selectedUri: `v${index}`,
      included: true,
    }),
  );

  useAppStore.setState({
    step: 'service',
    lines,
    credentials: makeCredentials({ youtube: CLIENT_ID }),
    sessions: makeSessions({ youtube: makeSession('youtube') }),
    destinations: { selected: ['youtube'], locked: false },
    playlistConfig: { name: 'Cota', description: '', isPublic: false },
    existingNames: [],
    creating: false,
    creationError: null,
    queue: makeQueue(['youtube'], {
      currentIndex: 0,
      runs: {
        youtube: makeRun('youtube', {
          phase: 'creating',
          lineIds: lines.map((line) => line.id),
          items,
          ...overrides,
        }),
      },
    }),
  });

  return lines;
}

function run() {
  return useAppStore.getState().runFor('youtube');
}

beforeEach(() => {
  useFastLimiters();
  configureProviderClient('youtube', {
    getSession: () => useAppStore.getState().sessions.youtube,
    saveSession: () => undefined,
    clearSession: () => undefined,
    recordConsumption,
    classifyError: classifyYouTubeError,
  });
  semear();
});

describe('V24/FR-027 — `401` na adição leva a awaiting_reauth, não a desfecho', () => {
  it('a execução para com resumeFrom `creating` e sem desfecho', async () => {
    // O primeiro item entra; o segundo esbarra na credencial inválida.
    program('ytPlaylistItems', PASS_THROUGH);
    programUnauthorized('ytPlaylistItems', 1);

    await startCreation();

    expect(run()?.phase).toBe('awaiting_reauth');
    expect(run()?.resumeFrom).toBe('creating');
    expect(run()?.outcome).toBeNull();
    expect(run()?.result).toBeNull();
    expect(useAppStore.getState().creating).toBe(false);
  });

  it('o índice de confirmação registra exatamente o que entrou', async () => {
    program('ytPlaylistItems', PASS_THROUGH, PASS_THROUGH);
    programUnauthorized('ytPlaylistItems', 1);

    await startCreation();

    expect(run()?.creation?.committedItems).toBe(2);
    expect(run()?.creation?.failedAt).toBe(2);
  });

  it('a sessão do serviço é encerrada e a causa fica exibível (FR-046)', async () => {
    programUnauthorized('ytPlaylistItems', 1);

    await startCreation();

    expect(useAppStore.getState().sessions.youtube).toBeNull();
    expect(useAppStore.getState().authError?.provider).toBe('youtube');
  });
});

describe('V26/FR-032/SC-011 — nada é escrito entre a interrupção e a reconexão', () => {
  it('nenhuma requisição de escrita sai depois da detecção', async () => {
    program('ytPlaylistItems', PASS_THROUGH);
    programUnauthorized('ytPlaylistItems', 1);

    await startCreation();

    const depois = countRequestsFrom('youtube');
    // Sem sessão, a retomada não dispara — e nada é escrito.
    await retryRemaining();

    expect(depois()).toBe(0);
    expect(run()?.phase).toBe('awaiting_reauth');
  });
});

describe('FR-030 — a playlist criada não é removida, recriada nem renomeada', () => {
  it('a playlist parcial continua na conta, com o que já entrou', async () => {
    program('ytPlaylistItems', PASS_THROUGH, PASS_THROUGH);
    programUnauthorized('ytPlaylistItems', 1);

    await startCreation();

    const playlistId = run()?.creation?.playlistId ?? '';
    const naConta = createdYouTubePlaylist(playlistId);

    expect(naConta).toBeDefined();
    expect(naConta?.videoIds).toHaveLength(2);
    expect(naConta?.title).toBe('Cota');
    // Uma criação, e só uma.
    expect(requestsTo('ytCreatePlaylist')).toHaveLength(1);
  });
});

describe('US2 cenário 4 — recarregar sem reconectar', () => {
  it('o rascunho retoma a mesma execução com o índice de confirmação válido', async () => {
    const desligar = attachDraftPersistence();
    try {
      program('ytPlaylistItems', PASS_THROUGH, PASS_THROUGH);
      programUnauthorized('ytPlaylistItems', 1);

      await startCreation();

      const draft = loadDraft();
      const gravado = draft?.queue.runs.youtube;

      expect(gravado?.phase).toBe('awaiting_reauth');
      expect(gravado?.resumeFrom).toBe('creating');
      expect(gravado?.creation?.committedItems).toBe(2);
      expect(gravado?.creation?.playlistId).toBe(run()?.creation?.playlistId);
      expect(gravado?.outcome).toBeNull();
    } finally {
      desligar();
    }
  });
});

describe('FR-029/SC-010 — a retomada não duplica nem pula faixa', () => {
  it('reconectar à mesma conta envia só o que falta', async () => {
    program('ytPlaylistItems', PASS_THROUGH, PASS_THROUGH);
    programUnauthorized('ytPlaylistItems', 1);
    await startCreation();

    const playlistId = run()?.creation?.playlistId ?? '';
    // Reconexão à **mesma** conta.
    useAppStore.setState({ sessions: makeSessions({ youtube: makeSession('youtube') }) });
    useAppStore.getState().dispatchRun({ type: 'authorized' }, 'youtube');

    await retryRemaining();

    const naConta = createdYouTubePlaylist(playlistId);
    expect(naConta?.videoIds).toEqual(['v0', 'v1', 'v2', 'v3', 'v4']);
    expect(run()?.outcome).toBe('completed');
    expect(run()?.result?.addedCount).toBe(TOTAL);
  });
});

describe('V27/FR-031 — reconexão a uma conta diferente', () => {
  beforeEach(() => {
    seedCreatedYouTubePlaylist('PL_parcial', 'Cota', ['v0', 'v1']);
    semear({
      phase: 'awaiting_reauth',
      resumeFrom: 'creating',
      creation: makeCreation({
        playlistId: 'PL_parcial',
        playlistUrl: 'https://www.youtube.com/playlist?list=PL_parcial',
        orderedUris: ['v0', 'v1', 'v2', 'v3', 'v4'],
        batchSize: 1,
        committedItems: 2,
        failedAt: 2,
        accountId: 'UC_conta_original',
      }),
    });
  });

  it('encerra o destino como parcial, sem criar uma segunda playlist', async () => {
    useAppStore.setState({
      sessions: makeSessions({
        youtube: makeSession('youtube', { user: { id: 'UC_outra', displayName: 'Outro Canal' } }),
      }),
    });

    const depois = countRequestsFrom('youtube');
    await retryRemaining();

    expect(depois()).toBe(0);
    expect(requestsTo('ytCreatePlaylist')).toHaveLength(0);
    expect(run()?.outcome).toBe('partial');
    // A contagem relatada é a real do que foi escrito.
    expect(run()?.result?.addedCount).toBe(2);
    expect(run()?.result?.playlistId).toBe('PL_parcial');
  });

  it('reconectar à conta original retoma normalmente', async () => {
    useAppStore.setState({
      sessions: makeSessions({
        youtube: makeSession('youtube', {
          user: { id: 'UC_conta_original', displayName: 'Canal de Teste' },
        }),
      }),
    });
    // O caminho real: a etapa despacha `authorized` e só então retoma.
    useAppStore.getState().dispatchRun({ type: 'authorized' }, 'youtube');

    await retryRemaining();

    expect(createdYouTubePlaylist('PL_parcial')?.videoIds).toEqual([
      'v0',
      'v1',
      'v2',
      'v3',
      'v4',
    ]);
    expect(run()?.outcome).toBe('completed');
  });

  it('rascunho anterior à feature, sem conta registrada, não é bloqueado', async () => {
    seedCreatedYouTubePlaylist('PL_antiga', 'Cota', ['v0']);
    semear({
      phase: 'awaiting_reauth',
      resumeFrom: 'creating',
      creation: makeCreation({
        playlistId: 'PL_antiga',
        orderedUris: ['v0', 'v1', 'v2', 'v3', 'v4'],
        batchSize: 1,
        committedItems: 1,
        accountId: null,
      }),
    });
    useAppStore.getState().dispatchRun({ type: 'authorized' }, 'youtube');

    await retryRemaining();

    // Desconhecido não bloqueia: encerrar como parcial uma execução retomável
    // seria o dano oposto ao que FR-031 evita.
    expect(run()?.outcome).toBe('completed');
  });
});

describe('Precedência de cota sobre reconexão (`004/research §12`)', () => {
  it('cota esgotada continua encerrando sem virar pedido de reautorização', async () => {
    program('ytPlaylistItems', PASS_THROUGH, YT_RESPONSES.quotaExceeded());

    await startCreation();

    expect(run()?.phase).not.toBe('awaiting_reauth');
    expect(run()?.outcome).toBe('partial');
    expect(run()?.result?.incompleteByQuota).toBe(true);
  });
});
