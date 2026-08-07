/**
 * Handlers MSW dos 13 pontos de contato dos dois provedores — 8 de
 * `001/contracts/spotify-api.md` e 5 de `002/contracts/youtube-api.md`.
 *
 * O contrato é executável: cada entrada dos documentos tem um handler aqui, e
 * `tests/setup.ts` roda com `onUnhandledRequest: 'error'` — qualquer requisição
 * para fora desta lista quebra o teste em vez de vazar (Princípio II).
 *
 * Os testes dirigem o mock por quatro alavancas:
 * - `setCatalog(...)` / `setYouTubeCatalog(...)`: o que a busca encontra;
 * - `setPlaylists(...)` / `setYouTubePlaylists(...)`: o que a listagem devolve
 *   (com paginação real nos dois provedores);
 * - `program(endpoint, ...respostas)`: fila de respostas anômalas (401, 403 com
 *   `reason`, 429, 5xx);
 * - `programBelowFloor(endpoint, vezes)`: a busca responde `200` com candidatas
 *   **irrelevantes** — resultado utilizável nenhum, mas lista não vazia. É o
 *   gatilho de retentativa de `003/FR-009` que "zero resultados" não exercita.
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

export interface MockVideo {
  id: string;
  title: string;
  channel: string;
  /** ISO-8601, como `contentDetails.duration` (`PT3M52S`). */
  duration: string;
}

export interface MockYouTubePlaylist {
  id: string;
  title: string;
}

export type EndpointKey =
  | 'token'
  | 'me'
  | 'myPlaylists'
  | 'search'
  | 'createPlaylist'
  | 'addTracks'
  | 'ytChannels'
  | 'ytSearch'
  | 'ytVideos'
  | 'ytPlaylists'
  | 'ytCreatePlaylist'
  | 'ytPlaylistItems';

export interface ProgrammedResponse {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface RecordedRequest {
  endpoint: EndpointKey | 'authorize' | 'image' | 'ytImage';
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | null;
}

// ---------------------------------------------------------------------------
// Estado dirigível pelos testes
// ---------------------------------------------------------------------------

export const DEFAULT_USER = { id: 'usuario_teste', display_name: 'Fulano de Teste' };

export const DEFAULT_YOUTUBE_CHANNEL = { id: 'UC_teste', title: 'Canal de Teste' };

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

  // --- YouTube -------------------------------------------------------------
  ytChannel: { ...DEFAULT_YOUTUBE_CHANNEL },
  ytCatalog: [] as MockVideo[],
  ytPlaylists: [] as MockYouTubePlaylist[],
  ytCreatedPlaylists: new Map<string, { title: string; videoIds: string[]; privacy: string }>(),
  ytPageSize: 50,
  ytAccessToken: 'ya29.token-1',
};

const queues = new Map<EndpointKey, ProgrammedResponse[]>();

/** Endpoints que respondem `401` indefinidamente — ver `alwaysUnauthorized`. */
const unauthorizedForever = new Set<EndpointKey>();

/** Quantas respostas ainda saem só com ruído, por endpoint de busca. */
const belowFloor = new Map<'search' | 'ytSearch', number>();

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
  state.ytChannel = { ...DEFAULT_YOUTUBE_CHANNEL };
  state.ytCatalog = [];
  state.ytPlaylists = [];
  state.ytCreatedPlaylists = new Map();
  state.ytPageSize = 50;
  state.ytAccessToken = 'ya29.token-1';
  queues.clear();
  unauthorizedForever.clear();
  belowFloor.clear();
  requestLog.length = 0;
}

/**
 * Faixas e vídeos deliberadamente irrelevantes: nenhum termo em comum com o
 * catálogo de referência, e por isso pontuação bem abaixo do piso `uncertain`
 * (0,55) contra qualquer linha real.
 */
const NOISE_TRACKS: MockTrack[] = [
  { id: 'ruido_1', name: 'Zzyzx Prelúdio Nulo', artists: ['Ruído Alfa'], album: 'Nada', durationMs: 111_000 },
  { id: 'ruido_2', name: 'Kkrrt Interlúdio Vazio', artists: ['Ruído Beta'], album: 'Nada', durationMs: 122_000 },
];

const NOISE_VIDEOS: MockVideo[] = [
  { id: 'vid_ruido_1', title: 'Zzyzx Prelúdio Nulo', channel: 'Ruído Alfa', duration: 'PT1M51S' },
  { id: 'vid_ruido_2', title: 'Kkrrt Interlúdio Vazio', channel: 'Ruído Beta', duration: 'PT2M2S' },
];

