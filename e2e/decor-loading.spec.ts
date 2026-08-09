import { expect, test, type Page } from '@playwright/test';

import { t } from '../src/i18n/pt-BR';
import { CLIENT_ID, mockSpotify, seedCredential } from './support/spotify-mock';

/**
 * A decoração não atrapalha (007/FR-050, FR-068, FR-070; SC-014, SC-019, SC-020).
 *
 * ## Por que este arquivo existe
 *
 * FR-069 recusou explicitamente um teto de peso para a decoração, e a primeira
 * visita transfere cerca de 930 KB — 617 KB só de fundo ambiente. A decisão está
 * registrada no **Complexity Tracking** do plano, com a consequência conhecida.
 *
 * O que ela torna obrigatório é a contrapartida: se não há limite de tamanho, a
 * garantia precisa ser de **comportamento**. Estes casos são essa garantia, e
 * eles falham se alguém puser um recurso decorativo no caminho crítico — o que
 * é fácil de fazer sem perceber, porque em rede rápida a diferença não aparece.
 */

/** Segura toda imagem até ser liberada, simulando rede lenta só para elas. */
function segurarImagens(page: Page): { liberar: () => void } {
  const presas: Array<() => void> = [];
  let liberado = false;

  void page.route('**/*.{png,jpg,jpeg,webp,avif}', async (route) => {
    if (liberado) {
      await route.continue();
      return;
    }
    await new Promise<void>((resolve) => {
      presas.push(resolve);
    });
    await route.continue();
  });

  return {
    liberar: () => {
      liberado = true;
      for (const soltar of presas) soltar();
    },
  };
}

test.describe('SC-019 · o conteúdo é legível e operável antes da decoração', () => {
  test('a etapa inicial funciona com as imagens ainda presas', async ({ page }) => {
    const decoracao = segurarImagens(page);

    await mockSpotify(page);
    await seedCredential(page, CLIENT_ID, 'spotify');
    await page.goto('/');

    // Com **nenhuma** imagem entregue, a etapa já está inteira: título, campo e
    // a ação que leva adiante.
    await expect(page.getByRole('heading', { name: t.credential.heading })).toBeVisible();
    await expect(page.getByRole('banner')).toBeVisible();

    const avancar = page.getByRole('button', { name: t.common.next, exact: true });
    await expect(avancar).toBeEnabled();
    await avancar.click();

    // E o fluxo avança: operável, não só legível.
    await expect(page.getByRole('heading', { name: t.destinations.heading })).toBeVisible();

    decoracao.liberar();
  });

  test('a etapa de Destinos funciona com a fotografia e os adesivos presos', async ({ page }) => {
    // Destinos é a etapa mais carregada de decoração: fotografia de clima mais
    // onze adesivos, todos no painel lateral.
    const decoracao = segurarImagens(page);

    await mockSpotify(page);
    await seedCredential(page, CLIENT_ID, 'spotify');
    await page.goto('/');
    await page.getByRole('button', { name: t.common.next, exact: true }).click();

    await expect(page.getByRole('heading', { name: t.destinations.heading })).toBeVisible();
    await expect(
      page.getByRole('group', { name: t.destinations.groupLabel }).getByRole('checkbox').first(),
    ).toBeVisible();

    decoracao.liberar();
  });
});

