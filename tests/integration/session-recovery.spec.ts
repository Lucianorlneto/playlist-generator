import { beforeEach, describe, expect, it } from 'vitest';

import { parseInput } from '@/domain/parser';
import { runMatching } from '@/features/input/matchRunner';
import { createRefresher } from '@/services/providers/spotify/auth';
import { configureProviderClient } from '@/services/providers/http';
import { saveSession } from '@/services/storage/sessionRepo';
import { useAppStore } from '@/store';

import { makeCredentials, makeSession, makeSessions } from '../fixtures/factories';
import { requestLog, RESPONSES, program, setCatalog, setRefreshBehaviour } from '../msw/handlers';

import { useFastLimiters } from './support/clients';

const CLIENT_ID = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
const TEXTO = 'Bohemian Rhapsody - Queen\nImagine - John Lennon';


function contar(endpoint: 'search' | 'token') {
  return requestLog.filter((entry) => entry.endpoint === endpoint).length;
}

beforeEach(() => {
  useAppStore.setState({
    credentials: makeCredentials({ spotify: CLIENT_ID }),
    sessions: makeSessions({
      spotify: makeSession('spotify', { expiresAt: Date.now() + 3_600_000 }),
    }),
    rawText: TEXTO,
    playlistConfig: { name: 'Minha lista', description: '', isPublic: false },
  });

  configureProviderClient('spotify', {
    getSession: () => useAppStore.getState().sessions.spotify,
    saveSession: (session) => {
      saveSession(session);
      useAppStore.setState((state) => ({
        sessions: { ...state.sessions, spotify: session },
      }));
    },
    clearSession: () =>
      useAppStore.setState((state) => ({ sessions: { ...state.sessions, spotify: null } })),
    refresh: createRefresher(() => useAppStore.getState().credentials.spotify?.clientId ?? null),
  });

  useFastLimiters();

  setCatalog([
    {
      id: 'bohemian',
      name: 'Bohemian Rhapsody',
      artists: ['Queen'],
      album: 'A Night at the Opera',
      durationMs: 354_320,
    },
    {
      id: 'imagine',
      name: 'Imagine',
      artists: ['John Lennon'],
      album: 'Imagine',
      durationMs: 187_000,
    },
  ]);
});

describe('US4 cenário 1 — sessão expirada no meio da busca', () => {
  it('renova silenciosamente e conclui sem perder o texto digitado', async () => {
    setRefreshBehaviour({ accessToken: 'access-token-renovado' });
    program('search', RESPONSES.unauthorized());

    const items = await runMatching('spotify', parseInput(TEXTO), {
      signal: new AbortController().signal
    });

    expect(items.every((item) => item.status === 'confident')).toBe(true);
    expect(contar('token')).toBe(1);
    expect(useAppStore.getState().rawText).toBe(TEXTO);
    expect(useAppStore.getState().sessions.spotify?.accessToken).toBe('access-token-renovado');
  });

  it('renova proativamente quando falta menos de um minuto (research §9)', async () => {
    useAppStore.setState({
      sessions: makeSessions({ spotify: makeSession('spotify', { expiresAt: Date.now() + 30_000 }) }),
    });

    await runMatching('spotify', parseInput('Imagine - John Lennon'), {
      signal: new AbortController().signal
    });

    expect(contar('token')).toBe(1);
    expect(contar('search')).toBe(1);
  });

  it('quatro linhas em paralelo com 401 disparam uma única renovação', async () => {
    program(
      'search',
      RESPONSES.unauthorized(),
      RESPONSES.unauthorized(),
      RESPONSES.unauthorized(),
      RESPONSES.unauthorized(),
    );

    await runMatching('spotify', parseInput(
        [
          'Bohemian Rhapsody - Queen',
          'Imagine - John Lennon',
          'Bohemian Rhapsody - Queen',
          'Imagine - John Lennon',
        ].join('\n'),
      ),
      { signal: new AbortController().signal },
    );

    expect(contar('token')).toBe(1);
  });

  it('um segundo 401 não entra em laço de renovação', async () => {
    program('search', RESPONSES.unauthorized(), RESPONSES.unauthorized());

    const items = await runMatching('spotify', parseInput('Imagine - John Lennon'), {
      signal: new AbortController().signal
    });

    expect(items[0]?.error).not.toBeNull();
    expect(contar('token')).toBe(1);
    expect(contar('search')).toBe(2);
  });
});
