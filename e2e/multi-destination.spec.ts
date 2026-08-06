import { expect, test, type Page } from '@playwright/test';

import { t } from '../src/i18n/pt-BR';
import { CLIENT_ID, DISPLAY_NAME, mockSpotify, seedCredential } from './support/spotify-mock';
import { mockYouTube, YT_CHANNEL_NAME, YT_CLIENT_ID } from './support/youtube-mock';

/**
 * Fluxo completo com **dois destinos** (US3, FR-016 a FR-021, SC-004, SC-005,
 * SC-007, SC-012).
 *
 * Os dois provedores são mockados; nenhum teste toca a rede real. O que este
 * arquivo existe para provar é o que só aparece quando há mais de um destino:
 * ordem fixa, autorização tardia, isolamento entre serviços e resumo final.
 */

const LISTA = [
  'Bohemian Rhapsody - Queen',
  'Imagine - John Lennon',
  'Smells Like Teen Spirit - Nirvana',
].join('\n');

const spotify = t.providers.spotify.name;
const youtube = t.providers.youtube.name;

const fmt = (template: string, values: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/gu, (_, key: string) => String(values[key] ?? ''));

/** Cadastra as duas credenciais antes do primeiro carregamento. */
async function seedAmbas(page: Page): Promise<void> {
  await seedCredential(page, CLIENT_ID, 'spotify');
  await seedCredential(page, YT_CLIENT_ID, 'youtube');
}

/** Configuração → Destinos → Entrada, parando antes do ciclo do primeiro serviço. */
async function ateEntrada(page: Page): Promise<void> {
  await page.goto('/');

  // Etapa 1: as credenciais já estão salvas; basta avançar.
  await expect(page.getByRole('heading', { name: t.credential.heading })).toBeVisible();
  await page.getByRole('button', { name: t.common.next }).click();

  // Etapa 2: destinos com credencial vêm marcados por padrão (SC-003).
  await expect(page.getByRole('heading', { name: t.destinations.heading })).toBeVisible();
  await page.getByRole('button', { name: t.common.next }).click();

  // Etapa 3: a lista é informada uma única vez, para todos os destinos (FR-013).
  await page.getByLabel(t.input.textareaLabel).fill(LISTA);
  await page.getByRole('button', { name: t.input.start }).click();
}

/** Vai da abertura até a revisão do primeiro serviço da fila. */
async function ateRevisaoDoPrimeiro(page: Page, nome = 'Clássicos'): Promise<void> {
  await ateEntrada(page);

  // Ciclo do Spotify: autorização pedida só agora (FR-017).
  await page.getByRole('button', { name: fmt(t.connect.connect, { service: spotify }) }).click();
  await expect(page.getByText(DISPLAY_NAME)).toBeVisible();
  await expect(
    page.getByRole('heading', { name: fmt(t.review.heading, { service: spotify }) }),
  ).toBeVisible();

  // Nome e visibilidade ficam na revisão, junto da confirmação.
  await page.getByLabel(t.playlistConfig.nameLabel).fill(nome);
}

