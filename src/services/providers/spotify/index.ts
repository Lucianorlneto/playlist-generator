/**
 * Adaptador do Spotify — a implementação de `PlaylistProvider` para o catálogo
 * de faixas.
 *
 * Não há `estimate` nem `recordConsumption`: o Spotify não impõe orçamento
 * diário, e `capabilities.quota === null` é o que a orquestração consulta para
 * pular a fase de estimativa sem deixar rastro na interface (research §12).
 */

import { capabilitiesOf } from '@/domain/providers';
import type { InputLine, MatchItem, ProviderSession } from '@/domain/types';
import { t } from '@/i18n/pt-BR';
import { AppError, fromAuthorizeError } from '@/services/providers/errors';
import { runProviderSearch } from '@/services/providers/searchRunner';
import type { CallbackParams, CreateParams, PlaylistProvider } from '@/services/providers/types';
import { takeAuthRequest } from '@/services/storage/authRequestRepo';

import { buildAuthorizeUrl, buildSession, exchangeCode, refreshSession } from './auth';
import { addTracks, createPlaylist, listMyPlaylistNames } from './playlists';
import { getProfileWithToken } from './profile';
import { searchTrack } from './search';

const PROVIDER = 'spotify' as const;

/**
 * Retorno pela **query string** (`?code=…&state=…`): é o que distingue o fluxo
 * de código do implicit flow, que devolve no fragmento.
 */
async function completeAuthorization(params: CallbackParams): Promise<ProviderSession> {
  const code = params.params.get('code');
  const errorCode = params.params.get('error');
  const state = params.params.get('state');

  const record = takeAuthRequest(PROVIDER);

  if (errorCode !== null) throw fromAuthorizeError(errorCode, PROVIDER);
  if (code === null) throw new AppError('auth_generic', { provider: PROVIDER });
  if (
    record === null ||
    record.codeVerifier === undefined ||
    state === null ||
    state !== record.state
  ) {
    throw new AppError('auth_state_mismatch', { provider: PROVIDER });
  }

  const tokens = await exchangeCode({
    clientId: params.clientId,
    code,
    redirectUri: params.redirectUri,
    codeVerifier: record.codeVerifier,
  });
  const user = await getProfileWithToken(tokens.accessToken);
  return buildSession(tokens, user);
}

export const spotifyProvider: PlaylistProvider = {
  id: PROVIDER,
  capabilities: capabilitiesOf(PROVIDER),

  setup: {
    // Link **exibido** ao usuário, nunca destino de requisição (research §14).
    consoleUrl: 'https://developer.spotify.com/dashboard',
    instructionsKey: 'providers.spotify',
    needsJavaScriptOrigin: false,
  },

  buildAuthorizeUrl,
  completeAuthorization,
  refresh: refreshSession,

  search: (lines: InputLine[], ctx): Promise<MatchItem[]> =>
    runProviderSearch(lines, ctx, { provider: PROVIDER, searchLine: searchTrack }),

  listPlaylistNames: (session, signal) => listMyPlaylistNames(session.user.id, signal),

  createPlaylist: (params: CreateParams) =>
    createPlaylist({
      userId: params.session.user.id,
      name: params.name,
      description: params.description,
      isPublic: params.isPublic,
      ...(params.signal === undefined ? {} : { signal: params.signal }),
    }),

  addItems: addTracks,

  effectivePath: (displayName, playlistName) =>
    `${t.providers.spotify.libraryRoot} / ${displayName} / ${playlistName}`,
};
