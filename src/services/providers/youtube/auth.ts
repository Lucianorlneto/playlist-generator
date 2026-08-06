/**
 * Autorização do YouTube — OAuth 2.0 **Implicit Flow** (research §1,
 * contracts/youtube-api.md §2).
 *
 * Por que este fluxo, e não o mesmo do Spotify: para clientes do tipo *Web
 * application*, o endpoint de token do Google exige o segredo de cliente **mesmo
 * com PKCE**. Guardar esse segredo no navegador viola o Princípio II; introduzir
 * um servidor de troca viola o Princípio I. O implicit flow é o único que sobra — e
 * o Princípio I já antecipa exatamente este caso ao exigir "o fluxo que dispensa
 * segredo e componente de servidor, mesmo quando for o menos confortável dos
 * disponíveis".
 *
 * A consequência não tem contorno: **não há `refresh_token`**. A sessão vale
 * ~1 hora e a reautorização é explícita — comportamento previsto da interface,
 * não erro (FR-035).
 *
 * Três obrigações que este módulo cumpre na ordem exata:
 * 1. conferir o `state` antes de usar o token;
 * 2. limpar o fragmento com `history.replaceState` **antes de qualquer await** —
 *    um token no fragmento sobrevive no histórico e pode vazar no `Referer`;
 * 3. devolver `refreshToken: null`, que é dado válido, não falha.
 */

import type { AuthRequest, ProviderSession, ProviderUser } from '@/domain/types';
import { AppError, fromAuthorizeError, fromHttpStatus, fromNetworkError } from '@/services/providers/errors';
import { apiUrlFor, GOOGLE_AUTHORIZE_URL } from '@/services/providers/hosts';
import { saveAuthRequest, takeAuthRequest } from '@/services/storage/authRequestRepo';

import { createState } from '../spotify/pkce';
import { classifyYouTubeError } from './errors';

const PROVIDER = 'youtube' as const;

/**
 * Escopo único e mínimo (research §2). `youtube.force-ssl` cobre o mesmo e mais
 * (avaliações, comentários, legendas) — escopo maior sem ganho.
 * `youtube.readonly` não escreve.
 */
export const SCOPES = ['https://www.googleapis.com/auth/youtube'] as const;
export const SCOPE_STRING = SCOPES.join(' ');

export async function buildAuthorizeUrl(clientId: string, redirectUri: string): Promise<string> {
  const state = createState();
  const record: AuthRequest = { provider: PROVIDER, state, createdAt: Date.now() };
  saveAuthRequest(record);

  const url = new URL(GOOGLE_AUTHORIZE_URL);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'token');
  url.searchParams.set('scope', SCOPE_STRING);
  url.searchParams.set('state', state);
  url.searchParams.set('include_granted_scopes', 'true');

  return Promise.resolve(url.toString());
}

/** Lê o fragmento da URL e o apaga do histórico na mesma operação. */
export function takeFragmentParams(): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams();

  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  const params = new URLSearchParams(hash);

  if (params.has('access_token') || params.has('error')) {
    const { pathname, search } = window.location;
    window.history.replaceState(null, '', `${pathname}${search}`);
  }

  return params;
}

interface ChannelResponse {
  items?: { id?: string; snippet?: { title?: string } }[];
}

/**
 * Identifica a conta com `channels.list(mine=true)` — custo 1 unidade.
 *
 * É o mínimo para FR-036 ("deixar claro em qual conta cada playlist foi criada")
 * sem pedir escopo de perfil. O token vai explícito porque ainda não existe
 * sessão gravada para o cliente HTTP consultar.
 */
export async function getChannelWithToken(
  accessToken: string,
  signal?: AbortSignal,
): Promise<ProviderUser> {
  let response: Response;
  try {
    response = await fetch(
      apiUrlFor(PROVIDER, '/youtube/v3/channels', { part: 'snippet', mine: 'true' }),
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        ...(signal === undefined ? {} : { signal }),
      },
    );
  } catch (error) {
    throw fromNetworkError(error, PROVIDER);
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw (
      classifyYouTubeError(response.status, payload) ??
      fromHttpStatus(response.status, { provider: PROVIDER, body: payload })
    );
  }

  const channel = (payload as ChannelResponse | null)?.items?.[0];
  const id = channel?.id;
  if (typeof id !== 'string' || id === '') {
    throw new AppError('auth_generic', { provider: PROVIDER, status: response.status });
  }

  const title = channel?.snippet?.title;
  return {
    id,
    displayName: typeof title === 'string' && title.trim() !== '' ? title : id,
  };
}

export interface FragmentTokens {
  accessToken: string;
  expiresAt: number;
  scopes: string[];
}

/**
 * Interpreta o fragmento do retorno. Recebe os parâmetros já extraídos para que
 * a limpeza do histórico aconteça na camada de roteamento, **antes** de qualquer
 * `await` — e para que este módulo continue testável sem `window`.
 */
export function readFragmentTokens(params: URLSearchParams, expectedState: string): FragmentTokens {
  const errorCode = params.get('error');
  if (errorCode !== null) throw fromAuthorizeError(errorCode, PROVIDER);

  const state = params.get('state');
  if (state === null || state !== expectedState) {
    throw new AppError('auth_state_mismatch', { provider: PROVIDER });
  }

  const accessToken = params.get('access_token');
  if (accessToken === null || accessToken === '') {
    throw new AppError('auth_generic', { provider: PROVIDER });
  }

  const expiresIn = Number.parseInt(params.get('expires_in') ?? '', 10);
  const scope = params.get('scope');

  return {
    accessToken,
    expiresAt: Date.now() + (Number.isFinite(expiresIn) ? expiresIn : 3600) * 1000,
    scopes: (scope ?? SCOPE_STRING).split(' ').filter((entry) => entry !== ''),
  };
}

export async function completeAuthorization(params: URLSearchParams): Promise<ProviderSession> {
  const record = takeAuthRequest(PROVIDER);

  // Erro do usuário volta como `#error=access_denied`: aquele destino falha, o
  // outro continua — por isso a falha carrega o provedor desde a origem.
  const errorCode = params.get('error');
  if (errorCode !== null) throw fromAuthorizeError(errorCode, PROVIDER);

  if (record === null) throw new AppError('auth_state_mismatch', { provider: PROVIDER });

  const tokens = readFragmentTokens(params, record.state);
  const user = await getChannelWithToken(tokens.accessToken);

  return {
    provider: PROVIDER,
    accessToken: tokens.accessToken,
    // Ausência de renovação silenciosa é dado, não erro (invariante S1).
    refreshToken: null,
    expiresAt: tokens.expiresAt,
    scopes: tokens.scopes,
    user,
  };
}
