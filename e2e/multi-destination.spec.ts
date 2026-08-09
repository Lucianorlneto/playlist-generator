import { expect, test, type Page } from '@playwright/test';

import { t } from '../src/i18n/pt-BR';
import {
  ateEntrada,
  botaoConectar,
  botaoCriar,
  fmt,
  incluirPendentes,
  SPOTIFY,
  tituloResultado,
  tituloRevisao,
  YOUTUBE,
} from './support/flow';
import { CLIENT_ID, DISPLAY_NAME, mockSpotify, seedCredential } from './support/spotify-mock';
import { catalogoDe, mockYouTube, YT_CHANNEL_NAME, YT_CLIENT_ID } from './support/youtube-mock';

/**
 * Fluxo completo com **dois destinos** (US3, FR-016 a FR-021, FR-036, FR-040,
 * FR-041, SC-004, SC-005, SC-012).
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

/** A ordem original da lista, preservada de ponta a ponta (FR-021, SC-004). */
const URIS_SPOTIFY = [
  'spotify:track:bohemian-rhapsody',
  'spotify:track:imagine',
  'spotify:track:smells-like-teen-spirit',
];
const VIDEOS_YOUTUBE = [
  'vid-bohemian-rhapsody',
  'vid-imagine',
  'vid-smells-like-teen-spirit',
];

/** Cadastra as duas credenciais antes do primeiro carregamento. */
async function seedAmbas(page: Page): Promise<void> {
  await seedCredential(page, CLIENT_ID, 'spotify');
  await seedCredential(page, YT_CLIENT_ID, 'youtube');
}

/** Vai da abertura até a revisão do primeiro serviço da fila. */
async function ateRevisaoDoPrimeiro(page: Page, nome = 'Clássicos'): Promise<void> {
  await ateEntrada(page, LISTA);

  // Ciclo do Spotify: autorização pedida só agora (FR-017).
  await botaoConectar(page, SPOTIFY).click();
  await expect(page.getByText(DISPLAY_NAME)).toBeVisible();
  await expect(tituloRevisao(page, SPOTIFY)).toBeVisible();

  // Nome e visibilidade ficam na revisão, junto da confirmação.
  await page.getByLabel(t.playlistConfig.nameLabel).fill(nome);
}

/** Ciclo do YouTube, do resultado do Spotify até a revisão daquele serviço. */
async function ateRevisaoDoYouTube(page: Page): Promise<void> {
  await page.getByRole('button', { name: fmt(t.result.continueNext, { service: YOUTUBE }) }).click();
  await botaoConectar(page, YOUTUBE).click();
  await expect(page.getByText(YT_CHANNEL_NAME)).toBeVisible();
  await page.getByRole('button', { name: t.quota.proceed }).click();
  await expect(tituloRevisao(page, YOUTUBE)).toBeVisible();
}