/**
 * As próximas `times` buscas naquele endpoint devolvem **só ruído**: `200` com
 * lista não vazia e nada acima do piso. Distingue-se de "zero resultados"
 * justamente porque o gatilho de FR-009 é "nenhuma candidata utilizável", não
 * "nenhuma candidata".
 */
export function programBelowFloor(endpoint: 'search' | 'ytSearch', times = 1): void {
  belowFloor.set(endpoint, (belowFloor.get(endpoint) ?? 0) + Math.max(0, times));
}

function takeBelowFloor(endpoint: 'search' | 'ytSearch'): boolean {
  const remaining = belowFloor.get(endpoint) ?? 0;
  if (remaining <= 0) return false;
  belowFloor.set(endpoint, remaining - 1);
  return true;
}

export function setYouTubeCatalog(videos: MockVideo[]): void {
  state.ytCatalog = videos;
}

export function setYouTubePlaylists(playlists: MockYouTubePlaylist[], pageSize = 50): void {
  state.ytPlaylists = playlists;
  state.ytPageSize = pageSize;
}

export function setYouTubeChannel(channel: { id: string; title: string }): void {
  state.ytChannel = channel;
}

export function createdYouTubePlaylist(
  id: string,
): { title: string; videoIds: string[]; privacy: string } | undefined {
  return state.ytCreatedPlaylists.get(id);
}

/**
 * Registra uma playlist como **já criada**, sem passar pelo endpoint de criação.
 *
 * É o que permite montar o cenário de `004/US2`: a execução foi interrompida com
 * uma playlist parcial na conta, e a retomada precisa partir dela. Sem isto, o
 * primeiro `playlistItems.insert` responderia `playlistNotFound` e o teste
 * mediria um 404 em vez da retomada.
 */
export function seedCreatedYouTubePlaylist(
  id: string,
  title: string,
  videoIds: string[] = [],
): void {
  state.ytCreatedPlaylists.set(id, { title, videoIds: [...videoIds], privacy: 'private' });
  state.ytPlaylists.push({ id, title });
}

/** Equivalente do Spotify, pelo mesmo motivo. */
export function seedCreatedPlaylist(id: string, name: string, uris: string[] = []): void {
  state.createdPlaylists.set(id, { name, uris: [...uris] });
  state.playlists.push({ id, name, ownerId: state.user.id });
}

export function currentYouTubeAccessToken(): string {
  return state.ytAccessToken;
}

