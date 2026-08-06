/**
 * O rascunho depois de um encerramento por cota (FR-038, Princípio V).
 *
 * O Princípio V é literal: o trabalho em andamento só é apagado **após sucesso**
 * ou por **ação explícita de descarte**. Encerramento por esgotamento de cota
 * não é nenhum dos dois — é desfecho terminal, mas não é sucesso.
 *
 * A consequência prática é que a reabertura relata, e não retoma: FR-031 já
 * decidiu que não existe continuação em outro dia.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { startCreation } from '@/features/result/creationRunner';
import { configureProviderClient } from '@/services/providers/http';
import { classifyYouTubeError } from '@/services/providers/youtube/errors';
import { recordConsumption } from '@/services/providers/youtube/quota';
import { loadDraft } from '@/services/storage/draftRepo';
import { useAppStore } from '@/store';
import { attachDraftPersistence } from '@/store/draftPersistence';
import { restoreDraft } from '@/store/restoreDraft';

import {
  makeItem,
  makeLine,
  makeQueue,
  makeRun,
  makeSession,
  makeSessions,
  makeVideoCandidate,
} from '../fixtures/factories';
import { PASS_THROUGH, program, YT_RESPONSES } from '../msw/handlers';
import { useFastLimiters } from './support/clients';

const TOTAL = 4;

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
    rawText: lines.map((line) => line.raw).join('\n'),
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
    playlistConfig: { name: 'Rascunho após cota', description: '', isPublic: false },
    existingNames: [],
    creating: false,
    creationError: null,
    step: 'service',
  });
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

describe('FR-038 — encerramento por cota preserva o rascunho', () => {
  it('não apaga o rascunho quando a execução termina por cota', async () => {
    const detach = attachDraftPersistence();
    program('ytPlaylistItems', PASS_THROUGH, YT_RESPONSES.quotaExceeded());

    await startCreation();

    // Encerrou — mas não por sucesso nem por descarte explícito.
    expect(useAppStore.getState().runFor('youtube')?.outcome).toBe('partial');
    expect(loadDraft()).not.toBeNull();
    detach();
  });

  it('o rascunho preservado guarda o desfecho daquela execução', async () => {
    const detach = attachDraftPersistence();
    program('ytPlaylistItems', PASS_THROUGH, YT_RESPONSES.quotaExceeded());

    await startCreation();

    const run = loadDraft()?.queue.runs.youtube;
    expect(run?.outcome).toBe('partial');
    expect(run?.result?.incompleteByQuota).toBe(true);
    expect(run?.result?.addedCount).toBe(1);
    detach();
  });

  it('a reabertura restaura o relato, sem oferecer retomada (FR-031)', async () => {
    const detach = attachDraftPersistence();
    program('ytPlaylistItems', PASS_THROUGH, YT_RESPONSES.quotaExceeded());

    await startCreation();
    detach();

    // Nova sessão de navegação: só o disco sobrevive.
    useAppStore.setState({
      rawText: '',
      lines: [],
      queue: makeQueue([], { currentIndex: -1 }),
      step: 'credential',
    });

    expect(restoreDraft().restored).toBe(true);

    const run = useAppStore.getState().runFor('youtube');
    // A execução volta **encerrada**: não há fase aberta para retomar.
    expect(run?.outcome).toBe('partial');
    expect(run?.result?.incompleteByQuota).toBe(true);
    expect(run?.phase).not.toBe('creating');
  });

  it('o descarte explícito é o caminho adiante, e ele apaga (Princípio V)', async () => {
    const detach = attachDraftPersistence();
    program('ytPlaylistItems', PASS_THROUGH, YT_RESPONSES.quotaExceeded());

    await startCreation();
    expect(loadDraft()).not.toBeNull();

    useAppStore.getState().discardDraft();

    expect(loadDraft()).toBeNull();
    expect(useAppStore.getState().draftNotice).toBe('discarded');
    detach();
  });

  it('sucesso em todos os serviços continua apagando o rascunho', async () => {
    const detach = attachDraftPersistence();

    await startCreation();

    expect(useAppStore.getState().runFor('youtube')?.outcome).toBe('completed');
    expect(loadDraft()).toBeNull();
    detach();
  });
});
