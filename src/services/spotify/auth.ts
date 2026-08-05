/**
 * Fluxo OAuth 2.0 Authorization Code + PKCE (research §1, contrato §1 a §3).
 *
 * Duas propriedades que os testes cobrem diretamente:
 * - as requisições a `/api/token` vão em `x-www-form-urlencoded` e **sem** header
 *   `Authorization` — o fluxo PKCE não usa segredo de cliente;
 * - a renovação é coalescida no cliente HTTP, de modo que quatro buscas
 *   paralelas recebendo `401` disparem uma única renovação (research §9).
 */

import type { PkceRecord, Session, SpotifyUser } from '@/domain/types';
import { savePkce } from '@/services/storage/pkceRepo';

import { AppError, fromNetworkError, fromTokenError } from './errors';
import { AUTHORIZE_URL, TOKEN_URL } from './hosts';
import { createCodeChallenge, createCodeVerifier, createState } from './pkce';

/** Permissões mínimas (FR-007, research §3). `user-read-private` fica de fora. */
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
    response = await fetch(TOKEN_URL, {
      method: 'POST',
      // Sem `Authorization`: é justamente o que distingue o PKCE dos fluxos que
      // exigem segredo de cliente.
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
  } catch (error) {
    throw fromNetworkError(error);
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw fromTokenError(response.status, payload);
  }

  const token = payload as TokenResponse | null;
  if (token === null || typeof token.access_token !== 'string') {
    throw new AppError('auth_generic', { status: response.status });
  }
  return token;
}

/**
 * Monta a URL de consentimento e persiste o registro PKCE. Devolve a URL para
 * quem chama navegar — a navegação em si fica na camada de interface.
 */
export async function buildAuthorizeUrl(
  clientId: string,
  redirectUri: string,
): Promise<{ url: string; record: PkceRecord }> {
  const codeVerifier = createCodeVerifier();
  const state = createState();
  const codeChallenge = await createCodeChallenge(codeVerifier);

  const record: PkceRecord = { codeVerifier, state, createdAt: Date.now() };
  savePkce(record);

  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('state', state);
  url.searchParams.set('scope', SCOPE_STRING);

  return { url: url.toString(), record };
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
    // Sem refresh token não há renovação silenciosa (FR-008): melhor falhar aqui
    // do que descobrir na primeira expiração.
    throw new AppError('auth_generic');
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
 * caso o anterior é mantido (research §1) — descartá-lo encerraria a sessão do
 * usuário sem motivo.
 */
export async function refreshSession(session: Session, clientId: string): Promise<Session> {
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
  return async (session: Session): Promise<Session> => {
    const clientId = getClientId();
    if (clientId === null) throw new AppError('session_expired');
    return refreshSession(session, clientId);
  };
}

export function buildSession(tokens: ExchangedTokens, user: SpotifyUser): Session {
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
    scopes: tokens.scopes,
    user,
  };
}
