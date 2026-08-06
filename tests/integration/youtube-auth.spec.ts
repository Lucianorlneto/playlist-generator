/**
 * Autorização do YouTube pelo implicit flow (FR-035, FR-045, SC-005).
 *
 * O fluxo é o único disponível sem segredo e sem servidor (research §1), e traz
 * três consequências que precisam ser verificadas e não apenas documentadas:
 *
 * - **o token volta no fragmento**, e o fragmento tem de sumir do histórico
 *   antes de qualquer outra coisa;
 * - **não há `refresh_token`** — a ausência é dado, não erro (invariante S1);
 * - **`state` divergente invalida o retorno**, sem usar o token.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import {
  buildAuthorizeUrl,
  completeAuthorization,
  readFragmentTokens,
  SCOPE_STRING,
  takeFragmentParams,
} from '@/services/providers/youtube/auth';
import { AppError } from '@/services/providers/errors';
import { peekAuthRequest, saveAuthRequest } from '@/services/storage/authRequestRepo';

import { requestsTo, setYouTubeChannel } from '../msw/handlers';

const CLIENT_ID = '123-abc.apps.googleusercontent.com';
const REDIRECT_URI = 'http://127.0.0.1:5173/';

function fragment(params: Record<string, string>): URLSearchParams {
  return new URLSearchParams(params);
}

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('FR-045 — URL de consentimento do YouTube', () => {
  it('pede response_type=token e apenas o escopo mínimo', async () => {
    const url = new URL(await buildAuthorizeUrl(CLIENT_ID, REDIRECT_URI));

    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.pathname).toBe('/o/oauth2/v2/auth');
    expect(url.searchParams.get('response_type')).toBe('token');
    expect(url.searchParams.get('client_id')).toBe(CLIENT_ID);
    expect(url.searchParams.get('redirect_uri')).toBe(REDIRECT_URI);
    // Escopo mínimo: gerenciar playlists, nada além (FR-045).
    expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/youtube');
    expect(SCOPE_STRING).toBe('https://www.googleapis.com/auth/youtube');
  });

  it('não leva segredo de cliente em nenhum parâmetro (Princípio II)', async () => {
    const url = await buildAuthorizeUrl(CLIENT_ID, REDIRECT_URI);

    expect(url).not.toContain('client_secret');
    expect(url).not.toContain('code_challenge');
  });

  it('persiste o state para conferência no retorno', async () => {
    await buildAuthorizeUrl(CLIENT_ID, REDIRECT_URI);

    const record = peekAuthRequest('youtube');
    expect(record?.provider).toBe('youtube');
    expect(record?.state).toBeTruthy();
    // Implicit flow não usa PKCE: não há verificador a guardar.
    expect(record?.codeVerifier).toBeUndefined();
  });
});

describe('FR-035 — retorno pelo fragmento', () => {
  it('lê o token e não devolve refresh token (invariante S1)', async () => {
    saveAuthRequest({ provider: 'youtube', state: 'estado-1', createdAt: Date.now() });
    setYouTubeChannel({ id: 'UC_meu', title: 'Meu Canal' });

    const session = await completeAuthorization(
      fragment({
        access_token: 'ya29.token-do-fragmento',
        expires_in: '3599',
        state: 'estado-1',
        scope: SCOPE_STRING,
      }),
    );

    expect(session.provider).toBe('youtube');
    expect(session.accessToken).toBe('ya29.token-do-fragmento');
    expect(session.refreshToken).toBeNull();
    expect(session.expiresAt).toBeGreaterThan(Date.now());
    expect(session.user).toEqual({ id: 'UC_meu', displayName: 'Meu Canal' });
  });

  it('identifica a conta com uma chamada a channels.list (FR-036)', async () => {
    saveAuthRequest({ provider: 'youtube', state: 'estado-2', createdAt: Date.now() });

    await completeAuthorization(
      fragment({ access_token: 'ya29.abc', expires_in: '3599', state: 'estado-2' }),
    );

    expect(requestsTo('ytChannels')).toHaveLength(1);
    expect(requestsTo('ytChannels')[0]?.headers['authorization']).toBe('Bearer ya29.abc');
  });

  it('recusa o retorno quando o state diverge, sem usar o token', async () => {
    saveAuthRequest({ provider: 'youtube', state: 'estado-certo', createdAt: Date.now() });

    await expect(
      completeAuthorization(
        fragment({ access_token: 'ya29.token', expires_in: '3599', state: 'estado-forjado' }),
      ),
    ).rejects.toMatchObject({ kind: 'auth_state_mismatch', provider: 'youtube' });

    // Nenhuma chamada com o token recusado.
    expect(requestsTo('ytChannels')).toHaveLength(0);
  });

  it('recusa quando não há registro de autorização em voo', async () => {
    await expect(
      completeAuthorization(
        fragment({ access_token: 'ya29.token', expires_in: '3599', state: 'qualquer' }),
      ),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('a recusa de consentimento falha só este destino (caso de borda)', async () => {
    saveAuthRequest({ provider: 'youtube', state: 'estado-3', createdAt: Date.now() });

    await expect(
      completeAuthorization(fragment({ error: 'access_denied', state: 'estado-3' })),
    ).rejects.toMatchObject({ provider: 'youtube' });

    expect(requestsTo('ytChannels')).toHaveLength(0);
  });

  it('assume 1 hora quando expires_in não vem', () => {
    const antes = Date.now();
    const tokens = readFragmentTokens(
      fragment({ access_token: 'ya29.token', state: 'e' }),
      'e',
    );

    expect(tokens.expiresAt).toBeGreaterThanOrEqual(antes + 3_600_000);
    expect(tokens.scopes).toEqual([SCOPE_STRING]);
  });
});

describe('limpeza do fragmento', () => {
  it('apaga o token do histórico ao lê-lo', () => {
    window.history.replaceState(null, '', '/#access_token=ya29.segredo&state=e&expires_in=3599');
    expect(window.location.hash).toContain('access_token');

    const params = takeFragmentParams();

    expect(params.get('access_token')).toBe('ya29.segredo');
    // O token não sobrevive no histórico nem vaza pelo Referer.
    expect(window.location.hash).toBe('');
    expect(window.location.href).not.toContain('ya29.segredo');
  });

  it('preserva a URL quando não há nada de autorização no fragmento', () => {
    window.history.replaceState(null, '', '/#secao-qualquer');

    takeFragmentParams();

    expect(window.location.hash).toBe('#secao-qualquer');
  });
});