test.describe('US3 — dois destinos, um depois do outro', () => {
  test('cria em ambos, na ordem fixa, e mostra o resumo consolidado', async ({ page }) => {
    const spotifyState = await mockSpotify(page);
    const youtubeState = await mockYouTube(page, { tracks: catalogoDe(LISTA) });
    await seedAmbas(page);

    // Nenhuma requisição pode sair para host fora da lista fechada (Princípio II).
    const origens = new Set<string>();
    page.on('request', (request) => {
      origens.add(new URL(request.url()).origin);
    });

    await ateRevisaoDoPrimeiro(page);

    // FR-018: a posição na fila está visível em todas as telas do ciclo.
    await expect(
      page.getByText(fmt(t.queue.position, { service: SPOTIFY, current: 1, total: 2 })),
    ).toBeVisible();

    // SC-005: nada saiu para o YouTube antes do ciclo dele começar.
    expect(youtubeState.searchCount).toBe(0);
    expect(youtubeState.createdPlaylistId).toBeNull();

    await botaoCriar(page, SPOTIFY).click();
    await expect(tituloResultado(page, SPOTIFY)).toBeVisible();
    expect(spotifyState.addedUris).toEqual(URIS_SPOTIFY);

    // Ciclo do YouTube começa só agora (FR-017).
    await page
      .getByRole('button', { name: fmt(t.result.continueNext, { service: YOUTUBE }) })
      .click();
    await botaoConectar(page, YOUTUBE).click();
    await expect(page.getByText(YT_CHANNEL_NAME)).toBeVisible();

    // FR-029 / SC-011: a estimativa aparece antes de qualquer busca no YouTube.
    await expect(page.getByText(fmt(t.quota.heading, { service: YOUTUBE }))).toBeVisible();
    expect(youtubeState.searchCount).toBe(0);
    await page.getByRole('button', { name: t.quota.proceed }).click();

    await expect(tituloRevisao(page, YOUTUBE)).toBeVisible();
    await expect(
      page.getByText(fmt(t.queue.position, { service: YOUTUBE, current: 2, total: 2 })),
    ).toBeVisible();

    await incluirPendentes(page);
    await botaoCriar(page, YOUTUBE).click();
    await expect(tituloResultado(page, YOUTUBE)).toBeVisible();

    // SC-004: duas playlists, uma em cada conta, na ordem original da lista.
    expect(youtubeState.createdPlaylistId).not.toBeNull();
    expect(youtubeState.addedVideoIds).toEqual(VIDEOS_YOUTUBE);
    // FR-026: privada por padrão nos dois serviços.
    expect(youtubeState.createdPrivacy).toBe('private');

    // FR-028: o resultado do YouTube não promete playlist do YouTube Music.
    await expect(page.getByText(t.providers.youtube.resultNotices[0]!)).toBeVisible();

    // FR-040: resumo consolidado com os dois desfechos.
    await page.getByRole('button', { name: t.common.next, exact: true }).click();
    await expect(page.getByRole('heading', { name: t.summary.heading })).toBeVisible();
    const resumo = page.getByRole('list', { name: t.summary.listLabel });
    await expect(resumo).toContainText(SPOTIFY);
    await expect(resumo).toContainText(YOUTUBE);
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
          new URL(page.url()).origin,
        ],
        `origem inesperada: ${origem}`,
      ).toContain(origem);
    }
  });

  test('pular o segundo serviço preserva a playlist do primeiro (FR-020)', async ({ page }) => {
    const spotifyState = await mockSpotify(page);
    const youtubeState = await mockYouTube(page, { tracks: catalogoDe(LISTA) });
    await seedAmbas(page);

    await ateRevisaoDoPrimeiro(page);
    await botaoCriar(page, SPOTIFY).click();
    await expect(tituloResultado(page, SPOTIFY)).toBeVisible();

    const criadasNoSpotify = spotifyState.addedUris.length;

    await page
      .getByRole('button', { name: fmt(t.queue.skipService, { service: YOUTUBE }) })
      .click();

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
    const youtubeState = await mockYouTube(page, { tracks: catalogoDe(LISTA), quotaExceededFromItem: 1 });
    await seedAmbas(page);

    await ateRevisaoDoPrimeiro(page);
    await botaoCriar(page, SPOTIFY).click();
    await expect(tituloResultado(page, SPOTIFY)).toBeVisible();
    const criadasNoSpotify = [...spotifyState.addedUris];

    await ateRevisaoDoYouTube(page);
    await incluirPendentes(page);
    await botaoCriar(page, YOUTUBE).click();

    // FR-031, FR-032: encerrou com relato, playlist incompleta permanece.
    await expect(page.getByText(fmt(t.quota.exhaustedHeading, { service: YOUTUBE }))).toBeVisible();
    expect(youtubeState.addedVideoIds).toHaveLength(1);

    // SC-012: o resultado do Spotify é o mesmo de antes.
    expect(spotifyState.addedUris).toEqual(criadasNoSpotify);

    await page.getByRole('button', { name: t.common.next, exact: true }).click();
    const resumo = page.getByRole('list', { name: t.summary.listLabel });
    await expect(resumo.getByText(t.summary.outcome.completed)).toBeVisible();
    await expect(resumo.getByText(t.summary.outcome.partial)).toBeVisible();
  });

  test('desconectar um serviço não afeta a sessão nem o resultado do outro (FR-036)', async ({
    page,
  }) => {
    await mockSpotify(page);
    await mockYouTube(page, { tracks: catalogoDe(LISTA) });
    await seedAmbas(page);

    await ateRevisaoDoPrimeiro(page, 'Isolamento');
    await botaoCriar(page, SPOTIFY).click();
    await expect(tituloResultado(page, SPOTIFY)).toBeVisible();

    await ateRevisaoDoYouTube(page);

    /*
      As duas contas aparecem na barra superior ao mesmo tempo.

      **Só o seletor mudou na feature 007**: o cabeçalho de contas — uma `<ul>`
      rotulada — virou um chip por provedor, permanente na barra superior. A
      afirmação que este caso protege é a mesma de antes, palavra por palavra.
    */
    const barra = page.getByRole('banner');
    await expect(barra).toContainText(DISPLAY_NAME);
    await expect(barra).toContainText(YT_CHANNEL_NAME);

    // Desconectar do Spotify — o serviço já concluído — não derruba o YouTube.
    await page
      .getByRole('button', { name: fmt(t.connect.disconnect, { service: SPOTIFY }) })
      .click();
    await expect(barra).not.toContainText(DISPLAY_NAME);
    await expect(barra).toContainText(YT_CHANNEL_NAME);

    // `004/FR-025`, SC-004: o serviço desconectado **continua presente**, com
    // ação de reconexão. Antes ele sumia do cabeçalho levando junto o seu único
    // ponto de interação.
    await expect(barra).toContainText(t.connectionChip.disconnected);
    await expect(
      barra.getByRole('button', { name: fmt(t.connectionChip.connectFor, { service: SPOTIFY }) }),
    ).toBeVisible();

    // E o ciclo do YouTube continua exatamente onde estava.
    await expect(tituloRevisao(page, YOUTUBE)).toBeVisible();
  });

  test('as linhas não encontradas são copiáveis por serviço, separadamente (FR-041)', async ({
    page,
  }) => {
    await mockSpotify(page, { missingTitles: ['Imagine'] });
    await mockYouTube(page, {
      tracks: catalogoDe(LISTA),
      missingTitles: ['Smells Like Teen Spirit'],
    });
    await seedAmbas(page);

    await ateRevisaoDoPrimeiro(page, 'Separadas');
    await botaoCriar(page, SPOTIFY).click();
    await expect(tituloResultado(page, SPOTIFY)).toBeVisible();

    // No resultado do Spotify, só a linha que faltou **naquele** serviço.
    const falhasSpotify = page.getByText(fmt(t.result.failedHeading, { service: SPOTIFY }));
    await expect(falhasSpotify).toBeVisible();
    await expect(
      page.getByRole('button', { name: fmt(t.result.copyFailed, { service: SPOTIFY }) }),
    ).toBeVisible();

    await ateRevisaoDoYouTube(page);
    await incluirPendentes(page);
    await botaoCriar(page, YOUTUBE).click();
    await expect(tituloResultado(page, YOUTUBE)).toBeVisible();

    await page.getByRole('button', { name: t.common.next, exact: true }).click();
    await expect(page.getByRole('heading', { name: t.summary.heading })).toBeVisible();

    // FR-041: um botão de cópia por serviço, nunca uma lista consolidada.
    const resumo = page.getByRole('list', { name: t.summary.listLabel });
    await expect(
      resumo.getByRole('button', { name: fmt(t.result.copyFailed, { service: SPOTIFY }) }),
    ).toBeVisible();
    await expect(
      resumo.getByRole('button', { name: fmt(t.result.copyFailed, { service: YOUTUBE }) }),
    ).toBeVisible();
  });

  test('um único destino não mostra fila nem resumo (FR-018, FR-040)', async ({ page }) => {
    await mockSpotify(page);
    await seedCredential(page, CLIENT_ID, 'spotify');

    await ateEntrada(page, LISTA);
    await botaoConectar(page, SPOTIFY).click();

    await expect(tituloRevisao(page, SPOTIFY)).toBeVisible();
    await page.getByLabel(t.playlistConfig.nameLabel).fill('Só Spotify');

    // Nenhum "1 de 1" ruidoso.
    await expect(page.getByLabel(t.queue.label)).toHaveCount(0);

    await botaoCriar(page, SPOTIFY).click();
    await expect(tituloResultado(page, SPOTIFY)).toBeVisible();

    // Sem resumo consolidado redundante.
    await expect(page.getByRole('heading', { name: t.summary.heading })).toHaveCount(0);
  });
});

