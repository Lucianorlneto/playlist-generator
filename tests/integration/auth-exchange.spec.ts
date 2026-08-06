import { describe, expect, it, vi } from 'vitest';

import { handleAuthCallback } from '@/features/connect/callback';
import { buildAuthorizeUrl, exchangeCode, SCOPE_STRING } from '@/services/providers/spotify/auth';
import { AppError } from '@/services/providers/errors';
import { peekAuthRequest, saveAuthRequest } from '@/services/storage/authRequestRepo';

import { requestLog, setUser } from '../msw/handlers';


const CLIENT_ID = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
const REDIRECT_URI = 'http://127.0.0.1:5173/';

function tokenRequests() {
  return requestLog.filter((entry) => entry.endpoint === 'token');
}

function setSearch(search: string): void {
  window.history.replaceState(null, '', `/${search}`);
}

describe('URL de consentimento (contrato §1)', () => {
  it('carrega os três escopos mínimos e o desafio S256', async () => {
    const url = await buildAuthorizeUrl(CLIENT_ID, REDIRECT_URI);
    const params = new URL(url).searchParams;
    const record = peekAuthRequest('spotify');

    expect(new URL(url).origin).toBe('https://accounts.spotify.com');
    expect(params.get('client_id')).toBe(CLIENT_ID);
    expect(params.get('response_type')).toBe('code');
    expect(params.get('redirect_uri')).toBe(REDIRECT_URI);
    expect(params.get('code_challenge_method')).toBe('S256');
    expect(params.get('code_challenge')).toBeTruthy();
    expect(params.get('state')).toBe(record?.state);
    expect(params.get('scope')).toBe(SCOPE_STRING);
    expect(params.get('scope')).not.toContain('user-read-private');
  });

  it('persiste o registro de autorização, com verifier, para o retorno', async () => {
    const url = await buildAuthorizeUrl(CLIENT_ID, REDIRECT_URI);
    const record = peekAuthRequest('spotify');
    expect(record?.state).toBe(new URL(url).searchParams.get('state'));
    // PKCE só existe no Spotify (contracts/storage.md §1).
    expect(record?.codeVerifier).toBeTruthy();
    expect(record?.provider).toBe('spotify');
  });
});

describe('Troca de código (contrato §2)', () => {
  it('envia form-urlencoded e nenhum header Authorization', async () => {
    await exchangeCode({
      clientId: CLIENT_ID,
      code: 'codigo-1',
      redirectUri: REDIRECT_URI,
      codeVerifier: 'verificador-1',
    });

    const request = tokenRequests().at(-1);
    expect(request).toBeDefined();
    expect(request?.headers['content-type']).toContain('application/x-www-form-urlencoded');
    expect(request?.headers['authorization']).toBeUndefined();

    const body = new URLSearchParams(request?.body ?? '');
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('codigo-1');
    expect(body.get('redirect_uri')).toBe(REDIRECT_URI);
    expect(body.get('client_id')).toBe(CLIENT_ID);
    expect(body.get('code_verifier')).toBe('verificador-1');
    expect(body.get('client_secret')).toBeNull();
  });

  it('devolve tokens com validade absoluta calculada localmente', async () => {
    const antes = Date.now();
    const tokens = await exchangeCode({
      clientId: CLIENT_ID,
      code: 'codigo-1',
      redirectUri: REDIRECT_URI,
      codeVerifier: 'verificador-1',
    });

    expect(tokens.accessToken).toBe('access-token-1');
    expect(tokens.refreshToken).toBe('refresh-token-1');
    expect(tokens.expiresAt).toBeGreaterThanOrEqual(antes + 3_600_000);
    expect(tokens.scopes).toContain('playlist-read-private');
  });
});

describe('Retorno do consentimento (research §2)', () => {
  it('conclui a conexão e limpa a query string', async () => {
    setUser({ id: 'usuario_teste', display_name: 'Fulano de Teste' });
    saveAuthRequest({ provider: 'spotify', codeVerifier: 'verificador-1', state: 'estado-1', createdAt: Date.now() });
    setSearch('?code=codigo-1&state=estado-1');

    const outcome = await handleAuthCallback({ spotify: CLIENT_ID });

    expect(outcome.kind).toBe('connected');
    if (outcome.kind === 'connected') {
      expect(outcome.session.user.displayName).toBe('Fulano de Teste');
      expect(outcome.session.accessToken).toBe('access-token-1');
    }
    expect(window.location.search).toBe('');
  });

  it('state divergente descarta o código sem trocá-lo', async () => {
    saveAuthRequest({ provider: 'spotify', codeVerifier: 'verificador-1', state: 'estado-correto', createdAt: Date.now() });
    setSearch('?code=codigo-1&state=estado-adulterado');

    const outcome = await handleAuthCallback({ spotify: CLIENT_ID });

    expect(outcome.kind).toBe('error');
    if (outcome.kind === 'error') {
      expect(outcome.error.kind).toBe('auth_state_mismatch');
    }
    expect(tokenRequests()).toHaveLength(0);
    expect(peekAuthRequest('spotify')).toBeNull();
  });

  it('destrói o registro PKCE mesmo quando a troca falha', async () => {
    saveAuthRequest({ provider: 'spotify', codeVerifier: 'verificador-1', state: 'estado-1', createdAt: Date.now() });
    setSearch('?code=codigo-1&state=estado-1');
    const spy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('sem rede'));

    const outcome = await handleAuthCallback({ spotify: CLIENT_ID });

    expect(outcome.kind).toBe('error');
    expect(peekAuthRequest('spotify')).toBeNull();
    spy.mockRestore();
  });

  it('traduz erro de autorização devolvido na query', async () => {
    setSearch('?error=access_denied&state=estado-1');

    const outcome = await handleAuthCallback({ spotify: CLIENT_ID });

    expect(outcome.kind).toBe('error');
    if (outcome.kind === 'error') {
      expect(outcome.error).toBeInstanceOf(AppError);
      expect(outcome.error.kind).toBe('auth_access_denied');
      // A mensagem cita a lista de usuários permitidos (US4 cenário 4).
      expect(outcome.error.info.nextStep).toContain('usuário de teste');
      // A falha é atribuída ao serviço que a produziu (invariante E1).
      expect(outcome.error.provider).toBe('spotify');
    }
    expect(window.location.search).toBe('');
  });

  it('não faz nada quando não há retorno de autorização na URL', async () => {
    setSearch('');
    const outcome = await handleAuthCallback({ spotify: CLIENT_ID });
    expect(outcome.kind).toBe('none');
    expect(tokenRequests()).toHaveLength(0);
  });
});