/** Requisições registradas para um endpoint — base da contagem de SC-009. */
export function requestsTo(endpoint: RecordedRequest['endpoint']): RecordedRequest[] {
  return requestLog.filter((entry) => entry.endpoint === endpoint);
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

/** Endpoints do catálogo de vídeo — o corpo de erro tem outra forma. */
function isYouTubeEndpoint(endpoint: EndpointKey): boolean {
  return endpoint.startsWith('yt');
}

/**
 * Enfileira `times` respostas `401` no endpoint, já na forma do provedor a que
 * ele pertence (`004/T002`).
 *
 * Existe porque a perda de autorização é o gatilho da feature de reconexão e
 * precisa ser programável em **volume**: uma lista de 100 linhas exige 100
 * respostas de credencial inválida na busca para provar que sai **uma**
 * interrupção, e não cem. Nenhum host novo entra por aqui — são os mesmos
 * endpoints já declarados (N1).
 */
export function programUnauthorized(endpoint: EndpointKey, times = 1): void {
  const build = isYouTubeEndpoint(endpoint) ? YT_RESPONSES.unauthorized : RESPONSES.unauthorized;
  const responses: ProgrammedResponse[] = [];
  for (let i = 0; i < Math.max(0, times); i += 1) responses.push(build());
  program(endpoint, ...responses);
}

/**
 * Todas as chamadas seguintes àquele endpoint respondem `401`, sem fila a
 * esgotar. É o caso "a sessão morreu" — que não tem contagem, ao contrário de
 * `programUnauthorized`, feito para o cenário de N linhas.
 */
export function alwaysUnauthorized(...endpoints: EndpointKey[]): void {
  for (const endpoint of endpoints) unauthorizedForever.add(endpoint);
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

/**
 * Anomalias do YouTube. Os `403` diferem **apenas** pelo
 * `error.errors[0].reason` e exigem comportamentos opostos — cota encerra sem
 * repetir, limitação de taxa repete com backoff (contracts/youtube-api.md §8).
 */
function youTubeError(status: number, reason: string, message: string): ProgrammedResponse {
  return {
    status,
    body: {
      error: {
        code: status,
        message,
        errors: [{ domain: 'youtube.quota', reason, message }],
      },
    },
  };
}

export const YT_RESPONSES = {
  unauthorized: (): ProgrammedResponse =>
    youTubeError(401, 'authError', 'Invalid Credentials'),
  quotaExceeded: (): ProgrammedResponse =>
    youTubeError(403, 'quotaExceeded', 'The request cannot be completed because you have exceeded your quota.'),
  dailyLimitExceeded: (): ProgrammedResponse =>
    youTubeError(403, 'dailyLimitExceeded', 'Daily Limit Exceeded'),
  rateLimitExceeded: (): ProgrammedResponse =>
    youTubeError(403, 'rateLimitExceeded', 'Rate Limit Exceeded'),
  userRateLimitExceeded: (): ProgrammedResponse =>
    youTubeError(403, 'userRateLimitExceeded', 'User Rate Limit Exceeded'),
  insufficientPermissions: (): ProgrammedResponse =>
    youTubeError(403, 'insufficientPermissions', 'Request had insufficient authentication scopes.'),
  forbidden: (): ProgrammedResponse => youTubeError(403, 'forbidden', 'Forbidden'),
  videoNotFound: (): ProgrammedResponse => youTubeError(404, 'videoNotFound', 'Video not found'),
  serverError: (): ProgrammedResponse => ({
    status: 503,
    body: { error: { code: 503, message: 'Backend Error', errors: [{ reason: 'backendError' }] } },
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
  if (unauthorizedForever.has(endpoint)) {
    return isYouTubeEndpoint(endpoint) ? YT_RESPONSES.unauthorized() : RESPONSES.unauthorized();
  }
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

/** Reintroduz as entidades HTML que `search.list` sempre devolve (contrato §3). */
function escapeEntities(text: string): string {
  return text.replace(/&/gu, '&amp;').replace(/'/gu, '&#39;').replace(/"/gu, '&quot;');
}

/**
 * Busca de texto livre no catálogo de vídeo: sem qualificadores de campo, é
 * assim que `search.list` se comporta (research §7). A consulta casa quando
 * **todos** os termos aparecem no título ou no canal.
 */
function matchVideos(query: string, limit: number): MockVideo[] {
  const terms = normalize(query).split(/\s+/u).filter((term) => term !== '');
  if (terms.length === 0) return [];

  return state.ytCatalog
    .filter((video) => {
      const haystack = `${normalize(video.title)} ${normalize(video.channel)}`;
      return terms.every((term) => haystack.includes(term));
    })
    .slice(0, limit);
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
    const items = takeBelowFloor('search')
      ? NOISE_TRACKS.slice(0, limit).map(toTrackObject)
      : matchCatalog(query, limit);

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

  // Capas de álbum — único host de imagem autorizado do Spotify.
  http.get('https://i.scdn.co/image/*', async ({ request }) => {
    await record('image', request);
    return new HttpResponse(null, { status: 200, headers: { 'Content-Type': 'image/jpeg' } });
  }),

  // -------------------------------------------------------------------------
  // YouTube Data API v3 — contracts/youtube-api.md
  // -------------------------------------------------------------------------

  // §2 Identificação da conta (custo 1)
  http.get('https://www.googleapis.com/youtube/v3/channels', async ({ request }) => {
    await record('ytChannels', request);
    const programmed = takeProgrammed('ytChannels');
    if (programmed !== undefined) return respondProgrammed(programmed);

    return HttpResponse.json({
      items: [{ id: state.ytChannel.id, snippet: { title: state.ytChannel.title } }],
    });
  }),

  // §3 Buscar candidatos (custo 100)
  http.get('https://www.googleapis.com/youtube/v3/search', async ({ request }) => {
    await record('ytSearch', request);
    const programmed = takeProgrammed('ytSearch');
    if (programmed !== undefined) return respondProgrammed(programmed);

    const url = new URL(request.url);
    const query = url.searchParams.get('q') ?? '';
    const maxResults = Number.parseInt(url.searchParams.get('maxResults') ?? '5', 10);
    const found = takeBelowFloor('ytSearch')
      ? NOISE_VIDEOS.slice(0, maxResults)
      : matchVideos(query, maxResults);
    const items = found.map((video) => ({
      id: { kind: 'youtube#video', videoId: video.id },
      snippet: {
        // A API devolve o título com entidades HTML — decodificá-lo é obrigação
        // do adaptador (contrato §3).
        title: escapeEntities(video.title),
        channelTitle: video.channel,
        thumbnails: { default: { url: `https://i.ytimg.com/vi/${video.id}/default.jpg` } },
      },
    }));

    return HttpResponse.json({ items, pageInfo: { totalResults: items.length } });
  }),

  // §4 Enriquecer com duração e canal (custo 1 por chamada, até 50 ids)
  http.get('https://www.googleapis.com/youtube/v3/videos', async ({ request }) => {
    await record('ytVideos', request);
    const programmed = takeProgrammed('ytVideos');
    if (programmed !== undefined) return respondProgrammed(programmed);

    const url = new URL(request.url);
    const ids = (url.searchParams.get('id') ?? '').split(',').filter((id) => id !== '');
    if (ids.length > 50) {
      return respondProgrammed(YT_RESPONSES.forbidden());
    }

    const items = ids
      .map(
        (id) =>
          state.ytCatalog.find((video) => video.id === id) ??
          NOISE_VIDEOS.find((video) => video.id === id),
      )
      .filter((video): video is MockVideo => video !== undefined)
      .map((video) => ({
        id: video.id,
        snippet: {
          title: escapeEntities(video.title),
          channelTitle: video.channel,
          thumbnails: { default: { url: `https://i.ytimg.com/vi/${video.id}/default.jpg` } },
        },
        contentDetails: { duration: video.duration },
      }));

    return HttpResponse.json({ items });
  }),

  // §5 Listar playlists do usuário (custo 1 por página, paginado)
  http.get('https://www.googleapis.com/youtube/v3/playlists', async ({ request }) => {
    await record('ytPlaylists', request);
    const programmed = takeProgrammed('ytPlaylists');
    if (programmed !== undefined) return respondProgrammed(programmed);

    const url = new URL(request.url);
    const limit = Number.parseInt(url.searchParams.get('maxResults') ?? '50', 10);
    const pageSize = Math.min(limit, state.ytPageSize);
    const offset = Number.parseInt(url.searchParams.get('pageToken') ?? '0', 10);
    const slice = state.ytPlaylists.slice(offset, offset + pageSize);
    const nextOffset = offset + pageSize;

    return HttpResponse.json({
      items: slice.map((playlist) => ({ id: playlist.id, snippet: { title: playlist.title } })),
      pageInfo: { totalResults: state.ytPlaylists.length, resultsPerPage: pageSize },
      ...(nextOffset < state.ytPlaylists.length ? { nextPageToken: String(nextOffset) } : {}),
    });
  }),

  // §6 Criar playlist (custo 50)
  http.post('https://www.googleapis.com/youtube/v3/playlists', async ({ request }) => {
    await record('ytCreatePlaylist', request);
    const programmed = takeProgrammed('ytCreatePlaylist');
    if (programmed !== undefined) return respondProgrammed(programmed);

    const body = (await request.json()) as {
      snippet?: { title?: string; description?: string };
      status?: { privacyStatus?: string };
    };
    const id = `PL_teste_${state.ytCreatedPlaylists.size + 1}`;
    const title = body.snippet?.title ?? '';
    state.ytCreatedPlaylists.set(id, {
      title,
      videoIds: [],
      privacy: body.status?.privacyStatus ?? 'private',
    });
    state.ytPlaylists.push({ id, title });

    return HttpResponse.json({ id, snippet: { title }, status: body.status }, { status: 200 });
  }),

  // §7 Adicionar **um** vídeo (custo 50) — não existe endpoint de lote
  http.post('https://www.googleapis.com/youtube/v3/playlistItems', async ({ request }) => {
    await record('ytPlaylistItems', request);
    const programmed = takeProgrammed('ytPlaylistItems');
    if (programmed !== undefined) return respondProgrammed(programmed);

    const body = (await request.json()) as {
      snippet?: { playlistId?: string; resourceId?: { videoId?: string } };
    };
    const playlistId = body.snippet?.playlistId ?? '';
    const videoId = body.snippet?.resourceId?.videoId ?? '';

    const playlist = state.ytCreatedPlaylists.get(playlistId);
    if (playlist === undefined) {
      return respondProgrammed(youTubeError(404, 'playlistNotFound', 'Playlist not found'));
    }
    playlist.videoIds.push(videoId);

    return HttpResponse.json({
      id: `PLI_${playlist.videoIds.length}`,
      snippet: { playlistId, position: playlist.videoIds.length - 1, resourceId: { videoId } },
    });
  }),

  // Miniaturas — único host de imagem autorizado do YouTube.
  http.get('https://i.ytimg.com/vi/*', async ({ request }) => {
    await record('ytImage', request);
    return new HttpResponse(null, { status: 200, headers: { 'Content-Type': 'image/jpeg' } });
  }),
];
