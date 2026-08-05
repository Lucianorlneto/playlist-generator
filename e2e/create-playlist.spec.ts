import { expect, test, type Page } from '@playwright/test';

import { t } from '../src/i18n/pt-BR';
import { DISPLAY_NAME, mockSpotify, seedCredential } from './support/spotify-mock';

const LISTA = [
  'Bohemian Rhapsody - Queen',
  'Imagine – John Lennon',
  'Smells Like Teen Spirit — Nirvana',
  'Hey Jude by The Beatles',
  'Faixa Que Nao Existe - Ninguem',
].join('\n');

async function conectarEBuscar(page: Page): Promise<void> {
  await seedCredential(page);
  await page.goto('/');
  await page.getByRole('button', { name: t.connect.connect }).click();
  await expect(page.getByText(DISPLAY_NAME)).toBeVisible();

  await page.getByLabel(t.input.textareaLabel).fill(LISTA);
  await page.getByRole('button', { name: t.input.search }).click();
  await expect(page.getByRole('heading', { name: t.review.heading })).toBeVisible();
}

test.describe('US3 — criar a playlist e ver o resultado', () => {
  test('fluxo completo até o resultado, com caminho efetivo e aviso de pastas', async ({
    page,
  }) => {
    await mockSpotify(page, { missingTitles: ['Faixa Que Nao Existe'] });

    // FR-010: nenhuma requisição pode sair para um host fora da lista fechada.
    const origensVistas = new Set<string>();
    page.on('request', (request) => {
      origensVistas.add(new URL(request.url()).origin);
    });

    await conectarEBuscar(page);

    await expect(page.getByRole('button', { name: t.playlistConfig.create })).toBeDisabled();

    await page.getByLabel(t.playlistConfig.nameLabel).fill('Clássicos do Rock');
    await page.getByRole('button', { name: t.playlistConfig.create }).click();

    await expect(page.getByRole('heading', { name: t.result.heading })).toBeVisible();

    // Caminho efetivo exato de FR-036.
    await expect(
      page.getByText(`${t.result.libraryRoot} / ${DISPLAY_NAME} / Clássicos do Rock`),
    ).toBeVisible();

    // Aviso de pastas em toda criação bem-sucedida (FR-037, SC-007).
    await expect(page.getByText(t.result.folderNoticeHeading)).toBeVisible();
    await expect(page.getByRole('link', { name: t.result.openPlaylist })).toBeVisible();

    // Linhas sem correspondência, copiáveis em bloco (FR-039, FR-040).
    await expect(page.getByText(t.result.failedHeading)).toBeVisible();
    await expect(page.getByText('Faixa Que Nao Existe - Ninguem')).toBeVisible();
    await expect(page.getByRole('button', { name: t.result.copyFailed })).toBeVisible();

    const permitidas = new Set([
      new URL(page.url()).origin,
      'https://accounts.spotify.com',
      'https://api.spotify.com',
      'https://i.scdn.co',
    ]);
    const intrusas = [...origensVistas].filter((origem) => !permitidas.has(origem));
    expect(intrusas, `Destinos fora da lista autorizada: ${intrusas.join(', ')}`).toEqual([]);
  });

  test('bloqueia nome já usado, ignorando caixa e espaços de borda', async ({ page }) => {
    await mockSpotify(page, { existingPlaylists: [{ id: 'p1', name: 'Clássicos do Rock' }] });
    await conectarEBuscar(page);

    await page.getByLabel(t.playlistConfig.nameLabel).fill('  clássicos DO rock  ');
    await page.getByLabel(t.playlistConfig.nameLabel).blur();

    await expect(page.getByText(t.playlistConfig.nameDuplicate)).toBeVisible();
    await expect(page.getByRole('button', { name: t.playlistConfig.create })).toBeDisabled();
  });

  test('não existe campo de pasta em nenhuma etapa (FR-038)', async ({ page }) => {
    await mockSpotify(page);
    await conectarEBuscar(page);

    const corpo = (await page.locator('body').innerText()).toLowerCase();
    expect(corpo).not.toContain('escolher pasta');
    expect(corpo).not.toContain('selecionar pasta');

    await page.getByLabel(t.playlistConfig.nameLabel).fill('Sem Pasta');
    await page.getByRole('button', { name: t.playlistConfig.create }).click();
    await expect(page.getByRole('heading', { name: t.result.heading })).toBeVisible();

    await expect(page.getByLabel(/pasta/i)).toHaveCount(0);
  });

  test('retomada após falha parcial não duplica nem cria segunda playlist (SC-009)', async ({
    page,
  }) => {
    const state = await mockSpotify(page, { failAddTracksFromBatch: 0 });
    await conectarEBuscar(page);

    await page.getByLabel(t.playlistConfig.nameLabel).fill('Com Falha');
    await page.getByRole('button', { name: t.playlistConfig.create }).click();

    await expect(page.getByText(t.result.partialHeading)).toBeVisible();

    await page.getByRole('button', { name: t.result.retryRemaining }).click();
    await expect(page.getByRole('heading', { name: t.result.heading })).toBeVisible();

    expect(new Set(state.addedUris).size).toBe(state.addedUris.length);
    expect(state.createdPlaylistId).toBe('playlist-e2e');
  });
});
