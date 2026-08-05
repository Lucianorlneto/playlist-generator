import type { Page, Route } from '@playwright/test';

/**
 * Spotify simulado para os testes de ponta a ponta.
 *
 * Nenhum teste toca a rede real. As rotas cobrem exatamente os endpoints de
 * contracts/spotify-api.md; o consentimento é resolvido devolvendo um `302` para
 * o próprio `redirect_uri` com o `state` que a aplicação gerou, que é o que
 * exercita a validação de estado do retorno.
 */

export const CLIENT_ID = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
export const DISPLAY_NAME = 'Fulano de Teste';
export const USER_ID = 'usuario_teste';

export interface MockOptions {
  /** Playlists já existentes na conta, para a checagem de nome duplicado. */
  existingPlaylists?: { id: string; name: string }[];
  /** Títulos que a busca deve tratar como inexistentes. */
  missingTitles?: string[];
  /** Falha o envio de faixas a partir deste lote (base 0), uma única vez. */
  failAddTracksFromBatch?: number;
}

interface MockState {
  addedUris: string[];
  batchIndex: number;
  createdPlaylistId: string | null;
}

export async function mockSpotify(page: Page, options: MockOptions = {}): Promise<MockState> {
  const state: MockState = { addedUris: [], batchIndex: 0, createdPlaylistId: null };
  const existing = options.existingPlaylists ?? [];
  const missing = new Set((options.missingTitles ?? []).map((title) => title.toLowerCase()));

  await page.route('https://accounts.spotify.com/authorize*', async (route: Route) => {
    const url = new URL(route.request().url());
    const redirectUri = url.searchParams.get('redirect_uri') ?? '/';
    const authState = url.searchParams.get('state') ?? '';
    await route.fulfill({
      status: 302,
      headers: {
        location: `${redirectUri}?code=codigo-de-teste&state=${encodeURIComponent(authState)}`,
      },
    });
  });

  await page.route('https://accounts.spotify.com/api/token', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'access-token-e2e',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'refresh-token-e2e',
        scope: 'playlist-modify-private playlist-modify-public playlist-read-private',
      }),
    });
  });

  await page.route('https://api.spotify.com/v1/me', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: USER_ID, display_name: DISPLAY_NAME }),
    });
  });

  await page.route('https://api.spotify.com/v1/me/playlists*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: existing.map((playlist) => ({ ...playlist, owner: { id: USER_ID } })),
        limit: 50,
        offset: 0,
        total: existing.length,
        next: null,
      }),
    });
  });

  await page.route('https://api.spotify.com/v1/search*', async (route: Route) => {
    const url = new URL(route.request().url());
    const query = url.searchParams.get('q') ?? '';
    const fielded = /track:"([^"]*)"(?:\s+artist:"([^"]*)")?/.exec(query);
    const title = fielded?.[1] ?? query;
    const artist = fielded?.[2] ?? '';

    const items =
      missing.has(title.toLowerCase()) || title.trim() === ''
        ? []
        : [
            {
              uri: `spotify:track:${slug(title)}`,
              id: slug(title),
              name: title,
              artists: [{ name: artist === '' ? 'Artista' : artist }],
              album: { name: 'Álbum de Teste', images: [] },
              duration_ms: 210_000,
              external_urls: { spotify: `https://open.spotify.com/track/${slug(title)}` },
            },
          ];

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ tracks: { items, limit: 5, offset: 0, total: items.length } }),
    });
  });

  await page.route('https://api.spotify.com/v1/users/*/playlists', async (route: Route) => {
    state.createdPlaylistId = 'playlist-e2e';
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'playlist-e2e',
        external_urls: { spotify: 'https://open.spotify.com/playlist/playlist-e2e' },
      }),
    });
  });

  await page.route('https://api.spotify.com/v1/playlists/*/tracks', async (route: Route) => {
    const body = route.request().postDataJSON() as { uris: string[] };

    if (options.failAddTracksFromBatch === state.batchIndex) {
      // Falha uma única vez: a retomada precisa encontrar a rede saudável.
      options.failAddTracksFromBatch = undefined;
      // Status não recuperável de propósito. Um 5xx seria repetido pelo próprio
      // cliente HTTP e a falha parcial nunca chegaria à interface.
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: { status: 400, message: 'Bad request' } }),
      });
      return;
    }

    state.addedUris.push(...body.uris);
    state.batchIndex += 1;
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ snapshot_id: `snapshot-${state.batchIndex}` }),
    });
  });

  await page.route('https://i.scdn.co/**', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'image/jpeg', body: '' });
  });

  return state;
}

/** Grava a credencial antes do primeiro carregamento, pulando a digitação. */
export async function seedCredential(page: Page, clientId = CLIENT_ID): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key!, value!);
    },
    ['tp.v1.credential', JSON.stringify({ schemaVersion: 1, clientId })],
  );
}

function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
