import { expect, test, type Page } from '@playwright/test';

import { t } from '../src/i18n/pt-BR';
import {
  botaoConectar,
  botaoCriar,
  fmt,
  incluirPendentes,
  SPOTIFY,
  tituloResultado,
  tituloRevisao,
  YOUTUBE,
} from './support/flow';
import { CLIENT_ID, mockSpotify, seedCredential } from './support/spotify-mock';
import { catalogoDe, mockYouTube, YT_CHANNEL_NAME, YT_CLIENT_ID } from './support/youtube-mock';

/**
 * SC-016: o fluxo completo cabe em 375 px sem rolagem horizontal da página e sem
 * controle inacessível — agora com **cinco** etapas e dois destinos.
 */
test.use({ viewport: { width: 375, height: 667 } });

const LISTA = [
  'Bohemian Rhapsody - Queen',
  'Uma Faixa Com Um Titulo Bem Longo Para Testar Quebra De Linha - Um Artista De Nome Igualmente Longo',
  'Imagine - John Lennon',
].join('\n');

async function semRolagemHorizontal(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth };
  });
  // Uma folga de 1 px absorve arredondamento de layout.
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

test.describe('SC-016 — tela de 375 px', () => {
  test('as cinco etapas cabem na largura, sem rolagem horizontal', async ({ page }) => {
    await mockSpotify(page);
    await mockYouTube(page, { tracks: catalogoDe(LISTA) });
    await seedCredential(page, CLIENT_ID, 'spotify');
    await seedCredential(page, YT_CLIENT_ID, 'youtube');
    await page.goto('/');

    // Etapa 1 — configuração, com um bloco de credencial por serviço.
    await expect(page.getByLabel(fmt(t.credential.maskedLabel, { service: SPOTIFY }))).toBeVisible();
    await semRolagemHorizontal(page);
    await page.getByRole('button', { name: t.common.next, exact: true }).click();

    // Etapa 2 — destinos.
    await expect(page.getByRole('heading', { name: t.destinations.heading })).toBeVisible();
    await semRolagemHorizontal(page);
    await page.getByRole('button', { name: t.common.next, exact: true }).click();

    // Etapa 3 — entrada.
    await expect(page.getByRole('heading', { name: t.input.heading })).toBeVisible();
    await page.getByLabel(t.input.textareaLabel).fill(LISTA);
    await semRolagemHorizontal(page);
    await page.getByRole('button', { name: t.input.start, exact: true }).click();

    // Etapa 4 — ciclo do Spotify: conexão, revisão e resultado.
    await botaoConectar(page, SPOTIFY).click();
    await expect(tituloRevisao(page, SPOTIFY)).toBeVisible();
    await semRolagemHorizontal(page);

    // A fila é mais um elemento na largura: precisa caber junto do resto.
    await expect(page.getByLabel(t.queue.label)).toBeVisible();

    await page.getByRole('button', { name: t.review.alternatives }).first().click();
    await semRolagemHorizontal(page);

    await page.getByLabel(t.playlistConfig.nameLabel).fill('Lista Estreita');
    await semRolagemHorizontal(page);
    await botaoCriar(page, SPOTIFY).click();

    await expect(tituloResultado(page, SPOTIFY)).toBeVisible();
    await semRolagemHorizontal(page);

    // Etapa 4 de novo — ciclo do YouTube, com a estimativa de cota pelo meio.
    await page
      .getByRole('button', { name: fmt(t.result.continueNext, { service: YOUTUBE }) })
      .click();
    await botaoConectar(page, YOUTUBE).click();
    await expect(page.getByText(YT_CHANNEL_NAME)).toBeVisible();
    await expect(page.getByText(fmt(t.quota.heading, { service: YOUTUBE }))).toBeVisible();
    await semRolagemHorizontal(page);
    await page.getByRole('button', { name: t.quota.proceed }).click();

    await expect(tituloRevisao(page, YOUTUBE)).toBeVisible();
    await semRolagemHorizontal(page);
    await incluirPendentes(page);
    await botaoCriar(page, YOUTUBE).click();
    await expect(tituloResultado(page, YOUTUBE)).toBeVisible();
    await semRolagemHorizontal(page);

    // Etapa 5 — resumo consolidado.
    await page.getByRole('button', { name: t.common.next, exact: true }).click();
    await expect(page.getByRole('heading', { name: t.summary.heading })).toBeVisible();
    await semRolagemHorizontal(page);
  });

  /**
   * `003/FR-017` em 375 px: o motivo de atenção é a frase mais longa que a
   * revisão exibe, e é justamente o texto que não pode estourar a largura nem
   * empurrar os controles para fora da tela.
   */
  test('o motivo de atenção cabe na largura, sem rolagem horizontal', async ({ page }) => {
    await mockSpotify(page, { ambiguousQueries: ['Amor'] });
    await seedCredential(page);
    await page.goto('/');

    await page.getByRole('button', { name: t.common.next, exact: true }).click();
    await page.getByRole('button', { name: t.common.next, exact: true }).click();
    // Um título genérico, que cai na regra de margem e pede escolha humana.
    await page.getByLabel(t.input.textareaLabel).fill('Amor');
    await page.getByRole('button', { name: t.input.start, exact: true }).click();
    await botaoConectar(page, SPOTIFY).click();
    await expect(tituloRevisao(page, SPOTIFY)).toBeVisible();

    const motivo = page.getByText(t.review.attentionReason.noArtistAmbiguous);
    await expect(motivo).toBeVisible();
    await semRolagemHorizontal(page);

    // O texto longo não pode empurrar as ações para fora da largura.
    const alternativas = page.getByRole('button', { name: t.review.alternatives }).first();
    await alternativas.scrollIntoViewIfNeeded();
    await expect(alternativas).toBeInViewport({ ratio: 1 });

    await alternativas.click();
    await semRolagemHorizontal(page);
  });

  test('todos os controles da revisão continuam alcançáveis', async ({ page }) => {
    await mockSpotify(page);
    await seedCredential(page);
    await page.goto('/');

    await page.getByRole('button', { name: t.common.next, exact: true }).click();
    await page.getByRole('button', { name: t.common.next, exact: true }).click();
    await page.getByLabel(t.input.textareaLabel).fill('Bohemian Rhapsody - Queen');
    await page.getByRole('button', { name: t.input.start, exact: true }).click();
    await botaoConectar(page, SPOTIFY).click();
    await expect(tituloRevisao(page, SPOTIFY)).toBeVisible();

    for (const nome of [t.review.alternatives, t.review.editLine]) {
      const botao = page.getByRole('button', { name: nome }).first();
      await expect(botao).toBeVisible();
      // Rolagem **vertical** sempre foi legítima; o que SC-016 proíbe é a
      // horizontal. O controle precisa estar alcançável e inteiro na largura.
      await botao.scrollIntoViewIfNeeded();
      await expect(botao).toBeInViewport({ ratio: 1 });
      await semRolagemHorizontal(page);
    }

    const caixa = page.getByRole('list', { name: t.review.listLabel }).getByRole('checkbox').first();
    await caixa.uncheck();
    await expect(caixa).not.toBeChecked();
  });
});

