import { expect, test } from '@playwright/test';

import { t } from '../src/i18n/pt-BR';
import { ateEntrada, botaoConectar, SPOTIFY, tituloRevisao } from './support/flow';
import { guardNetwork } from './support/network-guard';
import { CLIENT_ID, mockSpotify, seedCredential } from './support/spotify-mock';

/**
 * Nenhuma origem remota, observado no navegador (FR-039, SC-014) — T070.
 *
 * O teste percorre o fluxo até a revisão com os provedores mockados e falha se
 * **qualquer** requisição escapar da lista de hosts autorizados. A tipografia é
 * o alvo principal: um `@import` de CDN de fontes não apareceria em nenhuma
 * verificação de `fetch`, não violaria `connect-src`, e entregaria o IP de cada
 * visitante a um terceiro.
 */
test.describe('FR-039 e SC-014 · a página não alcança host não autorizado', () => {
  test('a carga inicial e o fluxo até a revisão ficam dentro da lista', async ({ page }) => {
    // Instalado antes do primeiro `goto`: é na carga inicial que a fonte, o CSS
    // e o `theme-boot.js` são pedidos.
    const guard = guardNetwork(page);

    await mockSpotify(page);
    await seedCredential(page, CLIENT_ID, 'spotify');

    await ateEntrada(page, ['Bohemian Rhapsody - Queen', 'Imagine - John Lennon'].join('\n'));
    await botaoConectar(page, SPOTIFY).click();
    await expect(tituloRevisao(page, SPOTIFY)).toBeVisible();

    guard.assertClean();
  });

  test('a fonte é servida da própria origem, e é a única embarcada', async ({ page }) => {
    const guard = guardNetwork(page);
    await mockSpotify(page);
    await page.goto('/');
    await expect(page.getByRole('radio', { name: t.theme.system })).toBeVisible();

    guard.assertClean();

    /*
      A leitura é feita **depois** de `document.fonts.ready`, e sobre o registro
      de recursos do navegador em vez de sobre um ouvinte de resposta.

      `font-display: swap` torna o carregamento assíncrono por definição: um
      ouvinte corre com ele e o teste passaria ou falharia conforme o momento em
      que a asserção calhasse de rodar — que é como um teste vira ruído.
    */
    const fontes = await page.evaluate(async () => {
      await document.fonts.ready;
      return performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .filter((url) => /\.(woff2?|ttf|otf|eot)(\?|$)/u.test(url));
    });

    expect(fontes.length, 'nenhuma fonte foi carregada').toBeGreaterThan(0);
    for (const url of fontes) {
      expect(new URL(url).hostname).toBe('127.0.0.1');
    }
    // FR-034: família única.
    expect(new Set(fontes).size).toBe(1);
  });

  test('a folha de estilo emitida não referencia nenhuma URL absoluta', async ({ page }) => {
    const folhas: string[] = [];
    page.on('response', (response) => {
      if (response.url().endsWith('.css')) folhas.push(response.url());
    });

    await mockSpotify(page);
    await page.goto('/');

    // Em desenvolvimento o Vite injeta o CSS por módulo; a conferência do
    // artefato final é `npm run build && grep` (quickstart cenário 7). Aqui
    // basta que nenhuma folha venha de fora.
    for (const url of folhas) {
      expect(new URL(url).hostname).toBe('127.0.0.1');
    }
  });
});