test.describe('US3 — dois destinos, um depois do outro', () => {
  test('cria em ambos, na ordem fixa, e mostra o resumo consolidado', async ({ page }) => {
    const spotifyState = await mockSpotify(page);
    const youtubeState = await mockYouTube(page);
    await seedAmbas(page);

    // Nenhuma requisição pode sair para host fora da lista fechada (Princípio II).
    const origens = new Set<string>();
    page.on('request', (request) => {
      origens.add(new URL(request.url()).origin);
    });

    await ateRevisaoDoPrimeiro(page);

    // FR-018: a posição na fila está visível em todas as telas do ciclo.
    await expect(
      page.getByText(fmt(t.queue.position, { service: spotify, current: 1, total: 2 })),
    ).toBeVisible();

    // SC-005: nada saiu para o YouTube antes do ciclo dele começar.
    expect(youtubeState.searchCount).toBe(0);
    expect(youtubeState.createdPlaylistId).toBeNull();

    await page.getByRole('button', { name: t.playlistConfig.create }).click();
    await expect(
      page.getByRole('heading', { name: fmt(t.result.heading, { service: spotify }) }),
    ).toBeVisible();
    expect(spotifyState.addedUris.length).toBeGreaterThan(0);

    // Ciclo do YouTube começa só agora (FR-017).
    await page.getByRole('button', { name: fmt(t.result.continueNext, { service: youtube }) }).click();
    await page.getByRole('button', { name: fmt(t.connect.connect, { service: youtube }) }).click();
    await expect(page.getByText(YT_CHANNEL_NAME)).toBeVisible();

    // FR-029 / SC-011: a estimativa aparece antes de qualquer busca no YouTube.
    await expect(
      page.getByRole('heading', { name: fmt(t.quota.heading, { service: youtube }) }),
    ).toBeVisible();
    expect(youtubeState.searchCount).toBe(0);
    await page.getByRole('button', { name: t.quota.proceed }).click();

    await expect(
      page.getByRole('heading', { name: fmt(t.review.heading, { service: youtube }) }),
    ).toBeVisible();
    await expect(
      page.getByText(fmt(t.queue.position, { service: youtube, current: 2, total: 2 })),
    ).toBeVisible();

    await page.getByRole('button', { name: t.playlistConfig.create }).click();
    await expect(
      page.getByRole('heading', { name: fmt(t.result.heading, { service: youtube }) }),
    ).toBeVisible();

    // SC-004: duas playlists, uma em cada conta.
    expect(youtubeState.createdPlaylistId).not.toBeNull();
    expect(youtubeState.addedVideoIds.length).toBeGreaterThan(0);
    // FR-026: privada por padrão nos dois serviços.
    expect(youtubeState.createdPrivacy).toBe('private');

    // FR-040: resumo consolidado com os dois desfechos.
    await page.getByRole('button', { name: t.common.next }).click();
    await expect(page.getByRole('heading', { name: t.summary.heading })).toBeVisible();
    const resumo = page.getByRole('list', { name: t.summary.listLabel });
    await expect(resumo).toContainText(spotify);
    await expect(resumo).toContainText(youtube);
    await expect(resumo.getByText(t.summary.outcome.completed).first()).toBeVisible();

    // Princípio II: superfície de rede fechada, verificada de fato.
    for (const origem of origens) {
      expect(
        [
          'https://accounts.spotify.com',
          'https://api.spotify.com',
          'https://i.scdn.co',
          'https://accounts.google.com',
          'https://www.googleapis.com',
          'https://i.ytimg.com',
          'http://127.0.0.1:4173',
          'http://127.0.0.1:5173',
        ],
        `origem inesperada: ${origem}`,
      ).toContain(origem);
    }
  });

  test('pular o segundo serviço preserva a playlist do primeiro (FR-020)', async ({ page }) => {
    const spotifyState = await mockSpotify(page);
    const youtubeState = await mockYouTube(page);
    await seedAmbas(page);

    await ateRevisaoDoPrimeiro(page);
    await page.getByRole('button', { name: t.playlistConfig.create }).click();
    await expect(
      page.getByRole('heading', { name: fmt(t.result.heading, { service: spotify }) }),
    ).toBeVisible();

    const criadasNoSpotify = spotifyState.addedUris.length;

    await page.getByRole('button', { name: fmt(t.result.continueNext, { service: youtube }) }).click();
    await page.getByRole('button', { name: fmt(t.queue.skipService, { service: youtube }) }).click();

    await expect(page.getByRole('heading', { name: t.summary.heading })).toBeVisible();

    const resumo = page.getByRole('list', { name: t.summary.listLabel });
    await expect(resumo.getByText(t.summary.outcome.completed)).toBeVisible();
    await expect(resumo.getByText(t.summary.outcome.skipped)).toBeVisible();

    // O que já foi criado permanece intacto, e nada foi criado no YouTube.
    expect(spotifyState.addedUris).toHaveLength(criadasNoSpotify);
    expect(youtubeState.createdPlaylistId).toBeNull();
  });

  test('cota esgotada no YouTube não invalida o resultado do Spotify (SC-012)', async ({
    page,
  }) => {
    const spotifyState = await mockSpotify(page);
    // A primeira inserção passa; a segunda esbarra na cota.
    const youtubeState = await mockYouTube(page, { quotaExceededFromItem: 1 });
    await seedAmbas(page);

    await ateRevisaoDoPrimeiro(page);
    await page.getByRole('button', { name: t.playlistConfig.create }).click();
    await expect(
      page.getByRole('heading', { name: fmt(t.result.heading, { service: spotify }) }),
    ).toBeVisible();
    const criadasNoSpotify = [...spotifyState.addedUris];

    await page.getByRole('button', { name: fmt(t.result.continueNext, { service: youtube }) }).click();
    await page.getByRole('button', { name: fmt(t.connect.connect, { service: youtube }) }).click();
    await page.getByRole('button', { name: t.quota.proceed }).click();
    await expect(
      page.getByRole('heading', { name: fmt(t.review.heading, { service: youtube }) }),
    ).toBeVisible();
    await page.getByRole('button', { name: t.playlistConfig.create }).click();

    // FR-031, FR-032: encerrou com relato, playlist incompleta permanece.
    await expect(
      page.getByText(fmt(t.quota.exhaustedHeading, { service: youtube })),
    ).toBeVisible();
    expect(youtubeState.addedVideoIds).toHaveLength(1);

    // SC-012: o resultado do Spotify é o mesmo de antes.
    expect(spotifyState.addedUris).toEqual(criadasNoSpotify);

    await page.getByRole('button', { name: t.common.next }).click();
    const resumo = page.getByRole('list', { name: t.summary.listLabel });
    await expect(resumo.getByText(t.summary.outcome.completed)).toBeVisible();
    await expect(resumo.getByText(t.summary.outcome.partial)).toBeVisible();
  });

  test('um único destino não mostra fila nem resumo (FR-018, FR-040)', async ({ page }) => {
    await mockSpotify(page);
    await seedCredential(page, CLIENT_ID, 'spotify');

    await ateEntrada(page);
    await page.getByRole('button', { name: fmt(t.connect.connect, { service: spotify }) }).click();

    await expect(
      page.getByRole('heading', { name: fmt(t.review.heading, { service: spotify }) }),
    ).toBeVisible();
    await page.getByLabel(t.playlistConfig.nameLabel).fill('Só Spotify');

    // Nenhum "1 de 1" ruidoso.
    await expect(page.getByLabel(t.queue.label)).toHaveCount(0);

    await page.getByRole('button', { name: t.playlistConfig.create }).click();
    await expect(
      page.getByRole('heading', { name: fmt(t.result.heading, { service: spotify }) }),
    ).toBeVisible();

    // Sem resumo consolidado redundante.
    await expect(page.getByRole('heading', { name: t.summary.heading })).toHaveCount(0);
  });
});
