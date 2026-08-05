import { expect, test, type Page } from '@playwright/test';

import { t } from '../src/i18n/pt-BR';
import { CLIENT_ID, mockSpotify, seedCredential } from './support/spotify-mock';

/** Percorre a etapa por Tab até encontrar o controle, ou falha após um limite. */
async function focarPorTeclado(page: Page, seletor: string, limite = 40): Promise<void> {
  for (let passo = 0; passo < limite; passo += 1) {
    const focado = await page.evaluate((alvo) => {
      const elemento = document.querySelector(alvo);
      return elemento !== null && elemento === document.activeElement;
    }, seletor);
    if (focado) return;
    await page.keyboard.press('Tab');
  }
  throw new Error(`Controle "${seletor}" não foi alcançado por teclado em ${limite} tabulações`);
}

test.describe('FR-046 — operação por teclado', () => {
  test('a etapa de credencial é operável só pelo teclado, incluindo revelar', async ({ page }) => {
    await mockSpotify(page);
    await page.goto('/');

    await page.keyboard.press('Tab'); // "Ir para o conteúdo"
    await focarPorTeclado(page, 'input[type="text"], input:not([type])');
    await page.keyboard.type(CLIENT_ID);
    await page.keyboard.press('Enter');

    await expect(page.getByLabel(t.credential.maskedLabel)).toBeVisible();

    const revelar = page.getByRole('button', { name: t.credential.reveal });
    await revelar.focus();
    await expect(revelar).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press('Enter');

    const ocultar = page.getByRole('button', { name: t.credential.hide });
    await expect(ocultar).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByLabel(t.credential.maskedLabel)).toContainText(CLIENT_ID);
  });

  test('o fluxo inteiro pode ser concluído sem mouse', async ({ page }) => {
    await mockSpotify(page);
    await seedCredential(page);
    await page.goto('/');

    await page.getByRole('button', { name: t.connect.connect }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: t.input.heading })).toBeVisible();

    await page.getByLabel(t.input.textareaLabel).focus();
    await page.keyboard.type('Bohemian Rhapsody - Queen');

    await page.getByRole('button', { name: t.input.search }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: t.review.heading })).toBeVisible();

    await page.getByLabel(t.playlistConfig.nameLabel).focus();
    await page.keyboard.type('Somente Teclado');

    await page.getByRole('button', { name: t.playlistConfig.create }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: t.result.heading })).toBeVisible();
  });

  test('o foco vai para o cabeçalho a cada transição de etapa', async ({ page }) => {
    await mockSpotify(page);
    await seedCredential(page);
    await page.goto('/');

    await page.getByRole('button', { name: t.connect.connect }).click();
    await expect(page.getByRole('heading', { name: t.input.heading })).toBeFocused();

    await page.getByLabel(t.input.textareaLabel).fill('Imagine - John Lennon');
    await page.getByRole('button', { name: t.input.search }).click();
    await expect(page.getByRole('heading', { name: t.review.heading })).toBeFocused();
  });

  test('o botão de cancelar a busca é alcançável enquanto ela roda', async ({ page }) => {
    await mockSpotify(page);
    await seedCredential(page);
    await page.goto('/');

    await page.getByRole('button', { name: t.connect.connect }).click();
    await page
      .getByLabel(t.input.textareaLabel)
      .fill(
        Array.from({ length: 60 }, (_, index) => `Faixa ${index} - Artista ${index}`).join('\n'),
      );
    await page.getByRole('button', { name: t.input.search }).click();

    const cancelar = page.getByRole('button', { name: t.review.cancelSearch }).first();
    await expect(cancelar).toBeVisible();
    await cancelar.focus();
    await expect(cancelar).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(page.getByText(t.review.searchCanceled)).toBeVisible();
  });
});
