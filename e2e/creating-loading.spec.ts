import { expect, test, type Locator, type Page } from '@playwright/test';

import { t } from '../src/i18n/pt-BR';
import { ateRevisao, botaoCriar, fmt, SPOTIFY, tituloResultado } from './support/flow';
import { mockSpotify, seedCredential } from './support/spotify-mock';

/**
 * A fase de criação, medida — 009/FR-007, FR-010, FR-016, FR-029 e os SC-003,
 * SC-004, SC-006.
 *
 * ## Por que este arquivo existe, sendo que há testes de componente
 *
 * O SC-004 é uma promessa **geométrica**: quando o resultado chega, o cabeçalho
 * e o título do cartão não se movem. Isso não é verificável sem layout de
 * verdade — `happy-dom` não calcula caixa, e uma asserção de estrutura passaria
 * com o título a vinte pixels de distância.
 *
 * A diferença exigida é **0**, e não uma tolerância. Um critério de sucesso com
 * tolerância negociável é um critério que não falha (009/research §R3).
 */

const LISTA = ['Bohemian Rhapsody - Queen', 'Imagine - John Lennon'].join('\n');

const NOME_DA_PLAYLIST = 'Clássicos do Rock';

/** O cabeçalho do cartão de fase — o mesmo nó de DOM nos dois estados. */
function cabecalhoDoCartao(page: Page): Locator {
  return page.locator('section.app-card > header').first();
}

/** O título do cartão: um `<p>` durante a criação, o `<h2>` depois. */
function tituloEmCriacao(page: Page): Locator {
  return page.getByText(fmt(t.playlistConfig.creating, { service: SPOTIFY }), { exact: true });
}

async function topoDe(alvo: Locator): Promise<number> {
  const caixa = await alvo.boundingBox();
  if (caixa === null) throw new Error('o elemento medido não tem caixa');
  return caixa.y;
}

/**
 * Segura a adição de faixas até que o teste solte, mantendo a tela na fase de
 * criação pelo tempo necessário para medir.
 *
 * A rota é registrada **depois** de `mockSpotify`, e por isso vence; o
 * `fallback()` devolve o controle ao mock, que responde como sempre. Sem isso a
 * criação de duas linhas termina em milissegundos e não há o que medir.
 */
async function segurarAdicao(page: Page): Promise<() => void> {
  let soltar: () => void = () => undefined;
  const portao = new Promise<void>((resolve) => {
    soltar = resolve;
  });

  await page.route('https://api.spotify.com/v1/playlists/*/tracks', async (route) => {
    await portao;
    await route.fallback();
  });

  return soltar;
}

/**
 * O estado visível dos dois movimentos contínuos, num instante.
 *
 * **Por que não `document.getAnimations()`.** Foi a primeira tentativa, e ela é
 * intermitente: a biblioteca alterna entre WAAPI e um relógio em JavaScript
 * conforme o valor e o navegador, e o que roda pelo segundo caminho não aparece
 * naquela lista. Uma sonda que às vezes enxerga o movimento reprova o teste sem
 * que nada esteja errado — e, pior, faria a asserção de **ausência** do SC-003
 * passar vazia.
 *
 * O que este par mede é o que a pessoa vê: a rotação do glifo e a opacidade da
 * primeira barra. Amostrado duas vezes, ele responde a pergunta certa — "isto se
 * move?" — sem depender de por qual motor.
 */
async function assinaturaDoMovimento(page: Page): Promise<string> {
  return page.evaluate(() => {
    const giro = document.querySelector('section.app-card .bg-accent-tint-surface span');
    const barra = document.querySelector('section.app-card .bg-skeleton');
    if (giro === null || barra === null) throw new Error('o cartão de carregamento não está na tela');
    return `${getComputedStyle(giro).transform} | ${getComputedStyle(barra).opacity}`;
  });
}

/**
 * Quanto esperar antes de afirmar que **nada** se moveu.
 *
 * Não há evento a aguardar aqui: o que se espera é a **não-ocorrência** de algo.
 * O giro dá uma volta por segundo e a pulsação um ciclo a cada 1,2s, de modo que
 * este intervalo cobre com folga qualquer deslocamento perceptível — e é por
 * isso que ele é o único tempo fixo do arquivo.
 */
const JANELA_DE_OBSERVACAO = 600;

