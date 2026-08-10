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

  /**
   * 007/FR-048, FR-057 e SC-012 — a decoração e os ícones também.
   *
   * O arquivo de design buscava o fundo ambiente de uma URL de terceiro, e a
   * transcrição literal a teria trazido junto. A textura foi produzida e
   * versionada localmente; `react-icons` é empacotada, nunca buscada.
   *
   * O caso existe porque um `<img src="https://…">` decorativo **não** violaria
   * `connect-src`, não apareceria em verificação de `fetch`, e entregaria o IP
   * de cada visitante a um terceiro em silêncio — exatamente o modo de falha que
   * a tipografia já tinha e que o teste acima fecha.
   */
  test('imagem decorativa e ícone vêm da própria origem', async ({ page }) => {
    const guard = guardNetwork(page);

    await mockSpotify(page);
    await seedCredential(page, CLIENT_ID, 'spotify');
    await page.goto('/');

    // Até Destinos, que é onde vivem a fotografia de clima e os onze adesivos.
    await page.getByRole('button', { name: t.common.next, exact: true }).click();
    await expect(page.getByRole('heading', { name: t.destinations.heading })).toBeVisible();

    guard.assertClean();

    const imagens = await page.evaluate(() =>
      [...document.images].map((img) => img.currentSrc || img.src).filter((src) => src !== ''),
    );

    expect(imagens.length, 'nenhuma imagem foi carregada nesta etapa').toBeGreaterThan(0);
    for (const src of imagens) {
      // `data:` é local por definição; o resto precisa vir do próprio servidor.
      if (src.startsWith('data:')) continue;
      expect(new URL(src).hostname, `imagem de origem remota: ${src}`).toBe('127.0.0.1');
    }

    // Os ícones são SVG embutido no pacote — nenhum recurso de fonte de ícone
    // nem folha externa é buscado por causa deles (FR-057).
    const recursosDeIcone = await page.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .filter((url) => /icon|fontawesome|material-icons/iu.test(url)),
    );
    for (const url of recursosDeIcone) {
      expect(new URL(url).hostname).toBe('127.0.0.1');
    }
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
