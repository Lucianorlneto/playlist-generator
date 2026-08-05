import { expect, test } from '@playwright/test';

import { t } from '../src/i18n/pt-BR';
import { mockSpotify, seedCredential } from './support/spotify-mock';

const LISTA = ['Bohemian Rhapsody - Queen', 'Imagine - John Lennon', 'Hey Jude - The Beatles'].join(
  '\n',
);

test.describe('US4 — recuperação do rascunho', () => {
  test('recarregar no meio da revisão retoma na mesma etapa com as escolhas intactas', async ({
    page,
  }) => {
    await mockSpotify(page);
    await seedCredential(page);
    await page.goto('/');

    await page.getByRole('button', { name: t.connect.connect }).click();
    await page.getByLabel(t.input.textareaLabel).fill(LISTA);
    await page.getByRole('button', { name: t.input.search }).click();
    await expect(page.getByRole('heading', { name: t.review.heading })).toBeVisible();

    await page.getByLabel(t.playlistConfig.nameLabel).fill('Trabalho em Andamento');

    // Escolha manual: desmarcar a primeira faixa.
    const primeiraCaixa = page.getByRole('checkbox').first();
    await primeiraCaixa.uncheck();
    await expect(primeiraCaixa).not.toBeChecked();

    // O rascunho é gravado com debounce de 500 ms.
    await page.waitForTimeout(900);
    await page.reload();

    await expect(page.getByText(t.draft.recoveredHeading)).toBeVisible();
    await expect(page.getByRole('heading', { name: t.review.heading })).toBeVisible();
    await expect(page.getByLabel(t.playlistConfig.nameLabel)).toHaveValue('Trabalho em Andamento');
    await expect(page.getByRole('checkbox').first()).not.toBeChecked();
    await expect(page.getByText('Bohemian Rhapsody - Queen')).toBeVisible();
  });

  test('descartar o rascunho zera o trabalho e preserva a credencial', async ({ page }) => {
    await mockSpotify(page);
    await seedCredential(page);
    await page.goto('/');

    await page.getByRole('button', { name: t.connect.connect }).click();
    await page.getByLabel(t.input.textareaLabel).fill(LISTA);
    await page.waitForTimeout(900);
    await page.reload();

    await expect(page.getByText(t.draft.recoveredHeading)).toBeVisible();
    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: t.draft.discard }).click();

    await expect(page.getByText(t.draft.discarded)).toBeVisible();
    await expect(page.getByLabel(t.input.textareaLabel)).toHaveValue('');

    // A credencial sobrevive ao descarte.
    await page.reload();
    const credencial = await page.evaluate(() => window.localStorage.getItem('tp.v1.credential'));
    expect(credencial).not.toBeNull();
  });

  test('a criação bem-sucedida apaga o rascunho', async ({ page }) => {
    await mockSpotify(page);
    await seedCredential(page);
    await page.goto('/');

    await page.getByRole('button', { name: t.connect.connect }).click();
    await page.getByLabel(t.input.textareaLabel).fill(LISTA);
    await page.getByRole('button', { name: t.input.search }).click();
    await page.getByLabel(t.playlistConfig.nameLabel).fill('Lista Concluída');
    await page.getByRole('button', { name: t.playlistConfig.create }).click();
    await expect(page.getByRole('heading', { name: t.result.heading })).toBeVisible();

    const rascunho = await page.evaluate(() => window.localStorage.getItem('tp.v1.draft'));
    expect(rascunho).toBeNull();
  });
});