async function ateACriacao(page: Page): Promise<() => void> {
  await mockSpotify(page);
  await seedCredential(page);
  await ateRevisao(page, LISTA, SPOTIFY);

  const soltar = await segurarAdicao(page);

  await page.getByLabel(t.playlistConfig.nameLabel).fill(NOME_DA_PLAYLIST);
  await botaoCriar(page, SPOTIFY).click();

  await expect(tituloEmCriacao(page)).toBeVisible();
  return soltar;
}

test.describe('SC-004 — o cabeçalho e o título não se movem quando o resultado chega', () => {
  test('o deslocamento vertical é zero, não uma tolerância', async ({ page }) => {
    test.skip(
      test.info().project.name !== 'desktop',
      'A medição de pixel é do projeto `desktop`: as outras larguras verificam outra coisa.',
    );

    const soltar = await ateACriacao(page);

    // Durante a criação.
    const cabecalhoAntes = await topoDe(cabecalhoDoCartao(page));
    const tituloAntes = await topoDe(tituloEmCriacao(page));

    soltar();
    await expect(tituloResultado(page, SPOTIFY)).toBeVisible();

    // Imediatamente depois de o resultado aparecer.
    const cabecalhoDepois = await topoDe(cabecalhoDoCartao(page));
    const tituloDepois = await topoDe(tituloResultado(page, SPOTIFY));

    expect(
      cabecalhoDepois - cabecalhoAntes,
      'O cabeçalho do cartão é o **mesmo nó de DOM** nos dois estados desde a 009. ' +
        'Qualquer deslocamento aqui significa que a árvore voltou a bifurcar por `result`.',
    ).toBe(0);

    expect(
      tituloDepois - tituloAntes,
      'O topo do título coincide por aritmética (009/contracts/loading-card.md §3): a linha ' +
        'do indicador e o `StepHeading` são ambos o 2º filho do cartão, depois do mesmo ' +
        'cabeçalho e do mesmo respiro.',
    ).toBe(0);
  });
});

test.describe('FR-014 e FR-015 — sem a preferência, a tela de fato se move', () => {
  test('o giro e a pulsação estão rodando durante a criação', async ({ page }) => {
    /*
      **O contrapeso do SC-003.** Uma asserção de que "nada anima" sob movimento
      reduzido não vale nada se nada animasse nunca — ela passaria com as três
      primitivas apagadas. Este caso é o que impede o par de virar vácuo: sem a
      preferência, o navegador precisa ter animação em execução.
    */
    test.skip(
      test.info().project.name !== 'desktop',
      'O projeto `reduced-motion` é o outro lado deste par; os dois medem a mesma coisa.',
    );

    const soltar = await ateACriacao(page);

    await expect(page.getByText(t.result.creatingSubtitle)).toBeVisible();

    const partida = await assinaturaDoMovimento(page);

    // `poll` porque a biblioteca agenda o início no quadro seguinte à montagem:
    // uma leitura única corre com esse quadro.
    await expect
      .poll(() => assinaturaDoMovimento(page), {
        message:
          'Nem o glifo girou nem a barra mudou de opacidade durante a criação. Sem movimento ' +
          'aqui, o caso irmão no projeto `reduced-motion` passa vazio — ele afirma a ausência ' +
          'de algo que precisa existir para ser suprimido.',
      })
      .not.toBe(partida);

    soltar();
    await expect(tituloResultado(page, SPOTIFY)).toBeVisible();
  });
});

