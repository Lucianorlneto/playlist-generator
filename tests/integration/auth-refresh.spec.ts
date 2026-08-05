import { beforeEach, describe, expect, it } from 'vitest';

import type { Session } from '@/domain/types';
import { createRefresher, refreshSession } from '@/services/spotify/auth';
import { configureSpotifyClient, ensureFreshSession } from '@/services/spotify/client';
import { AppError } from '@/services/spotify/errors';

import { makeSession } from '../fixtures/factories';
import { requestLog, setRefreshBehaviour } from '../msw/handlers';

const CLIENT_ID = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';

function tokenRequests() {
  return requestLog.filter((entry) => entry.endpoint === 'token');
}

/** Sessão vencida: força a renovação proativa (research §9). */
function expiredSession(): Session {
  return makeSession({ expiresAt: Date.now() - 1000 });
}

describe('Renovação (contrato §3)', () => {
  it('envia grant_type=refresh_token e client_id, sem Authorization', async () => {
    await refreshSession(expiredSession(), CLIENT_ID);

    const request = tokenRequests().at(-1);
    expect(request?.headers['authorization']).toBeUndefined();
    const body = new URLSearchParams(request?.body ?? '');
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('refresh-token-1');
    expect(body.get('client_id')).toBe(CLIENT_ID);
  });

  it('substitui o refresh token quando a resposta traz um novo', async () => {
    setRefreshBehaviour({ rotatedRefreshToken: 'refresh-token-2', accessToken: 'access-token-2' });

    const renewed = await refreshSession(expiredSession(), CLIENT_ID);

    expect(renewed.refreshToken).toBe('refresh-token-2');
    expect(renewed.accessToken).toBe('access-token-2');
  });

  it('mantém o refresh token anterior quando a resposta o omite', async () => {
    setRefreshBehaviour({ rotatedRefreshToken: null, accessToken: 'access-token-3' });

    const renewed = await refreshSession(expiredSession(), CLIENT_ID);

    expect(renewed.refreshToken).toBe('refresh-token-1');
    expect(renewed.accessToken).toBe('access-token-3');
  });

  it('preserva o usuário da sessão — a renovação não devolve perfil', async () => {
    const original = expiredSession();
    const renewed = await refreshSession(original, CLIENT_ID);
    expect(renewed.user).toEqual(original.user);
  });

  it('traduz refresh token revogado em falha de sessão', async () => {
    setRefreshBehaviour({ works: false });

    await expect(refreshSession(expiredSession(), CLIENT_ID)).rejects.toMatchObject({
      kind: 'auth_invalid_grant',
    });
  });
});

describe('Coalescência de renovações (research §9)', () => {
  let sessions: Session[];

  beforeEach(() => {
    sessions = [expiredSession()];
    configureSpotifyClient({
      getSession: () => sessions.at(-1) ?? null,
      saveSession: (session) => sessions.push(session),
      clearSession: () => sessions.push(),
      refresh: createRefresher(() => CLIENT_ID),
    });
  });

  it('quatro chamadas concorrentes disparam uma única renovação', async () => {
    const results = await Promise.all([
      ensureFreshSession(),
      ensureFreshSession(),
      ensureFreshSession(),
      ensureFreshSession(),
    ]);

    expect(tokenRequests()).toHaveLength(1);
    // Todas recebem exatamente a mesma sessão renovada.
    for (const result of results) expect(result).toBe(results[0]);
  });

  it('renova de novo depois que a primeira renovação termina', async () => {
    await ensureFreshSession();
    expect(tokenRequests()).toHaveLength(1);

    // A sessão renovada tem validade longa: só uma renovação forçada dispara outra.
    await ensureFreshSession(true);
    expect(tokenRequests()).toHaveLength(2);
  });

  it('não renova quando a sessão ainda está longe de expirar', async () => {
    sessions.push(makeSession({ expiresAt: Date.now() + 3_600_000 }));
    await ensureFreshSession();
    expect(tokenRequests()).toHaveLength(0);
  });

  it('falha de renovação limpa a sessão e propaga erro acionável', async () => {
    setRefreshBehaviour({ works: false });
    let cleared = false;
    configureSpotifyClient({
      getSession: () => expiredSession(),
      saveSession: () => undefined,
      clearSession: () => {
        cleared = true;
      },
      refresh: createRefresher(() => CLIENT_ID),
    });

    await expect(ensureFreshSession()).rejects.toBeInstanceOf(AppError);
    expect(cleared).toBe(true);
  });
});
