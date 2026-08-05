/**
 * Handlers MSW dos 8 pontos de contato de contracts/spotify-api.md.
 *
 * O contrato é executável: cada entrada do documento tem um handler aqui, e
 * `tests/setup.ts` roda com `onUnhandledRequest: 'error'` — qualquer requisição
 * para fora desta lista quebra o teste em vez de vazar (FR-010).
 *
 * Os testes dirigem o mock por três alavancas:
 * - `setCatalog(...)`: o que a busca encontra;
 * - `setPlaylists(...)`: o que `/v1/me/playlists` devolve (com paginação real);
 * - `program(endpoint, ...respostas)`: fila de respostas anômalas (401, 429, 5xx).
 */

import { http, HttpResponse, type HttpHandler } from 'msw';

// ---------------------------------------------------------------------------
// Tipos do catálogo simulado
// ---------------------------------------------------------------------------

export interface MockTrack {
  id: string;
  name: string;
  artists: string[];
  album: string;
  durationMs: number;
  coverUrl?: string | null;
}

export interface MockPlaylist {
  id: string;
  name: string;
  ownerId: string;
}

export type EndpointKey =
  'token' | 'me' | 'myPlaylists' | 'search' | 'createPlaylist' | 'addTracks';

export interface ProgrammedResponse {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface RecordedRequest {
  endpoint: EndpointKey | 'authorize' | 'image';
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | null;
}

// ---------------------------------------------------------------------------
// Estado dirigível pelos testes
// ---------------------------------------------------------------------------

export const DEFAULT_USER = { id: 'usuario_teste', display_name: 'Fulano de Teste' };

const state = {
  user: { ...DEFAULT_USER } as { id: string; display_name: string | null },
  catalog: [] as MockTrack[],
  playlists: [] as MockPlaylist[],
  createdPlaylists: new Map<string, { name: string; uris: string[] }>(),
  accessToken: 'access-token-1',
  refreshToken: 'refresh-token-1',
  /** `false` faz a renovação responder `400 invalid_grant`. */
  refreshWorks: true,
  /** `null` faz a resposta de renovação omitir o `refresh_token` (research §1). */
  rotatedRefreshToken: null as string | null,
  expiresIn: 3600,
  pageSize: 50,
};

const queues = new Map<EndpointKey, ProgrammedResponse[]>();

export const requestLog: RecordedRequest[] = [];

export function resetMockSpotify(): void {
  state.user = { ...DEFAULT_USER };
  state.catalog = [];
  state.playlists = [];
  state.createdPlaylists = new Map();
  state.accessToken = 'access-token-1';
  state.refreshToken = 'refresh-token-1';
  state.refreshWorks = true;
  state.rotatedRefreshToken = null;
  state.expiresIn = 3600;
  state.pageSize = 50;
  queues.clear();
  requestLog.length = 0;
}

export function setCatalog(tracks: MockTrack[]): void {
  state.catalog = tracks;
}

export function setPlaylists(playlists: MockPlaylist[], pageSize = 50): void {
  state.playlists = playlists;
  state.pageSize = pageSize;
}

export function setUser(user: { id: string; display_name: string | null }): void {
  state.user = user;
}

export function setRefreshBehaviour(options: {
  works?: boolean;
  rotatedRefreshToken?: string | null;
  accessToken?: string;
  expiresIn?: number;
}): void {
  if (options.works !== undefined) state.refreshWorks = options.works;
  if (options.rotatedRefreshToken !== undefined) {
    state.rotatedRefreshToken = options.rotatedRefreshToken;
  }
  if (options.accessToken !== undefined) state.accessToken = options.accessToken;
  if (options.expiresIn !== undefined) state.expiresIn = options.expiresIn;
}

/** Enfileira respostas anômalas para as próximas chamadas de um endpoint. */
export function program(endpoint: EndpointKey, ...responses: ProgrammedResponse[]): void {
  const queue = queues.get(endpoint) ?? [];
  queue.push(...responses);
  queues.set(endpoint, queue);
}

export function createdPlaylist(id: string): { name: string; uris: string[] } | undefined {
  return state.createdPlaylists.get(id);
}

export function currentAccessToken(): string {
  return state.accessToken;
}

/** Marcador de fila: consome uma chamada deixando o handler normal responder. */
export const PASS_THROUGH: ProgrammedResponse = { status: 0 };

// Atalhos para as anomalias mais usadas nos testes.
export const RESPONSES = {
  unauthorized: (): ProgrammedResponse => ({
    status: 401,
    body: { error: { status: 401, message: 'The access token expired' } },
  }),
  rateLimited: (retryAfterSeconds?: number): ProgrammedResponse => ({
    status: 429,
    body: { error: { status: 429, message: 'API rate limit exceeded' } },
    ...(retryAfterSeconds === undefined
      ? {}
      : { headers: { 'Retry-After': String(retryAfterSeconds) } }),
  }),
  serverError: (): ProgrammedResponse => ({
    status: 503,
    body: { error: { status: 503, message: 'Service unavailable' } },
  }),
} as const;

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/**
 * Consome uma resposta anômala da fila. `PASS_THROUGH` gasta uma posição da fila
 * mas deixa o handler normal responder — é como se programa "a primeira chamada
 * passa, a segunda falha".
 */
function takeProgrammed(endpoint: EndpointKey): ProgrammedResponse | undefined {
  const queue = queues.get(endpoint);
  if (queue === undefined || queue.length === 0) return undefined;
  const next = queue.shift();
  return next === undefined || next.status <= 0 ? undefined : next;
}

function respondProgrammed(programmed: ProgrammedResponse) {
  return HttpResponse.json(programmed.body ?? {}, {
    status: programmed.status,
    ...(programmed.headers === undefined ? {} : { headers: programmed.headers }),
  });
}

async function record(endpoint: RecordedRequest['endpoint'], request: Request): Promise<void> {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  let body: string | null = null;
  if (request.method !== 'GET') {
    body = await request.clone().text();
  }
  requestLog.push({ endpoint, method: request.method, url: request.url, headers, body });
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function toTrackObject(track: MockTrack) {
  const cover =
    track.coverUrl === undefined ? `https://i.scdn.co/image/${track.id}` : track.coverUrl;
  return {
    uri: `spotify:track:${track.id}`,
    id: track.id,
    name: track.name,
    artists: track.artists.map((name) => ({ name })),
    album: {
      name: track.album,
      images:
        cover === null
          ? []
          : [
              { url: cover, width: 640, height: 640 },
              { url: cover, width: 64, height: 64 },
            ],
    },
    duration_ms: track.durationMs,
    external_urls: { spotify: `https://open.spotify.com/track/${track.id}` },
  };
}

/** Interpreta `track:"…" artist:"…"` ou texto livre, como o contrato §6 descreve. */
function matchCatalog(query: string, limit: number) {
  const fielded = /track:"([^"]*)"(?:\s+artist:"([^"]*)")?/.exec(query);
  const title = fielded === null ? query : (fielded[1] ?? '');
  const artist = fielded === null ? '' : (fielded[2] ?? '');

  const normalizedTitle = normalize(title);
  const normalizedArtist = normalize(artist);

  const matches = state.catalog.filter((track) => {
    const titleHit =
      normalizedTitle === '' ||
      normalize(track.name).includes(normalizedTitle) ||
      normalizedTitle.includes(normalize(track.name));
    if (!titleHit) return false;
    if (normalizedArtist === '') return true;
    return track.artists.some(
      (name) =>
        normalize(name).includes(normalizedArtist) || normalizedArtist.includes(normalize(name)),
    );
  });

  return matches.slice(0, limit).map(toTrackObject);
}

// ---------------------------------------------------------------------------
// Handlers — um por entrada do contrato
// ---------------------------------------------------------------------------

export const handlers: HttpHandler[] = [
  // §1 Autorização (navegação do navegador; presente para que nenhum teste a
  // alcance por engano sem ser notado).
  http.get('https://accounts.spotify.com/authorize', async ({ request }) => {
    await record('authorize', request);
    return new HttpResponse(null, { status: 302, headers: { Location: '/' } });
  }),

  // §2 e §3 Troca de código e renovação — mesma URL, distinguidas por grant_type.
  http.post('https://accounts.spotify.com/api/token', async ({ request }) => {
    await record('token', request);
    const programmed = takeProgrammed('token');
    if (programmed !== undefined) return respondProgrammed(programmed);

    const form = new URLSearchParams(await request.text());
    const grantType = form.get('grant_type');

    if (grantType === 'refresh_token') {
      if (!state.refreshWorks) {
        return HttpResponse.json(
          { error: 'invalid_grant', error_description: 'Refresh token revoked' },
          { status: 400 },
        );
      }
      return HttpResponse.json({
        access_token: state.accessToken,
        token_type: 'Bearer',
        expires_in: state.expiresIn,
        scope: 'playlist-modify-private playlist-modify-public playlist-read-private',
        ...(state.rotatedRefreshToken === null ? {} : { refresh_token: state.rotatedRefreshToken }),
      });
    }

    if (grantType === 'authorization_code') {
      if (form.get('code_verifier') === null || form.get('client_id') === null) {
        return HttpResponse.json({ error: 'invalid_request' }, { status: 400 });
      }
      return HttpResponse.json({
        access_token: state.accessToken,
        token_type: 'Bearer',
        expires_in: state.expiresIn,
        refresh_token: state.refreshToken,
        scope: 'playlist-modify-private playlist-modify-public playlist-read-private',
      });
    }

    return HttpResponse.json({ error: 'unsupported_grant_type' }, { status: 400 });
  }),

  // §4 Perfil
  http.get('https://api.spotify.com/v1/me', async ({ request }) => {
    await record('me', request);
    const programmed = takeProgrammed('me');
    if (programmed !== undefined) return respondProgrammed(programmed);
    return HttpResponse.json({ id: state.user.id, display_name: state.user.display_name });
  }),

  // §5 Playlists existentes, paginadas até `next === null`
  http.get('https://api.spotify.com/v1/me/playlists', async ({ request }) => {
    await record('myPlaylists', request);
    const programmed = takeProgrammed('myPlaylists');
    if (programmed !== undefined) return respondProgrammed(programmed);

    const url = new URL(request.url);
    const limit = Number.parseInt(url.searchParams.get('limit') ?? '50', 10);
    const offset = Number.parseInt(url.searchParams.get('offset') ?? '0', 10);
    const pageSize = Math.min(limit, state.pageSize);
    const slice = state.playlists.slice(offset, offset + pageSize);
    const nextOffset = offset + pageSize;
    const hasNext = nextOffset < state.playlists.length;

    return HttpResponse.json({
      items: slice.map((playlist) => ({
        id: playlist.id,
        name: playlist.name,
        owner: { id: playlist.ownerId },
      })),
      limit: pageSize,
      offset,
      total: state.playlists.length,
      next: hasNext
        ? `https://api.spotify.com/v1/me/playlists?limit=${pageSize}&offset=${nextOffset}`
        : null,
    });
  }),

  // §6 Busca
  http.get('https://api.spotify.com/v1/search', async ({ request }) => {
    await record('search', request);
    const programmed = takeProgrammed('search');
    if (programmed !== undefined) return respondProgrammed(programmed);

    const url = new URL(request.url);
    const query = url.searchParams.get('q') ?? '';
    const limit = Number.parseInt(url.searchParams.get('limit') ?? '5', 10);
    const items = matchCatalog(query, limit);

    return HttpResponse.json({
      tracks: { items, limit, offset: 0, total: items.length, next: null },
    });
  }),

  // §7 Criar playlist
  http.post('https://api.spotify.com/v1/users/:userId/playlists', async ({ request, params }) => {
    await record('createPlaylist', request);
    const programmed = takeProgrammed('createPlaylist');
    if (programmed !== undefined) return respondProgrammed(programmed);

    const body = (await request.json()) as { name: string; description?: string; public?: boolean };
    const id = `playlist-${state.createdPlaylists.size + 1}`;
    state.createdPlaylists.set(id, { name: body.name, uris: [] });
    state.playlists.push({ id, name: body.name, ownerId: String(params['userId']) });

    return HttpResponse.json(
      {
        id,
        name: body.name,
        external_urls: { spotify: `https://open.spotify.com/playlist/${id}` },
      },
      { status: 201 },
    );
  }),

  // §8 Adicionar faixas (máximo 100 URIs por requisição)
  http.post(
    'https://api.spotify.com/v1/playlists/:playlistId/tracks',
    async ({ request, params }) => {
      await record('addTracks', request);
      const programmed = takeProgrammed('addTracks');
      if (programmed !== undefined) return respondProgrammed(programmed);

      const body = (await request.json()) as { uris: string[] };
      if (body.uris.length > 100) {
        return HttpResponse.json(
          { error: { status: 400, message: 'Too many ids requested' } },
          { status: 400 },
        );
      }

      const playlist = state.createdPlaylists.get(String(params['playlistId']));
      if (playlist === undefined) {
        return HttpResponse.json(
          { error: { status: 404, message: 'Playlist not found' } },
          { status: 404 },
        );
      }
      playlist.uris.push(...body.uris);

      return HttpResponse.json(
        { snapshot_id: `snapshot-${playlist.uris.length}` },
        { status: 201 },
      );
    },
  ),

  // Capas de álbum — único host de imagem autorizado.
  http.get('https://i.scdn.co/image/*', async ({ request }) => {
    await record('image', request);
    return new HttpResponse(null, { status: 200, headers: { 'Content-Type': 'image/jpeg' } });
  }),
];
