import { expect, test, type Page } from '@playwright/test';

import { t } from '../src/i18n/pt-BR';
import { aguardarTransicao } from './support/flow';
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
    // Destinos é a etapa mais carregada de decoração: fotografia de clima no
    // painel lateral mais onze adesivos na coluna primária.
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

  /**
   * 008/FR-018 e SC-006 — o painel deixou de ser decoração, e a exigência que
   * sobrevive é esta.
   *
   * A feature 008 revogou a decisão da 007 de manter o painel lateral sem texto:
   * ele passou a carregar a **ordem de execução**, que é informação real. O que
   * **não** foi revogado, e por isso este caso existe, é a regra de que a
   * informação do painel permanece completa sem as imagens.
   *
   * Sem esta asserção, mover a ordem de execução para um painel decorativo
   * trocaria um parágrafo legível por uma informação que some junto com uma
   * fotografia de 400 KB.
   */
  test('008/FR-018 · o painel de ordem de execução é legível sem as imagens', async ({ page }) => {
    const decoracao = segurarImagens(page);

    await mockSpotify(page);
    await seedCredential(page, CLIENT_ID, 'spotify');
    await page.goto('/');
    await page.getByRole('button', { name: t.common.next, exact: true }).click();

    await expect(page.getByRole('heading', { name: t.destinations.heading })).toBeVisible();

    // Cabeçalho, fila, aviso e legenda: os quatro são texto real, e nenhum
    // depende de a fotografia ter chegado.
    //
    // O escopo é o painel, e não a página: o nome do serviço também aparece no
    // chip da barra superior, e um seletor solto encontraria os dois.
    const painel = page.getByRole('complementary');
    await expect(painel.getByRole('heading', { name: t.destinations.panelTitle })).toBeVisible();
    await expect(painel.getByText(t.providers.spotify.name, { exact: true })).toBeVisible();
    await expect(painel.getByText(t.destinations.panelHint)).toBeVisible();
    await expect(painel.getByText(t.destinations.panelCaption)).toBeVisible();

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
    /*
      A 010 deu direção à troca de etapa (010/FR-022): por 200ms o miolo da
      coluna desliza no eixo `x`, e o título vai junto **por desenho**. Sem esta
      espera a medição de "antes" cai dentro da transição, e o caso acusaria o
      movimento certo pelo motivo errado — ele é sobre a chegada da decoração,
      não sobre a troca de etapa.
    */
    await aguardarTransicao(page);
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

test.describe('FR-049 · o fundo ambiente chega à tela', () => {
  /**
   * **O portão que faltava, e que dois defeitos atravessaram.**
   *
   * Os testes acima cobrem tudo o que a decoração **não** pode fazer: bloquear a
   * pintura, deslocar o conteúdo, falar com o leitor de tela. Nenhum deles cobria
   * o oposto — que ela apareça —, e os dois defeitos que passaram foram
   * exatamente desse tipo:
   *
   * 1. a casca declarava `bg-bg`, e o fundo opaco de um descendente de bloco em
   *    fluxo é pintado **depois** de um contexto de empilhamento negativo. A
   *    textura ficava inteiramente coberta;
   * 2. `Ambient Backdrop.png` já traz os 22% do arquivo de design no canal alfa,
   *    e o CSS aplicava outros 22% por cima. Contada duas vezes, a textura
   *    entregava 4,8%.
   *
   * Os dois são invisíveis a qualquer verificação estrutural: a imagem carrega,
   * tem o tamanho certo, a classe certa e o tratamento por tema certo. Só o pixel
   * denuncia — e por isso a asserção é sobre o pixel composto.
   */
  /**
   * **O limiar é por tema, e a assimetria é física, não descuido.**
   *
   * A arte é neon claro — rosa, branco, verde-água. Sobre o quase-preto ela tem
   * todo o espaço para deslocar a cor; sobre o off-white do tema Papel, quase
   * nenhum, porque partida e chegada estão do mesmo lado da escala. Exigir o
   * mesmo número dos dois seria exigir do claro algo que a aritmética não
   * permite — e a resposta a isso seria clarear o papel, não a decoração.
   */
  const DISTANCIA_MINIMA = { light: 8, dark: 25 } as const;

  for (const tema of ['light', 'dark'] as const) {
    test(`no tema ${tema} a textura contribui cor de verdade sobre \`--bg\``, async ({ page }) => {
      await page.addInitScript((preferencia) => {
        window.localStorage.setItem(
          'tp.v2.theme',
          JSON.stringify({ schemaVersion: 2, preference: preferencia }),
        );
      }, tema);
      await mockSpotify(page);
      await seedCredential(page, CLIENT_ID, 'spotify');
      await page.goto('/');
      await expect(page.getByRole('heading', { name: t.credential.heading })).toBeVisible();

      const textura = page.locator('.ambient-backdrop');
      await expect(textura).toBeVisible();
      // A imagem precisa ter chegado; sem isso a medição abaixo mediria `--bg`
      // puro e passaria a acusar o defeito errado.
      await expect
        .poll(async () => textura.evaluate((node: HTMLImageElement) => node.complete))
        .toBe(true);

      const caixa = await textura.boundingBox();
      expect(caixa, 'a textura não ocupa área na tela').not.toBeNull();

      const foto = (await page.screenshot()).toString('base64');
      const { substrato, amostras } = await page.evaluate(
        async ([b64, x, y, w]) => {
          const imagem = new Image();
          imagem.src = 'data:image/png;base64,' + (b64 as string);
          await imagem.decode();
          const tela = document.createElement('canvas');
          tela.width = imagem.width;
          tela.height = imagem.height;
          const ctx = tela.getContext('2d')!;
          ctx.drawImage(imagem, 0, 0);

          const ler = (px: number, py: number): [number, number, number] => {
            const d = ctx.getImageData(px, py, 1, 1).data;
            return [d[0]!, d[1]!, d[2]!];
          };

          /*
            Uma varredura pela **largura inteira** do topo da área principal, e
            não três pontos vizinhos: a fotografia tem regiões que por acaso
            coincidem com o substrato — o branco do neon sobre o off-white é a
            mais óbvia —, e amostrar um punhado de pixels próximos mede o acaso
            em vez da presença. A 12 px do topo o esmaecimento é mais fraco e
            ainda não há conteúdo: a coluna de leitura começa depois da goteira.
          */
          const largura = w as number;
          return {
            substrato: getComputedStyle(document.body).backgroundColor,
            amostras: Array.from({ length: 9 }, (_, i) =>
              ler(
                Math.round((x as number) + largura * (0.05 + (i * 0.9) / 8)),
                Math.round((y as number) + 12),
              ),
            ),
          };
        },
        [foto, caixa!.x, caixa!.y, caixa!.width] as const,
      );

      const [rBase, gBase, bBase] = substrato.match(/\d+/gu)!.map(Number) as [
        number,
        number,
        number,
      ];

      const distancias = amostras.map(
        ([r, g, b]) => Math.abs(r - rBase) + Math.abs(g - gBase) + Math.abs(b - bBase),
      );

      expect(
        Math.max(...distancias),
        `o fundo ambiente não se distingue de --bg em ponto nenhum do topo (${substrato}); ` +
          `distâncias medidas: ${distancias.join(', ')}`,
      ).toBeGreaterThan(DISTANCIA_MINIMA[tema]);
    });
  }
});
