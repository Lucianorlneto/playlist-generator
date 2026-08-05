import { expect, test, type Page } from '@playwright/test';

import { t } from '../src/i18n/pt-BR';
import { mockSpotify, seedCredential } from './support/spotify-mock';

/**
 * SC-012: o fluxo completo cabe em 375 px sem rolagem horizontal da página e sem
 * controle inacessível. Roda no projeto `narrow-375` do playwright.config.ts.
 */
test.use({ viewport: { width: 375, height: 667 } });

async function semRolagemHorizontal(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth };
  });
  // Uma folga de 1 px absorve arredondamento de layout.
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

test.describe('SC-012 — tela de 375 px', () => {
  test('as quatro etapas cabem na largura, sem rolagem horizontal', async ({ page }) => {
    await mockSpotify(page);
    await seedCredential(page);
    await page.goto('/');

    // Etapa 1 — credencial
    await expect(page.getByLabel(t.credential.maskedLabel)).toBeVisible();
    await semRolagemHorizontal(page);

    await page.getByRole('button', { name: t.connect.connect }).click();

    // Etapa 2 — entrada
    await expect(page.getByRole('heading', { name: t.input.heading })).toBeVisible();
    await page
      .getByLabel(t.input.textareaLabel)
      .fill(
        [
          'Bohemian Rhapsody - Queen',
          'Uma Faixa Com Um Titulo Bem Longo Para Testar Quebra De Linha - Um Artista De Nome Igualmente Longo',
          'Imagine - John Lennon',
        ].join('\n'),
      );
    await semRolagemHorizontal(page);

    await page.getByRole('button', { name: t.input.search }).click();

    // Etapa 3 — revisão (cartões empilhados por padrão, research §12)
    await expect(page.getByRole('heading', { name: t.review.heading })).toBeVisible();
    await semRolagemHorizontal(page);

    await page.getByRole('button', { name: t.review.alternatives }).first().click();
    await semRolagemHorizontal(page);

    await page.getByLabel(t.playlistConfig.nameLabel).fill('Lista Estreita');
    await semRolagemHorizontal(page);

    await page.getByRole('button', { name: t.playlistConfig.create }).click();

    // Etapa 4 — resultado
    await expect(page.getByRole('heading', { name: t.result.heading })).toBeVisible();
    await semRolagemHorizontal(page);
  });

  test('todos os controles da revisão continuam alcançáveis', async ({ page }) => {
    await mockSpotify(page);
    await seedCredential(page);
    await page.goto('/');

    await page.getByRole('button', { name: t.connect.connect }).click();
    await page.getByLabel(t.input.textareaLabel).fill('Bohemian Rhapsody - Queen');
    await page.getByRole('button', { name: t.input.search }).click();
    await expect(page.getByRole('heading', { name: t.review.heading })).toBeVisible();

    for (const nome of [t.review.alternatives, t.review.editLine]) {
      const botao = page.getByRole('button', { name: nome }).first();
      await expect(botao).toBeVisible();
      await expect(botao).toBeInViewport({ ratio: 0 });
    }

    const caixa = page.getByRole('checkbox').first();
    await caixa.uncheck();
    await expect(caixa).not.toBeChecked();
  });
});