test.describe('SC-020 · nada se desloca quando o recurso chega', () => {
  test('a posição do conteúdo é a mesma antes e depois da decoração', async ({ page }) => {
    const decoracao = segurarImagens(page);

    await mockSpotify(page);
    await seedCredential(page, CLIENT_ID, 'spotify');
    await page.goto('/');
    await page.getByRole('button', { name: t.common.next, exact: true }).click();

    const titulo = page.getByRole('heading', { name: t.destinations.heading });
    await expect(titulo).toBeVisible();
    const antes = await titulo.boundingBox();

    decoracao.liberar();

    // Espera as imagens realmente terminarem, e não apenas serem liberadas.
    await page.waitForFunction(() => [...document.images].every((img) => img.complete));

    const depois = await titulo.boundingBox();

    expect(antes, 'o título não foi medido antes').not.toBeNull();
    expect(depois, 'o título não foi medido depois').not.toBeNull();
    /*
      A caixa da decoração é pré-dimensionada — `aspect-video` na fotografia,
      camada fixa no fundo ambiente — justamente para que a chegada não empurre
      nada (FR-070). Uma folga de 1px absorve arredondamento de layout.
    */
    expect(Math.abs((depois?.y ?? 0) - (antes?.y ?? 0))).toBeLessThanOrEqual(1);
    expect(Math.abs((depois?.x ?? 0) - (antes?.x ?? 0))).toBeLessThanOrEqual(1);
  });
});

test.describe('SC-014 · sem imagem alguma, a tela continua utilizável', () => {
  test('todas as etapas permanecem completas com as imagens abortadas', async ({ page }) => {
    // Não é rede lenta: é ausência definitiva, como um bloqueador de imagens ou
    // uma conexão que desistiu. A tela não pode ficar com buraco.
    await page.route('**/*.{png,jpg,jpeg,webp,avif}', (route) => route.abort());

    await mockSpotify(page);
    await seedCredential(page, CLIENT_ID, 'spotify');
    await page.goto('/');

    await expect(page.getByRole('heading', { name: t.credential.heading })).toBeVisible();
    await page.getByRole('button', { name: t.common.next, exact: true }).click();

    await expect(page.getByRole('heading', { name: t.destinations.heading })).toBeVisible();

    /*
      A indicação de etapa continua presente — trilha em largura ampla, resumo
      compacto abaixo do ponto de corte. Qual das duas depende da janela, e este
      caso roda nos dois projetos; o que ele afirma é que **uma** delas existe,
      não qual.
    */
    const trilhas = await page.getByRole('navigation', { name: t.rail.title }).count();
    const resumos = await page.getByRole('region', { name: t.rail.title }).count();
    expect(trilhas + resumos, 'nem trilha nem resumo sem as imagens').toBe(1);

    await page.getByRole('button', { name: t.common.next, exact: true }).click();

    await expect(page.getByRole('heading', { name: t.input.heading })).toBeVisible();
    await expect(page.getByLabel(t.input.textareaLabel)).toBeEditable();

    // Nenhuma rolagem horizontal por causa de caixa vazia mal dimensionada.
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
  });
});

test.describe('FR-035 e SC-013 · a decoração é invisível a tecnologia assistiva', () => {
  test('nenhuma imagem decorativa é anunciada', async ({ page }) => {
    await mockSpotify(page);
    await seedCredential(page, CLIENT_ID, 'spotify');
    await page.goto('/');
    await page.getByRole('button', { name: t.common.next, exact: true }).click();
    await expect(page.getByRole('heading', { name: t.destinations.heading })).toBeVisible();

    /*
      A marca da barra superior também é decorativa: o nome do produto está
      escrito ao lado, e anunciar os dois faria o leitor ouvir a marca duas
      vezes. Toda imagem desta aplicação é decoração — nenhuma carrega
      informação que não exista em texto — exceto as capas de álbum da revisão,
      que têm `alt` descritivo e não aparecem nesta etapa.
    */
    const anunciadas = await page.evaluate(() =>
      [...document.images]
        .filter((img) => {
          // `alt=""` é a marcação canônica de decorativo: ela retira a imagem da
          // árvore de acessibilidade. Um `aria-hidden` no ancestral faz o mesmo
          // pelo ramo inteiro. Qualquer das duas basta; exigir as duas seria
          // cobrar redundância, não acessibilidade.
          if (img.getAttribute('alt') === '') return false;
          return img.closest('[aria-hidden="true"]') === null;
        })
        .map((img) => img.getAttribute('src') ?? '(sem src)'),
    );

    expect(anunciadas, `imagens decorativas anunciadas: ${anunciadas.join(', ')}`).toEqual([]);
  });
});
