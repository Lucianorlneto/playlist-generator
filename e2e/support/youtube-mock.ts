import type { Page, Route } from '@playwright/test';

/**
 * YouTube simulado para os testes de ponta a ponta.
 *
 * Nenhum teste toca a rede real. As rotas cobrem exatamente os endpoints de
 * `contracts/youtube-api.md`. O consentimento é resolvido devolvendo um `302`
 * para o `redirect_uri` com o token **no fragmento** — que é a diferença de
 * forma em relação ao Spotify, e o que exercita a leitura e a limpeza do
 * fragmento no retorno.
 */

export const YT_CLIENT_ID = '123-abc.apps.googleusercontent.com';
export const YT_CHANNEL_NAME = 'Canal de Teste';
export const YT_CHANNEL_ID = 'UC_teste';

/** Uma faixa do catálogo simulado. O canal oficial é derivado do artista. */
export interface YouTubeTrack {
  title: string;
  artist: string;
}

export interface YouTubeMockOptions {
  /** Playlists já existentes na conta, para a checagem de nome duplicado. */
  existingPlaylists?: { id: string; title: string }[];
  /**
   * Catálogo que a busca conhece. Sem ele nenhuma consulta encontra nada — é o
   * que torna o mock fiel: a busca do YouTube é texto livre, e a única forma de
   * devolver um canal plausível (`{artista} - Topic`) é saber quem é o artista.
   */
  tracks?: YouTubeTrack[];
  /** Títulos que a busca deve tratar como inexistentes. */
  missingTitles?: string[];
  /** Devolve `403 quotaExceeded` a partir desta inserção (base 0). */
  quotaExceededFromItem?: number;
}

/** Converte a mesma lista que o teste digita em catálogo de busca. */
export function catalogoDe(lista: string): YouTubeTrack[] {
  return lista
    .split(/\r?\n/u)
    .map((linha) => linha.trim())
    .filter((linha) => linha !== '')
    .map((linha) => {
      const separado = /^(.*?)\s+(?:-|–|—|by)\s+(.*)$/u.exec(linha);
      return separado === null
        ? { title: linha, artist: '' }
        : { title: separado[1]!.trim(), artist: separado[2]!.trim() };
    });
}

/** Comparação tolerante a acento, caixa e pontuação — como a busca real é. */
function normalizar(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim();
}

export interface YouTubeMockState {
  addedVideoIds: string[];
  createdPlaylistId: string | null;
  createdPrivacy: string | null;
  searchCount: number;
}

function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '');
}

function quotaError() {
  return {
    error: {
      code: 403,
      message: 'The request cannot be completed because you have exceeded your quota.',
      errors: [{ domain: 'youtube.quota', reason: 'quotaExceeded' }],
    },
  };
}