/**
 * FR-023 e SC-011 nos **dois temas** (T062).
 *
 * Rodar de novo no tema escuro não é zelo redundante: a goteira colapsada, o
 * controle de tema em modo só-ícone e o selo de estado com filete de 1px são
 * exatamente os elementos cujo tamanho depende de borda e de espaçamento — e
 * borda é o que mudou nos dois temas quando T016 reforçou `--rule-strong`.
 */
test.describe('FR-023 e SC-011 — 320 px nos dois temas', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  for (const tema of ['light', 'dark'] as const) {
    test(`sem rolagem horizontal no tema ${tema}`, async ({ page }) => {
      await page.addInitScript(
        ([preference]) => {
          window.localStorage.setItem(
            'tp.v2.theme',
            JSON.stringify({ schemaVersion: 2, preference }),
          );
        },
        [tema],
      );

      await mockSpotify(page);
      await seedCredential(page, CLIENT_ID, 'spotify');
      await page.goto('/');

      expect(await page.evaluate(() => document.documentElement.dataset['theme'])).toBe(tema);

      // Etapa 1 — configuração.
      await semRolagemHorizontal(page);
      await page.getByRole('button', { name: t.common.next, exact: true }).click();

      // Etapa 2 — destinos.
      await semRolagemHorizontal(page);
      await page.getByRole('button', { name: t.common.next, exact: true }).click();

      // Etapa 3 — entrada, com uma linha deliberadamente longa.
      await page.getByLabel(t.input.textareaLabel).fill(LISTA);
      await semRolagemHorizontal(page);
      await page.getByRole('button', { name: t.input.start, exact: true }).click();

      // Etapa 4 — serviço e revisão, onde a goteira colapsa em prefixo.
      await botaoConectar(page, SPOTIFY).click();
      await expect(tituloRevisao(page, SPOTIFY)).toBeVisible();
      await semRolagemHorizontal(page);

      // O controle de tema continua acionável no modo colapsado (SC-010).
      const opcao = page.getByRole('radio', { name: t.theme.light });
      await expect(opcao).toBeVisible();
      const caixa = await opcao.boundingBox();
      expect(caixa?.width ?? 0).toBeGreaterThan(0);
    });
  }
});
