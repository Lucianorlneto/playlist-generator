/**
 * Ciclo de vida do rascunho (FR-037 a FR-039, FR-042, SC-014).
 *
 * O que a generalização multi-provedor mudou: o rascunho passa a guardar a
 * seleção de destinos e a fila inteira, e a retomada volta ao **serviço e à
 * etapa exatos**. O que não mudou é o que mais importa aqui — falha de renovação
 * derruba a sessão e **não** encosta no rascunho nem na credencial.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { parseInput } from '@/domain/parser';
import { handleSessionLoss } from '@/features/connect/reconnect';
import { runMatching } from '@/features/input/matchRunner';
import { configureProviderClient } from '@/services/providers/http';
import { createRefresher } from '@/services/providers/spotify/auth';
import { loadCredential, saveCredential } from '@/services/storage/credentialRepo';
import { loadDraft } from '@/services/storage/draftRepo';
import { clearSession, loadSession, saveSession } from '@/services/storage/sessionRepo';
import { useAppStore } from '@/store';
import { attachDraftPersistence, flushDraftNow } from '@/store/draftPersistence';
import { restoreDraft } from '@/store/restoreDraft';

import {
  makeCandidate,
  makeCredentials,
  makeItem,
  makeLine,
  makeQueue,
  makeRun,
  makeSession,
  makeSessions,
} from '../fixtures/factories';
import { program, RESPONSES, setRefreshBehaviour } from '../msw/handlers';

const CLIENT_ID = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
const TEXTO = 'Bohemian Rhapsody - Queen\nImagine - John Lennon';

function seedTrabalhoRevisado() {
  const lines = [
    makeLine({ id: 'l0', index: 0, raw: 'Bohemian Rhapsody - Queen' }),
    makeLine({
      id: 'l1',
      index: 1,
      raw: 'Imagine - Jhon Lennon',
      title: 'Imagine',
      artist: 'Jhon Lennon',
    }),
  ];

  const items = [
    makeItem({
      line: lines[0],
      candidates: [makeCandidate({ id: 'bohemian' })],
      included: true,
    }),
    // Escolha manual em um item que estava Incerto: é o que SC-014 exige preservar.
    makeItem({
      line: lines[1],
      status: 'confident',
      candidates: [makeCandidate({ id: 'imagine' }), makeCandidate({ id: 'outra' })],
      selectedUri: 'spotify:track:outra',
      included: true,
    }),
  ];

  useAppStore.setState({
    credentials: makeCredentials({ spotify: CLIENT_ID }),
    sessions: makeSessions({
      spotify: makeSession('spotify', { expiresAt: Date.now() - 1000 }),
    }),
    rawText: TEXTO,
    lines,
    destinations: { selected: ['spotify'], locked: false },
    queue: makeQueue(['spotify'], {
      currentIndex: 0,
      runs: {
        spotify: makeRun('spotify', {
          phase: 'review',
          lineIds: lines.map((line) => line.id),
          items,
        }),
      },
    }),
    playlistConfig: { name: 'Minha lista', description: 'com descrição', isPublic: true },
    step: 'service',
  });

  saveCredential('spotify', CLIENT_ID);
  saveSession(makeSession('spotify'));
  flushDraftNow();

  return { lines, items };
}

beforeEach(() => {
  configureProviderClient('spotify', {
    getSession: () => useAppStore.getState().sessions.spotify,
    saveSession: (session) => {
      saveSession(session);
      useAppStore.setState((state) => ({ sessions: { ...state.sessions, spotify: session } }));
    },
    clearSession: () => {
      clearSession('spotify');
      handleSessionLoss('spotify');
    },
    refresh: createRefresher(
      () => useAppStore.getState().credentials.spotify?.clientId ?? null,
    ),
  });
});

describe('SC-014 — falha de renovação preserva o trabalho', () => {
  it('limpa a sessão e mantém texto, nome e escolhas manuais', async () => {
    seedTrabalhoRevisado();
    setRefreshBehaviour({ works: false });
    program('search', RESPONSES.unauthorized());

    await runMatching('spotify', parseInput('Imagine - John Lennon'), {
      signal: new AbortController().signal,
    });

    // Sessão foi embora…
    expect(useAppStore.getState().sessions.spotify).toBeNull();
    expect(loadSession('spotify')).toBeNull();
    expect(useAppStore.getState().authError).not.toBeNull();

    // …mas credencial e rascunho continuam inteiros.
    expect(loadCredential('spotify')).toEqual({ clientId: CLIENT_ID });

    const draft = loadDraft();
    expect(draft?.rawText).toBe(TEXTO);
    expect(draft?.playlistConfig.name).toBe('Minha lista');
    expect(draft?.playlistConfig.isPublic).toBe(true);
    expect(draft?.queue.runs.spotify?.items[1]?.selectedUri).toBe('spotify:track:outra');
  });
});

describe('FR-037 a FR-039 — ciclo de vida do rascunho', () => {
  it('grava com debounce as mudanças de digitação', async () => {
    const detach = attachDraftPersistence();
    useAppStore.getState().setRawText('Wonderwall - Oasis');

    expect(loadDraft()).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(loadDraft()?.rawText).toBe('Wonderwall - Oasis');
    detach();
  });

  it('restaura serviço, etapa, texto, configuração e escolhas ao reabrir (FR-039)', () => {
    seedTrabalhoRevisado();
    // Simula uma nova sessão de navegação: só o disco sobrevive.
    useAppStore.setState({
      rawText: '',
      lines: [],
      queue: makeQueue([], { currentIndex: -1 }),
      step: 'credential',
    });

    expect(restoreDraft().restored).toBe(true);

    const state = useAppStore.getState();
    expect(state.rawText).toBe(TEXTO);
    expect(state.step).toBe('service');
    expect(state.playlistConfig.name).toBe('Minha lista');
    expect(state.destinations.selected).toEqual(['spotify']);
    expect(state.runFor('spotify')?.phase).toBe('review');
    expect(state.runFor('spotify')?.items[1]?.selectedUri).toBe('spotify:track:outra');
    expect(state.draftNotice).toBe('recovered');
    expect(state.draftSavedAt).not.toBeNull();
  });

  it('não oferece recuperação quando não há trabalho de fato', () => {
    useAppStore.setState({
      rawText: '   ',
      lines: [],
      queue: makeQueue([], { currentIndex: -1 }),
    });
    flushDraftNow();

    expect(restoreDraft().restored).toBe(false);
    expect(useAppStore.getState().draftNotice).toBe('none');
  });

  it('descartar o rascunho zera o trabalho e preserva a credencial (FR-038)', () => {
    seedTrabalhoRevisado();

    useAppStore.getState().discardDraft();

    expect(loadDraft()).toBeNull();
    expect(loadCredential('spotify')).toEqual({ clientId: CLIENT_ID });
    expect(useAppStore.getState().rawText).toBe('');
    expect(useAppStore.getState().lines).toEqual([]);
    expect(useAppStore.getState().draftNotice).toBe('discarded');
  });

  it('o rascunho gravado nunca contém token nem Client ID (invariante W1)', () => {
    seedTrabalhoRevisado();
    const bruto = localStorage.getItem('tp.v2.draft') ?? '';

    expect(bruto).not.toBe('');
    expect(bruto).not.toContain('accessToken');
    expect(bruto).not.toContain('refreshToken');
    expect(bruto).not.toContain(CLIENT_ID);
  });
});