/**
 * V17 — o beco sem saída, de ponta a ponta (`006/SC-001`, SC-002, FR-004,
 * FR-007).
 *
 * Antes da `006`, com **um** destino, pular na revisão levava a "Criando
 * playlist no Spotify…" — de um serviço que não ia criar nada — e o único botão
 * de lá levava a uma página sem cabeçalho e sem botão. A única saída era
 * recarregar (`006/research §2`).
 *
 * Este bloco fica fora do `describe` acima de propósito: é fluxo de destino
 * único, e o arquivo existe para o de dois. Mora aqui por ser o mesmo assunto —
 * o que acontece quando um destino sai da fila.
 */
test.describe('006 — pular sem tela fantasma', () => {
  test('destino único: pular encerra o fluxo na seleção de serviços', async ({ page }) => {
    const spotifyState = await mockSpotify(page);
    await seedCredential(page, CLIENT_ID, 'spotify');

    await ateEntrada(page, LISTA);
    await botaoConectar(page, SPOTIFY).click();
    await expect(tituloRevisao(page, SPOTIFY)).toBeVisible();

    await page
      .getByRole('button', { name: fmt(t.queue.skipService, { service: SPOTIFY }) })
      .click();

    // A confirmação existe porque este é o único caminho em que pular descarta
    // trabalho (`006/FR-005`).
    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();
    await dialogo.getByRole('button', { name: t.common.discard }).click();

    // Chegou na seleção de serviços…
    await expect(page.getByRole('heading', { name: t.destinations.heading })).toBeVisible();
    // …a tela de criação nunca apareceu…
    await expect(
      page.getByText(fmt(t.playlistConfig.creating, { service: SPOTIFY })),
    ).toHaveCount(0);
    // …e nada foi criado na conta.
    expect(spotifyState.createdPlaylistId).toBeNull();
  });

  test('recusar a confirmação devolve o usuário à revisão intacta', async ({ page }) => {
    await mockSpotify(page);
    await seedCredential(page, CLIENT_ID, 'spotify');

    await ateEntrada(page, LISTA);
    await botaoConectar(page, SPOTIFY).click();
    await expect(tituloRevisao(page, SPOTIFY)).toBeVisible();

    await page
      .getByRole('button', { name: fmt(t.queue.skipService, { service: SPOTIFY }) })
      .click();
    await page.getByRole('dialog').getByRole('button', { name: t.common.cancel }).click();

    await expect(tituloRevisao(page, SPOTIFY)).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('o comando de recomeço devolve à seleção de serviços de qualquer etapa', async ({
    page,
  }) => {
    await mockSpotify(page);
    await seedCredential(page, CLIENT_ID, 'spotify');

    await ateEntrada(page, LISTA);
    await botaoConectar(page, SPOTIFY).click();
    await expect(tituloRevisao(page, SPOTIFY)).toBeVisible();

    await page.getByRole('button', { name: t.flow.reset }).click();
    await page.getByRole('dialog').getByRole('button', { name: t.flow.resetConfirm }).click();

    await expect(page.getByRole('heading', { name: t.destinations.heading })).toBeVisible();

    // A credencial sobreviveu: nada de voltar para a etapa de configuração.
    await expect(page.getByRole('heading', { name: t.credential.heading })).toHaveCount(0);
  });
});
