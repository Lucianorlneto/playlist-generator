import { expect, test, type Page } from '@playwright/test';

import { t } from '../src/i18n/pt-BR';
import {
  aguardarTransicao,
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

/**
 * Nenhuma rolagem horizontal — **no documento e em cada contêiner rolável**.
 *
 * Medir só o `documentElement` bastava enquanto a página inteira rolava. Desde
 * que a casca passou a ocupar a janela e a rolagem foi entregue ao contêiner da
 * área principal, essa medição sozinha ficou **cega**: um conteúdo largo demais
 * produziria barra horizontal dentro daquele contêiner, e o documento continuaria
 * reportando `scrollWidth === clientWidth`. O teste passaria vazio, que é pior do
 * que não existir.
 *
 * A varredura cobre todo elemento cujo `overflow-x` computado permite rolar,
 * mais o documento.
 */
async function semRolagemHorizontal(page: Page): Promise<void> {
  const estouros = await page.evaluate(() => {
    const alvos: { onde: string; scrollWidth: number; clientWidth: number }[] = [];

    const doc = document.documentElement;
    alvos.push({ onde: 'documento', scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth });

    for (const node of document.querySelectorAll('*')) {
      const overflowX = getComputedStyle(node).overflowX;
      if (overflowX !== 'auto' && overflowX !== 'scroll') continue;
      alvos.push({
        onde: `${node.tagName.toLowerCase()}.${node.className.toString().split(' ')[0] ?? ''}`,
        scrollWidth: node.scrollWidth,
        clientWidth: node.clientWidth,
      });
    }

    // Uma folga de 1 px absorve arredondamento de layout.
    return alvos.filter((alvo) => alvo.scrollWidth > alvo.clientWidth + 1);
  });

  expect(
    estouros,
    `Rolagem horizontal em: ${estouros
      .map((e) => `${e.onde} (${String(e.scrollWidth)} > ${String(e.clientWidth)})`)
      .join(', ')}`,
  ).toEqual([]);
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

    /*
      A posição na fila é mais um elemento na largura: precisa caber junto do
      resto.

      **O portador mudou na 008, a garantia não** (008/FR-013, SC-009). Ela era
      um `QueueIndicator` com `aria-label` no topo da etapa de serviço, e passou
      a ser dita pela linha de contexto do cabeçalho. A asserção continua sendo
      "a posição está visível nesta largura", e deixou de supor qual elemento a
      carrega.
    */
    await expect(
      page.getByText(fmt(t.queue.position, { service: SPOTIFY, current: 1, total: 2 })),
    ).toBeVisible();

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

/**
 * 007/FR-037, FR-038, FR-054 e SC-007 — a casca de três zonas em tela estreita.
 *
 * Abaixo de `--breakpoint-shell` a trilha **não é renderizada**: o `StepSummary`
 * toma o seu lugar no topo do conteúdo, e a ação de recomeçar migra para a barra
 * superior. Estes casos existem porque a migração da ação é o tipo de detalhe
 * que some silenciosamente — o comando continua no código, deixa de aparecer no
 * telefone, e nenhum teste de componente percebe.
 */
test.describe('007 — a casca colapsada', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  async function ateEntrada(page: Page): Promise<void> {
    await mockSpotify(page);
    await seedCredential(page, CLIENT_ID, 'spotify');
    await page.goto('/');
    await page.getByRole('button', { name: t.common.next, exact: true }).click();
    await page.getByRole('button', { name: t.common.next, exact: true }).click();
    /*
      A 010 deu direção à troca de etapa: por 200ms a tela que sai continua em
      cena, fora do fluxo. Ela não desloca nada, mas **estende a área rolável**
      do contêiner enquanto existe — um descendente `position: absolute` conta
      para o `scrollHeight` do bloco que o contém.

      Estas asserções são sobre o **repouso**, e sempre foram; sem esta espera
      elas passariam a medir a soma das duas telas
      (`010/contracts/surfaces.md` §1.1).
    */
    await aguardarTransicao(page);
  }

  test('a trilha some e o resumo compacto aparece', async ({ page }) => {
    await ateEntrada(page);

    await expect(page.getByRole('navigation', { name: t.rail.title })).toHaveCount(0);

    const resumo = page.getByRole('region', { name: t.rail.title });
    await expect(resumo).toBeVisible();
    await expect(resumo).toContainText(t.steps.input);
    await expect(resumo).toContainText(/Etapa \d+ de \d+/u);

    // FR-041: a posição continua anunciada **uma única vez**.
    await expect(page.locator('[aria-current="step"]')).toHaveCount(1);
    await semRolagemHorizontal(page);
  });

  test('a barra superior permanece, com os dois chips de conexão', async ({ page }) => {
    await ateEntrada(page);

    const barra = page.getByRole('banner');
    await expect(barra).toBeVisible();
    // "Estou conectado?" continua respondida sem navegação, no telefone também.
    await expect(barra.getByLabel(/^Spotify:/u)).toBeVisible();
    await expect(barra.getByLabel(/^YouTube:/u)).toBeVisible();
    await semRolagemHorizontal(page);
  });

  test('FR-054 · recomeçar migra para a barra superior e continua pedindo confirmação', async ({
    page,
  }) => {
    await ateEntrada(page);
    await page.getByLabel(t.input.textareaLabel).fill('Bohemian Rhapsody - Queen');

    const recomecar = page.getByRole('banner').getByRole('button', { name: t.flow.reset });
    await expect(recomecar).toBeVisible();
    await expect(page.getByRole('button', { name: t.flow.reset })).toHaveCount(1);

    // O comportamento da 006 permanece intacto: o botão não descarta, pergunta.
    await recomecar.click();
    await expect(page.getByText(t.flow.resetTitle)).toBeVisible();
    await page.getByRole('button', { name: t.common.cancel }).click();
    await expect(page.getByLabel(t.input.textareaLabel)).toHaveValue(
      'Bohemian Rhapsody - Queen',
    );
  });

  /**
   * SC-007 de ponta a ponta: **de 320 px a 1920 px**, nenhuma rolagem horizontal.
   *
   * A varredura cobre as duas larguras da casca e o próprio ponto de corte, que
   * é onde a troca acontece e onde um erro de 1px se manifestaria.
   */
  test('nenhuma rolagem horizontal de 320px a 1920px', async ({ page }) => {
    await ateEntrada(page);
    await page.getByLabel(t.input.textareaLabel).fill(LISTA);

    const trilha = page.getByRole('navigation', { name: t.rail.title });
    const resumo = page.getByRole('region', { name: t.rail.title });

    // 64rem × 16px = 1024px. Abaixo disso a casca colapsa; a partir daí, não.
    const CORTE = 1024;

    for (const width of [320, 375, 414, 768, 1023, CORTE, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 800 });
      await expect(page.getByRole('banner')).toBeVisible();

      /*
        Asserções que reesperam, e não leitura direta de `count()`.

        A troca entre trilha e resumo passa por um `change` de `matchMedia` e uma
        re-renderização do React — nenhum dos dois é síncrono com
        `setViewportSize`. Uma contagem lida no instante seguinte pega o estado
        anterior, e o teste falharia por corrida em vez de por layout errado.
      */
      const estreito = width < CORTE;
      await expect(trilha, `trilha na largura errada em ${String(width)}px`).toHaveCount(
        estreito ? 0 : 1,
      );
      await expect(resumo, `resumo na largura errada em ${String(width)}px`).toHaveCount(
        estreito ? 1 : 0,
      );

      await semRolagemHorizontal(page);
    }
  });

  /**
   * Edge case "Zoom de texto a 200%".
   *
   * Zoom de **texto** e não de página: só o corpo tipográfico cresce, e o layout
   * precisa acomodar. É o cenário em que uma altura travada corta conteúdo — o
   * motivo pelo qual a barra superior usa `min-height` em vez de `height`.
   */
  test('a 200% de zoom de texto as três zonas continuam legíveis e sem corte', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await ateEntrada(page);

    await page.addStyleTag({ content: 'html { font-size: 32px; }' });

    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
    await semRolagemHorizontal(page);

    // Nenhuma zona pode cortar o próprio conteúdo: a altura visível precisa
    // acomodar o que está dentro dela.
    const cortes = await page.evaluate(() => {
      const zonas = [document.querySelector('header'), document.querySelector('main')];
      return zonas
        .filter((el): el is HTMLElement => el !== null)
        .map((el) => ({ tag: el.tagName, corte: el.scrollHeight - el.clientHeight }))
        .filter((z) => z.corte > 1);
    });
    expect(cortes, `zonas com conteúdo cortado: ${JSON.stringify(cortes)}`).toEqual([]);
  });
});
