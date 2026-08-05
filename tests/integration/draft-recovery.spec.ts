import { beforeEach, describe, expect, it } from 'vitest';

import { parseInput } from '@/domain/parser';
import { runMatching } from '@/features/input/matchRunner';
import { handleSessionLoss } from '@/features/connect/reconnect';
import { createRefresher } from '@/services/spotify/auth';
import { configureSpotifyClient } from '@/services/spotify/client';
import { createLimiter } from '@/services/rate-limiter';
import { loadCredential, saveCredential } from '@/services/storage/credentialRepo';
import { loadDraft } from '@/services/storage/draftRepo';
import { clearSession, loadSession, saveSession } from '@/services/storage/sessionRepo';
import { useAppStore } from '@/store';
import { attachDraftPersistence, flushDraftNow } from '@/store/draftPersistence';
import { restoreDraft } from '@/store/restoreDraft';

import { makeCandidate, makeItem, makeLine, makeSession } from '../fixtures/factories';
import { program, RESPONSES, setRefreshBehaviour } from '../msw/handlers';

const CLIENT_ID = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
const TEXTO = 'Bohemian Rhapsody - Queen\nImagine - John Lennon';

function seedTrabalhoRevisado() {
  const items = [
    makeItem({
      line: makeLine({ id: 'l0', index: 0, raw: 'Bohemian Rhapsody - Queen' }),
      candidates: [makeCandidate({ id: 'bohemian' })],
      included: true,
    }),
    // Escolha manual em um item que estava Incerto: é o que SC-006 exige preservar.
    makeItem({
      line: makeLine({
        id: 'l1',
        index: 1,
        raw: 'Imagine - Jhon Lennon',
        title: 'Imagine',
        artist: 'Jhon Lennon',
      }),
      status: 'confident',
      candidates: [makeCandidate({ id: 'imagine' }), makeCandidate({ id: 'outra' })],
      selectedUri: 'spotify:track:outra',
      included: true,
    }),
  ];

  useAppStore.setState({
    credential: { clientId: CLIENT_ID },
    session: makeSession({ expiresAt: Date.now() - 1000 }),
    rawText: TEXTO,
    items,
    playlistConfig: { name: 'Minha lista', description: 'com descrição', isPublic: true },
    step: 'review',
  });

  saveCredential(CLIENT_ID);
  saveSession(makeSession());
  flushDraftNow();
}

beforeEach(() => {
  configureSpotifyClient({
    getSession: () => useAppStore.getState().session,
    saveSession: (session) => {
      saveSession(session);
      useAppStore.setState({ session });
    },
    clearSession: () => {
      clearSession();
      handleSessionLoss();
    },
    refresh: createRefresher(() => useAppStore.getState().credential?.clientId ?? null),
  });
});

describe('SC-006 — falha de renovação preserva o trabalho', () => {
  it('limpa a sessão e mantém texto, nome e escolhas manuais', async () => {
    seedTrabalhoRevisado();
    setRefreshBehaviour({ works: false });
    program('search', RESPONSES.unauthorized());

    await runMatching(parseInput('Imagine - John Lennon'), {
      signal: new AbortController().signal,
      limiter: createLimiter({ ratePerSecond: 1000, burst: 1000, concurrency: 1 }),
    });

    // Sessão foi embora…
    expect(useAppStore.getState().session).toBeNull();
    expect(loadSession()).toBeNull();
    expect(useAppStore.getState().authError).not.toBeNull();
    expect(useAppStore.getState().step).toBe('credential');

    // …mas credencial e rascunho continuam inteiros.
    expect(loadCredential()).toEqual({ clientId: CLIENT_ID });

    const draft = loadDraft();
    expect(draft?.rawText).toBe(TEXTO);
    expect(draft?.playlistConfig.name).toBe('Minha lista');
    expect(draft?.playlistConfig.isPublic).toBe(true);
    expect(draft?.step).toBe('review');
    expect(draft?.items[1]?.selectedUri).toBe('spotify:track:outra');
  });
});

describe('FR-043 a FR-045 — ciclo de vida do rascunho', () => {
  it('grava com debounce as mudanças de digitação', async () => {
    const detach = attachDraftPersistence();
    useAppStore.getState().setRawText('Wonderwall - Oasis');

    expect(loadDraft()).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(loadDraft()?.rawText).toBe('Wonderwall - Oasis');
    detach();
  });

  it('restaura etapa, texto, configuração e escolhas ao reabrir (FR-044)', () => {
    seedTrabalhoRevisado();
    // Simula uma nova sessão de navegação: só o disco sobrevive.
    useAppStore.setState({ rawText: '', items: [], step: 'credential' });

    expect(restoreDraft()).toBe(true);

    const state = useAppStore.getState();
    expect(state.rawText).toBe(TEXTO);
    expect(state.step).toBe('review');
    expect(state.playlistConfig.name).toBe('Minha lista');
    expect(state.items[1]?.selectedUri).toBe('spotify:track:outra');
    expect(state.draftNotice).toBe('recovered');
    expect(state.draftSavedAt).not.toBeNull();
  });

  it('não oferece recuperação quando não há trabalho de fato', () => {
    useAppStore.setState({ rawText: '   ', items: [], creation: null });
    flushDraftNow();

    expect(restoreDraft()).toBe(false);
    expect(useAppStore.getState().draftNotice).toBe('none');
  });

  it('descartar o rascunho zera o trabalho e preserva a credencial (FR-045)', () => {
    seedTrabalhoRevisado();

    useAppStore.getState().discardDraft();

    expect(loadDraft()).toBeNull();
    expect(loadCredential()).toEqual({ clientId: CLIENT_ID });
    expect(useAppStore.getState().rawText).toBe('');
    expect(useAppStore.getState().items).toEqual([]);
    expect(useAppStore.getState().draftNotice).toBe('discarded');
  });

  it('o rascunho gravado nunca contém token', () => {
    seedTrabalhoRevisado();
    const bruto = localStorage.getItem('tp.v1.draft') ?? '';

    expect(bruto).not.toContain('accessToken');
    expect(bruto).not.toContain('refreshToken');
    expect(bruto).not.toContain(CLIENT_ID);
  });
});
