import { expect, test } from '@playwright/test';

import { t } from '../src/i18n/pt-BR';
import { CLIENT_ID, DISPLAY_NAME, mockSpotify, seedCredential } from './support/spotify-mock';

test.describe('US1 — configurar credencial e conectar', () => {
  test('fluxo completo: salvar credencial, autorizar e ver a conta conectada', async ({ page }) => {
    await mockSpotify(page);
    await page.goto('/');

    // Cenário A.1: campo vazio e instruções visíveis.
    const field = page.getByLabel(t.credential.fieldLabel);
    await expect(field).toHaveValue('');
    await expect(page.getByText(t.credential.redirectUriHeading)).toBeVisible();
    await expect(page.getByRole('button', { name: t.credential.copyRedirectUri })).toBeVisible();

    // O Redirect URI exibido é o endereço real de onde a página está sendo
    // servida — derivado da URL, nunca hardcoded. É o que faz a aplicação
    // funcionar igual no dev server e em hospedagem estática (SC-008).
    const raizServida = `${new URL(page.url()).origin}/`;
    await expect(page.getByText(raizServida, { exact: true })).toBeVisible();

    await field.fill(CLIENT_ID);
    await page.getByRole('button', { name: t.credential.save }).click();

    // Cenário A.2: mascarado, com os quatro últimos caracteres.
    const masked = page.getByLabel(t.credential.maskedLabel);
    await expect(masked).toContainText(CLIENT_ID.slice(-4));
    await expect(masked).not.toContainText(CLIENT_ID);

    await page.getByRole('button', { name: t.connect.connect }).click();

    // Cenário A.5: nome de exibição visível e nenhum `?code=` sobrando na URL.
    await expect(page.getByText(DISPLAY_NAME)).toBeVisible();
    expect(new URL(page.url()).search).toBe('');
    await expect(page.getByRole('heading', { name: t.input.heading })).toBeVisible();
  });

  test('desconectar preserva a credencial salva', async ({ page }) => {
    await mockSpotify(page);
    await seedCredential(page);
    await page.goto('/');

    await page.getByRole('button', { name: t.connect.connect }).click();
    await expect(page.getByText(DISPLAY_NAME)).toBeVisible();

    await page.getByRole('button', { name: t.connect.disconnect }).click();

    await expect(page.getByText(DISPLAY_NAME)).toBeHidden();
    await page.reload();
    await expect(page.getByLabel(t.credential.maskedLabel)).toContainText(CLIENT_ID.slice(-4));
  });

  test('a credencial sobrevive ao recarregamento, ainda mascarada', async ({ page }) => {
    await mockSpotify(page);
    await seedCredential(page);
    await page.goto('/');

    await expect(page.getByLabel(t.credential.maskedLabel)).toContainText(CLIENT_ID.slice(-4));
    await page.reload();
    await expect(page.getByLabel(t.credential.maskedLabel)).toContainText(CLIENT_ID.slice(-4));
    await expect(page.getByLabel(t.credential.maskedLabel)).not.toContainText(CLIENT_ID);
  });
});
