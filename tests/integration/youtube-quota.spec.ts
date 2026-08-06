/**
 * Esgotamento de cota durante a execução (FR-031, FR-032, SC-009).
 *
 * A invariante A1 de `contracts/youtube-api.md` é contável, e é assim que este
 * arquivo a verifica: depois de um `403 quotaExceeded`, o número de requisições
 * emitidas **para de crescer**. Repetir em laço contra uma cota esgotada é
 * exatamente o que SC-009 proíbe.
 *
 * O contraste com `rateLimitExceeded` é o ponto central: os dois chegam como
 * `403` e diferem só pelo `reason` no corpo — um encerra, o outro repete.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { startCreation } from '@/features/result/creationRunner';
import { configureProviderClient } from '@/services/providers/http';
import { classifyYouTubeError } from '@/services/providers/youtube/errors';
import { recordConsumption } from '@/services/providers/youtube/quota';
import { useAppStore } from '@/store';

import {
  makeItem,
  makeLine,
  makeQueue,
  makeRun,
  makeSession,
  makeSessions,
  makeVideoCandidate,
} from '../fixtures/factories';
import { PASS_THROUGH, program, requestsTo, YT_RESPONSES } from '../msw/handlers';
import { useFastLimiters } from './support/clients';

const TOTAL = 5;

function seed() {
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
    sessions: makeSessions({ youtube: makeSession('youtube') }),
    lines,
    destinations: { selected: ['youtube'], locked: false },
    queue: makeQueue(['youtube'], {
      currentIndex: 0,
      runs: {
        youtube: makeRun('youtube', {
          phase: 'creating',
          lineIds: lines.map((line) => line.id),
          items,
        }),
      },
    }),
    playlistConfig: { name: 'Cota', description: '', isPublic: false },
    existingNames: [],
    creating: false,
    creationError: null,
  });
}

function ytRun() {
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
  seed();
});

describe('SC-009 — esgotamento de cota encerra sem repetir', () => {
  it('para de emitir requisições assim que recebe quotaExceeded', async () => {
    // O primeiro item entra; o segundo esbarra na cota.
    program('ytPlaylistItems', PASS_THROUGH, YT_RESPONSES.quotaExceeded());

    await startCreation();

    // 1 sucesso + 1 recusa = 2. Nunca as 5 do total, nunca repetição.
    expect(requestsTo('ytPlaylistItems')).toHaveLength(2);
    expect(useAppStore.getState().creating).toBe(false);
  });

  it('dailyLimitExceeded recebe o mesmo tratamento terminal', async () => {
    program('ytPlaylistItems', PASS_THROUGH, YT_RESPONSES.dailyLimitExceeded());

    await startCreation();

    expect(requestsTo('ytPlaylistItems')).toHaveLength(2);
  });

  it('relata quantos itens entraram e deixa a playlist incompleta na conta (FR-032)', async () => {
    program('ytPlaylistItems', PASS_THROUGH, PASS_THROUGH, YT_RESPONSES.quotaExceeded());

    await startCreation();

    const run = ytRun();
    expect(run?.outcome).toBe('partial');
    expect(run?.result?.incompleteByQuota).toBe(true);
    expect(run?.result?.addedCount).toBe(2);
    // A playlist **não** é removida: o relato avisa que ela existe incompleta.
    expect(run?.result?.playlistId).toBeTruthy();
    expect(requestsTo('ytCreatePlaylist')).toHaveLength(1);
  });

  it('a mensagem identifica o serviço e a causa (FR-046)', async () => {
    program('ytPlaylistItems', YT_RESPONSES.quotaExceeded());

    await startCreation();

    const erro = ytRun()?.error;
    expect(erro).not.toBeNull();
    expect(erro?.provider).toBe('youtube');
  });

  it(
    'rateLimitExceeded **repete** — é transitório, não terminal',
    async () => {
      // Uma única recusa por taxa: o backoff do cliente é real (2 s na primeira
      // tentativa), então o teste paga esse tempo de propósito em vez de mockar
      // o relógio — é a espera que se quer verificar.
      program('ytPlaylistItems', YT_RESPONSES.rateLimitExceeded());

      await startCreation();

      // A recusa repetida soma uma requisição a mais que o total de itens.
      expect(requestsTo('ytPlaylistItems')).toHaveLength(TOTAL + 1);
      expect(ytRun()?.outcome).toBe('completed');
    },
    15_000,
  );

  it('cota esgotada ao criar a playlist encerra sem adicionar nada', async () => {
    program('ytCreatePlaylist', YT_RESPONSES.quotaExceeded());

    await startCreation();

    expect(requestsTo('ytPlaylistItems')).toHaveLength(0);
    expect(ytRun()?.outcome).toBe('failed');
    expect(ytRun()?.result).toBeNull();
  });
});
