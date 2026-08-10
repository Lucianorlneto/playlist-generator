import { expect, test } from '@playwright/test';

import { t } from '../src/i18n/pt-BR';
import {
  avancarDaCredencial,
  avancarDosDestinos,
  botaoConectar,
  fmt,
  informarLista,
  secaoCredencial,
  SPOTIFY,
  tituloRevisao,
  YOUTUBE,
} from './support/flow';
import { CLIENT_ID, DISPLAY_NAME, mockSpotify, seedCredential } from './support/spotify-mock';

/**
 * US1 — credencial por serviço e autorização dentro do ciclo daquele destino
 * (FR-001 a FR-007, FR-017, SC-002, SC-003, SC-005).
 *
 * A diferença central em relação à 001: a autorização **não** acontece na etapa
 * de configuração. Ela pertence ao ciclo do serviço, e por isso este arquivo
 * atravessa Configuração → Destinos → Entrada antes de conectar.
 */
test.describe('US1 — configurar credencial e conectar', () => {
  test('fluxo completo: salvar credencial, autorizar e ver a conta conectada', async ({ page }) => {
    await mockSpotify(page);
    await page.goto('/');

    // Cada serviço tem seu próprio bloco, com campo e instruções próprios (FR-001).
    const spotify = secaoCredencial(page, SPOTIFY);
    const field = spotify.getByLabel(t.providers.spotify.credentialLabel);
    await expect(field).toHaveValue('');
    await expect(spotify.getByText(t.credential.redirectUriHeading)).toBeVisible();
    await expect(spotify.getByRole('button', { name: t.credential.copyRedirectUri })).toBeVisible();

    // O Redirect URI exibido é o endereço real de onde a página está sendo
    // servida — derivado da URL, nunca hardcoded. É o que faz a aplicação
    // funcionar igual no dev server e em hospedagem estática (SC-008).
    const raizServida = `${new URL(page.url()).origin}/`;
    await expect(spotify.getByText(raizServida, { exact: true })).toBeVisible();

    // FR-045: a origem JavaScript só aparece onde o cadastro exige — no YouTube.
    await expect(spotify.getByText(t.credential.javascriptOriginHeading)).toHaveCount(0);
    await expect(
      secaoCredencial(page, YOUTUBE).getByText(t.credential.javascriptOriginHeading),
    ).toBeVisible();

    await field.fill(CLIENT_ID);
    await spotify.getByRole('button', { name: t.credential.save }).click();

    // Cenário A.2: mascarado, com os quatro últimos caracteres.
    const masked = page.getByLabel(fmt(t.credential.maskedLabel, { service: SPOTIFY }));
    await expect(masked).toContainText(CLIENT_ID.slice(-4));
    await expect(masked).not.toContainText(CLIENT_ID);

    // FR-002: uma credencial basta para sair da configuração.
    await avancarDaCredencial(page);

    // SC-002, SC-003: o destino com credencial vem marcado; o outro fica
    // desabilitado **com o motivo escrito** e um atalho para resolvê-lo.
    const caixaSpotify = page.getByRole('checkbox', {
      name: fmt(t.destinations.selectLabel, { service: SPOTIFY }),
    });
    const caixaYouTube = page.getByRole('checkbox', {
      name: fmt(t.destinations.selectLabel, { service: YOUTUBE }),
    });
    await expect(caixaSpotify).toBeChecked();
    await expect(caixaYouTube).toBeDisabled();
    await expect(
      page.getByText(fmt(t.destinations.unavailableReason, { service: YOUTUBE })),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: fmt(t.destinations.unavailableAction, { service: YOUTUBE }) }),
    ).toBeVisible();

    await avancarDosDestinos(page);
    await informarLista(page, 'Bohemian Rhapsody - Queen');

    // FR-017: o consentimento é pedido só agora, e só para o serviço da vez.
    await botaoConectar(page, SPOTIFY).click();

    // Cenário A.5: nome de exibição visível e nenhum `?code=` sobrando na URL.
    await expect(page.getByRole('banner').getByText(DISPLAY_NAME)).toBeVisible();
    expect(new URL(page.url()).search).toBe('');
    await expect(tituloRevisao(page, SPOTIFY)).toBeVisible();
  });

  test('desconectar preserva a credencial salva', async ({ page }) => {
    await mockSpotify(page);
    await seedCredential(page);
    await page.goto('/');

    await avancarDaCredencial(page);
    await avancarDosDestinos(page);
    await informarLista(page, 'Bohemian Rhapsody - Queen');

    await botaoConectar(page, SPOTIFY).click();
    await expect(page.getByRole('banner').getByText(DISPLAY_NAME)).toBeVisible();

    // FR-036: desconectar de um serviço não toca em credencial nem em rascunho.
    await page.getByRole('button', { name: fmt(t.connect.disconnect, { service: SPOTIFY }) }).click();
    await expect(page.getByRole('banner').getByText(DISPLAY_NAME)).toBeHidden();

    await page.reload();
    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: t.draft.discard }).click();
    await page.getByRole('button', { name: t.common.back }).click();

    await expect(page.getByLabel(fmt(t.credential.maskedLabel, { service: SPOTIFY }))).toContainText(
      CLIENT_ID.slice(-4),
    );
  });

  test('a credencial sobrevive ao recarregamento, ainda mascarada', async ({ page }) => {
    await mockSpotify(page);
    await seedCredential(page);
    await page.goto('/');

    const masked = page.getByLabel(fmt(t.credential.maskedLabel, { service: SPOTIFY }));
    await expect(masked).toContainText(CLIENT_ID.slice(-4));
    await page.reload();
    await expect(masked).toContainText(CLIENT_ID.slice(-4));
    await expect(masked).not.toContainText(CLIENT_ID);
  });
});
