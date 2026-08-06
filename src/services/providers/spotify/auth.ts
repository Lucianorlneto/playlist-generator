/**
 * Fluxo OAuth 2.0 Authorization Code + PKCE do Spotify (research §1 da 001).
 *
 * Duas propriedades que os testes cobrem diretamente:
 * - as requisições a `/api/token` vão em `x-www-form-urlencoded` e **sem** header
 *   `Authorization` — o fluxo PKCE não usa segredo de cliente;
 * - a renovação é coalescida no cliente HTTP, de modo que quatro buscas
 *   paralelas recebendo `401` disparem uma única renovação.
 */

import type { AuthRequest, ProviderSession, ProviderUser } from '@/domain/types';
import { AppError, fromNetworkError, fromTokenError } from '@/services/providers/errors';
import { SPOTIFY_AUTHORIZE_URL, SPOTIFY_TOKEN_URL } from '@/services/providers/hosts';
import { saveAuthRequest } from '@/services/storage/authRequestRepo';

import { createCodeChallenge, createCodeVerifier, createState } from './pkce';

const PROVIDER = 'spotify' as const;

/** Permissões mínimas (Princípio II). `user-read-private` fica de fora. */
export const SCOPES = [
  'playlist-modify-private',
  'playlist-modify-public',
  'playlist-read-private',
] as const;

export const SCOPE_STRING = SCOPES.join(' ');

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

async function postToken(body: URLSearchParams): Promise<TokenResponse> {
  let response: Response;
  try {
    response = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      // Sem `Authorization`: é justamente o que distingue o PKCE dos fluxos que
      // exigem segredo de cliente.
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
  } catch (error) {
    throw fromNetworkError(error, PROVIDER);
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw fromTokenError(response.status, payload, PROVIDER);
  }

  const token = payload as TokenResponse | null;
  if (token === null || typeof token.access_token !== 'string') {
    throw new AppError('auth_generic', { provider: PROVIDER, status: response.status });
  }
  return token;
}

/**
 * Monta a URL de consentimento e persiste o registro de autorização. Devolve a
 * URL para quem chama navegar — a navegação em si fica na camada de interface.
 */
export async function buildAuthorizeUrl(clientId: string, redirectUri: string): Promise<string> {
  const codeVerifier = createCodeVerifier();
  const state = createState();
  const codeChallenge = await createCodeChallenge(codeVerifier);

  const record: AuthRequest = {
    provider: PROVIDER,
    state,
    codeVerifier,
    createdAt: Date.now(),
  };
  saveAuthRequest(record);

  const url = new URL(SPOTIFY_AUTHORIZE_URL);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('state', state);
  url.searchParams.set('scope', SCOPE_STRING);

  return url.toString();
}

export interface ExchangeParams {
  clientId: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
}

export interface ExchangedTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scopes: string[];
}

export async function exchangeCode(params: ExchangeParams): Promise<ExchangedTokens> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: params.code,
    redirect_uri: params.redirectUri,
    client_id: params.clientId,
    code_verifier: params.codeVerifier,
  });

  const token = await postToken(body);

  if (typeof token.refresh_token !== 'string') {
    // O Spotify declara renovação silenciosa; sem refresh token o contrato foi
    // quebrado. Melhor falhar aqui do que descobrir na primeira expiração.
    throw new AppError('auth_generic', { provider: PROVIDER });
  }

  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + token.expires_in * 1000,
    scopes: (token.scope ?? SCOPE_STRING).split(' ').filter((scope) => scope !== ''),
  };
}

/**
 * Renova a sessão. A resposta **pode** não trazer um novo `refresh_token`; nesse
 * caso o anterior é mantido — descartá-lo encerraria a sessão sem motivo.
 */
export async function refreshSession(
  session: ProviderSession,
  clientId: string,
): Promise<ProviderSession> {
  if (session.refreshToken === null) {
    throw new AppError('reauth_required', { provider: PROVIDER });
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: session.refreshToken,
    client_id: clientId,
  });

  const token = await postToken(body);

  return {
    ...session,
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? session.refreshToken,
    expiresAt: Date.now() + token.expires_in * 1000,
    scopes: (token.scope ?? SCOPE_STRING).split(' ').filter((scope) => scope !== ''),
  };
}

/** Fábrica do renovador injetado no cliente HTTP, que não conhece a credencial. */
export function createRefresher(getClientId: () => string | null) {
  return async (session: ProviderSession): Promise<ProviderSession> => {
    const clientId = getClientId();
    if (clientId === null) throw new AppError('session_expired', { provider: PROVIDER });
    return refreshSession(session, clientId);
  };
}

export function buildSession(tokens: ExchangedTokens, user: ProviderUser): ProviderSession {
  return {
    provider: PROVIDER,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
    scopes: tokens.scopes,
    user,
  };
}