test.describe('FR-007, FR-029 e SC-006 — a grade cabe em toda largura', () => {
  test('uma coluna e nenhuma rolagem horizontal em 375 px', async ({ page }) => {
    test.skip(
      test.info().project.name !== 'narrow-375',
      'O projeto `narrow-375` é quem exercita esta largura.',
    );

    const soltar = await ateACriacao(page);

    await expect(page.getByText(t.result.creatingSubtitle)).toBeVisible();

    const colunas = await colunasDaGrade(page);
    expect(colunas, 'Abaixo de `sm` a grade colapsa em uma coluna, como o `<dl>` já fazia').toBe(1);
    await semRolagemHorizontal(page);

    soltar();
    await expect(tituloResultado(page, SPOTIFY)).toBeVisible();
  });

  test('os dois extremos que o FR-029 nomeia: 320 px e 1920 px', async ({ page }) => {
    /*
      Os dois extremos que nenhum projeto do Playwright exercita. 320 é onde o
      `sm:` colapsa e o cartão fica mais apertado; 1920 é onde a coluna de
      conteúdo para de crescer e o cartão não deve esticar sozinho.

      Por `setViewportSize` dentro do teste, e não por dois projetos novos,
      porque a asserção é sobre **esta tela** e não sobre o fluxo inteiro.
    */
    test.skip(
      test.info().project.name !== 'desktop',
      'Um projeto só precisa varrer os extremos; rodar nos três seria a mesma medida três vezes.',
    );

    const soltar = await ateACriacao(page);

    await page.setViewportSize({ width: 320, height: 800 });
    await expect(page.getByText(t.result.creatingSubtitle)).toBeVisible();
    expect(await colunasDaGrade(page)).toBe(1);
    await semRolagemHorizontal(page);

    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.getByText(t.result.creatingSubtitle)).toBeVisible();
    expect(await colunasDaGrade(page)).toBe(2);
    await semRolagemHorizontal(page);

    soltar();
    await expect(tituloResultado(page, SPOTIFY)).toBeVisible();
  });
});

test.describe('SC-003 — movimento reduzido não custa nenhuma informação', () => {
  test('a fase de criação inteira, sem animação e com todo o conteúdo presente', async ({
    page,
  }) => {
    test.skip(
      test.info().project.name !== 'reduced-motion',
      'O projeto `reduced-motion` é quem declara a preferência no contexto.',
    );

    const soltar = await ateACriacao(page);

    // Todo texto continua presente: o estado "criação em curso" está escrito em
    // três lugares e não depende de movimento em nenhum (FR-017).
    await expect(page.getByText(t.result.creatingSubtitle)).toBeVisible();
    await expect(
      page.getByText(fmt(t.result.creatingDescription, { service: SPOTIFY })),
    ).toBeVisible();
    await expect(
      page.getByText(fmt(t.result.awaitingConfirmation, { service: SPOTIFY })),
    ).toBeVisible();

    /*
      **Nada se move.** A mesma sonda do caso irmão no projeto `desktop`, com o
      desfecho invertido: lá a assinatura precisa mudar dentro da janela, aqui
      precisa ficar idêntica.

      A janela antes da segunda leitura não é zelo. Sem ela, a asserção mediria o
      quadro em que nada tinha começado ainda e passaria vazia — que é o pior
      modo de falha possível para um critério de ausência.
    */
    const partida = await assinaturaDoMovimento(page);
    await page.waitForTimeout(JANELA_DE_OBSERVACAO);

    expect(
      await assinaturaDoMovimento(page),
      'Alguém pediu para reduzir movimento e a tela se moveu assim mesmo. Cada primitiva de ' +
        '`src/ui/motion/` precisa consultar `useReducedMotion()` — não existe interruptor ' +
        'de cima que sirva: a regra de CSS não alcança a biblioteca, e ' +
        '`MotionConfig reducedMotion="user"` preserva a `opacity` que o FR-016 manda ' +
        'suprimir (009/research §R6).',
    ).toBe(partida);

    soltar();
    await expect(tituloResultado(page, SPOTIFY)).toBeVisible();

    // A troca também acontece sem transição, e o resultado chega inteiro.
    // `exact` porque o caminho efetivo termina com o mesmo nome.
    await expect(page.getByText(NOME_DA_PLAYLIST, { exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => document.querySelectorAll('section.app-card .absolute').length),
      'A fusão cruzada é sobreposição, e sob a preferência ela não deve acontecer: a troca é ' +
        'em um quadro (FR-016).',
    ).toBe(0);
  });
});

/** Quantas colunas a grade — de esqueleto ou de resultado — está exibindo. */
async function colunasDaGrade(page: Page): Promise<number> {
  return page.evaluate(() => {
    const grade = document.querySelector('section.app-card .grid');
    if (grade === null) throw new Error('a grade não está na tela');
    return getComputedStyle(grade).gridTemplateColumns.split(' ').length;
  });
}

/**
 * Nenhuma rolagem horizontal — no documento e em cada contêiner rolável.
 *
 * Medir só o `documentElement` ficou cego desde que a casca passou a ocupar a
 * janela e a rolagem foi entregue ao contêiner da área principal: um conteúdo
 * largo demais produziria barra dentro dele, e o documento continuaria
 * reportando `scrollWidth === clientWidth`. É a mesma varredura de
 * `narrow-viewport.spec.ts`.
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