export async function mockYouTube(
  page: Page,
  options: YouTubeMockOptions = {},
): Promise<YouTubeMockState> {
  const state: YouTubeMockState = {
    addedVideoIds: [],
    createdPlaylistId: null,
    createdPrivacy: null,
    searchCount: 0,
  };
  const existing = options.existingPlaylists ?? [];
  const tracks = options.tracks ?? [];
  const missing = new Set((options.missingTitles ?? []).map(normalizar));

  /**
   * Índice do que a busca já devolveu, consultado por `videos.list`.
   *
   * O enriquecimento **reescreve** título e canal da candidata: um mock que não
   * devolvesse ali o mesmo dado da busca destruiria a pontuação e faria a
   * revisão exibir algo que a busca nunca encontrou.
   */
  const porVideoId = new Map<string, { title: string; channelTitle: string }>();

  // §2 Autorização — implicit flow: o token volta no **fragmento**.
  await page.route('https://accounts.google.com/o/oauth2/v2/auth*', async (route: Route) => {
    const url = new URL(route.request().url());
    const redirectUri = url.searchParams.get('redirect_uri') ?? '/';
    const authState = url.searchParams.get('state') ?? '';
    const fragment = new URLSearchParams({
      access_token: 'ya29.token-de-teste',
      token_type: 'Bearer',
      expires_in: '3599',
      scope: 'https://www.googleapis.com/auth/youtube',
      state: authState,
    });
    await route.fulfill({
      status: 302,
      headers: { location: `${redirectUri}#${fragment.toString()}` },
    });
  });

  // §2 Identificação da conta
  await page.route('https://www.googleapis.com/youtube/v3/channels*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [{ id: YT_CHANNEL_ID, snippet: { title: YT_CHANNEL_NAME } }],
      }),
    });
  });

  // §3 Busca de vídeos
  await page.route('https://www.googleapis.com/youtube/v3/search*', async (route: Route) => {
    state.searchCount += 1;
    const query = normalizar(new URL(route.request().url()).searchParams.get('q') ?? '');

    // A consulta é livre: `"{título} {artista}"` e, no fallback, só o título.
    const faixa =
      tracks.find((track) => normalizar(`${track.title} ${track.artist}`) === query) ??
      tracks.find((track) => normalizar(track.title) === query) ??
      null;
    const ausente = faixa === null || missing.has(normalizar(faixa.title));

    if (ausente) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] }),
      });
      return;
    }

    const videoId = `vid-${slug(faixa.title)}`;
    const title = `${faixa.title} (Official Music Video)`;
    const channelTitle = faixa.artist === '' ? 'Canal de Música' : `${faixa.artist} - Topic`;
    porVideoId.set(videoId, { title, channelTitle });

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: { kind: 'youtube#video', videoId },
            snippet: {
              title,
              channelTitle,
              thumbnails: { default: { url: `https://i.ytimg.com/vi/${videoId}/default.jpg` } },
            },
          },
        ],
      }),
    });
  });

  // §4 Enriquecimento com duração e canal
  await page.route('https://www.googleapis.com/youtube/v3/videos*', async (route: Route) => {
    const ids = (new URL(route.request().url()).searchParams.get('id') ?? '')
      .split(',')
      .filter((id) => id !== '');

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: ids.map((id) => {
          const conhecido = porVideoId.get(id);
          return {
            id,
            snippet: {
              title: conhecido?.title ?? id,
              channelTitle: conhecido?.channelTitle ?? 'Canal de Música',
              thumbnails: { default: { url: `https://i.ytimg.com/vi/${id}/default.jpg` } },
            },
            contentDetails: { duration: 'PT3M52S' },
          };
        }),
      }),
    });
  });

  // §5, §6 Listar e criar playlists — mesma URL, distinguidas pelo método.
  await page.route('https://www.googleapis.com/youtube/v3/playlists*', async (route: Route) => {
    if (route.request().method() === 'POST') {
      const body = JSON.parse(route.request().postData() ?? '{}') as {
        snippet?: { title?: string };
        status?: { privacyStatus?: string };
      };
      state.createdPlaylistId = `PL_teste_1`;
      state.createdPrivacy = body.status?.privacyStatus ?? null;

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: state.createdPlaylistId,
          snippet: { title: body.snippet?.title ?? '' },
          status: body.status,
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: existing.map((playlist) => ({
          id: playlist.id,
          snippet: { title: playlist.title },
        })),
        pageInfo: { totalResults: existing.length, resultsPerPage: 50 },
      }),
    });
  });

  // §7 Adicionar **um** vídeo por requisição
  await page.route('https://www.googleapis.com/youtube/v3/playlistItems*', async (route: Route) => {
    const limite = options.quotaExceededFromItem;
    if (limite !== undefined && state.addedVideoIds.length >= limite) {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify(quotaError()),
      });
      return;
    }

    const body = JSON.parse(route.request().postData() ?? '{}') as {
      snippet?: { resourceId?: { videoId?: string } };
    };
    const videoId = body.snippet?.resourceId?.videoId ?? '';
    state.addedVideoIds.push(videoId);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: `PLI_${state.addedVideoIds.length}` }),
    });
  });

  // Miniaturas
  await page.route('https://i.ytimg.com/**', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'image/jpeg', body: '' });
  });

  return state;
}
