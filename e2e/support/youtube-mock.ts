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

export interface YouTubeMockOptions {
  /** Playlists já existentes na conta, para a checagem de nome duplicado. */
  existingPlaylists?: { id: string; title: string }[];
  /** Títulos que a busca deve tratar como inexistentes. */
  missingTitles?: string[];
  /** Devolve `403 quotaExceeded` a partir desta inserção (base 0). */
  quotaExceededFromItem?: number;
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
  const missing = new Set((options.missingTitles ?? []).map((title) => title.toLowerCase()));

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
    const query = new URL(route.request().url()).searchParams.get('q') ?? '';
    const isMissing = [...missing].some((title) => query.toLowerCase().includes(title));

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: isMissing
          ? []
          : [
              {
                id: { kind: 'youtube#video', videoId: `vid-${slug(query)}` },
                snippet: {
                  title: `${query} (Official Music Video)`,
                  channelTitle: `${query.split(' ').slice(-1).join('')} - Topic`,
                  thumbnails: { default: { url: `https://i.ytimg.com/vi/x/default.jpg` } },
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
        items: ids.map((id) => ({
          id,
          snippet: {
            title: `${id} (Official Music Video)`,
            channelTitle: 'Canal - Topic',
            thumbnails: { default: { url: `https://i.ytimg.com/vi/${id}/default.jpg` } },
          },
          contentDetails: { duration: 'PT3M52S' },
        })),
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
