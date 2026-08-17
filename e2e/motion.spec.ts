import { expect, test, type Locator, type Page } from '@playwright/test';

import { t } from '../src/i18n/pt-BR';
import { ateRevisao, fmt, SPOTIFY, YOUTUBE } from './support/flow';
import {
  CLIENT_ID as SPOTIFY_CLIENT_ID,
  mockSpotify,
  seedCredential,
} from './support/spotify-mock';
import { YT_CLIENT_ID } from './support/youtube-mock';

/**
 * O sistema de movimento, medido no navegador — 010/FR-021, FR-023, SC-007,
 * SC-008 (`010/contracts/surfaces.md` §7).
 *
 * ## Por que este arquivo existe, sendo que há testes de componente
 *
 * O FR-021 é uma promessa **geométrica**: durante a troca de etapa, nenhuma zona
 * da casca se move. Isso não é verificável sem layout de verdade — `happy-dom`
 * não calcula caixa, e uma asserção estrutural passaria com a trilha
 * escorregando trinta pixels a cada avanço.
 *
 * A diferença exigida é **0**, e não uma tolerância. Um critério de sucesso com
 * tolerância negociável é um critério que não falha (009/research §R3).
 */


/**
 * As zonas da casca **presentes nesta largura**. Nenhuma delas pertence a uma
 * etapa (FR-021).
 *
 * A trilha é filtrada em vez de assumida: abaixo de 64rem a casca colapsa em
 * coluna única e ela vira `StepSummary` no topo do conteúdo (007/FR-037). Exigi-la
 * no projeto `narrow-375` reprovaria um comportamento correto — e assumi-la
 * presente faria o teste medir um `boundingBox` nulo.
 */
async function zonas(
  page: Page,
): Promise<readonly { readonly nome: string; readonly alvo: Locator }[]> {
  const candidatas = [
    { nome: 'barra superior', alvo: page.locator('.zone-topbar') },
    { nome: 'trilha', alvo: page.locator('.zone-rail') },
    { nome: 'barra de ação', alvo: page.getByRole('group', { name: t.actionBar.label }) },
  ];

  const presentes: { readonly nome: string; readonly alvo: Locator }[] = [];
  for (const candidata of candidatas) {
    if ((await candidata.alvo.count()) > 0) presentes.push(candidata);
  }
  // A barra superior e a de ação existem em toda largura; a trilha, não.
  expect(presentes.length).toBeGreaterThanOrEqual(2);
  return presentes;
}

/**
 * Quantas animações o navegador considera **em curso** na página.
 *
 * `getAnimations({ subtree: true })` alcança WAAPI, transição CSS e
 * `@keyframes` — o conjunto inteiro, que é justamente o que uma inspeção de
 * classe não cobriria.
 */
async function animacoesEmCurso(page: Page): Promise<number> {
  return page.evaluate(() => {
    /*
      `getAnimations` aceita `{ subtree: true }` no navegador; a assinatura de
      `Document` no TypeScript da versão instalada ainda não declara o
      parâmetro. O elenco é local e nomeia exatamente o que falta.
    */
    const consultar = document.getAnimations.bind(document) as (opcoes?: {
      subtree?: boolean;
    }) => Animation[];
    return consultar({ subtree: true }).filter((a) => a.playState === 'running').length;
  });
}

interface Caixa {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function caixaDe(alvo: Locator): Promise<Caixa> {
  const caixa = await alvo.boundingBox();
  if (caixa === null) throw new Error('o elemento medido não tem caixa');
  return caixa;
}

/** A coluna principal: o que muda de altura quando a etapa troca. */
function colunaPrincipal(page: Page): Locator {
  return page.locator('main');
}

/**
 * Amostra uma medida a cada quadro enquanto a transição corre.
 *
 * A duração contratada é `base`, 200ms. A janela é folgada de propósito: o que
 * se afirma é que **nenhum** quadro viola a promessa, e amostrar de menos é como
 * um teste geométrico passa sem olhar o momento em que a coisa quebra.
 */
async function amostrar<T>(medir: () => Promise<T>, quadros: number): Promise<T[]> {
  const amostras: T[] = [];
  for (let i = 0; i < quadros; i += 1) {
    amostras.push(await medir());
  }
  return amostras;
}

async function abrirEmDestinos(page: Page): Promise<void> {
  await seedCredential(page, SPOTIFY_CLIENT_ID, 'spotify');
  await seedCredential(page, YT_CLIENT_ID, 'youtube');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: t.credential.heading })).toBeVisible();
}

function avancar(page: Page): Locator {
  return page.getByRole('button', { name: t.common.next, exact: true });
}

function voltar(page: Page): Locator {
  return page.getByRole('button', { name: t.common.back, exact: true });
}

test.describe('US1 · a troca de etapa não move a casca', () => {
  test('FR-021, SC-007 — as três zonas têm caixa idêntica em todos os quadros', async ({
    page,
  }) => {
    await abrirEmDestinos(page);

    const nomes = (await zonas(page)).map((z) => z.nome);
    const antes = await Promise.all((await zonas(page)).map(async (z) => caixaDe(z.alvo)));

    // O clique dispara a transição; as amostras começam no mesmo tique.
    await avancar(page).click();

    const durante = await amostrar(
      async () => Promise.all((await zonas(page)).map(async (z) => caixaDe(z.alvo))),
      12,
    );

    await expect(page.getByRole('heading', { name: t.destinations.heading })).toBeVisible();
    await expect(page.locator('[inert]')).toHaveCount(0);
    const depois = await Promise.all((await zonas(page)).map(async (z) => caixaDe(z.alvo)));

    /*
      **Nenhum quadro difere do estado final.** É a promessa central do FR-021: a
      casca não oscila, não escorrega e não se recompõe enquanto o conteúdo
      transita. Comparar contra o estado final, e não contra o inicial, é o que
      separa "a casca se moveu por causa da transição" de "a etapa nova tem uma
      barra de ação diferente", que é outra coisa.
    */
    for (const quadro of durante) {
      for (const [i, caixa] of quadro.entries()) {
        expect(
          caixa,
          `A zona "${nomes[i] ?? ''}" oscilou durante a transição. Só o miolo da coluna ` +
            'principal transita — a casca é o que dá a sensação de que o aplicativo está ' +
            'parado enquanto o conteúdo troca (FR-021, SC-007).',
        ).toEqual(depois[i]);
      }
    }

    /*
      E as zonas cujo conteúdo **não** depende da etapa são idênticas antes e
      depois, medida a medida.

      A barra de ação fica de fora desta segunda metade, e a exclusão é
      declarada: o conteúdo dela é por etapa desde a 007 (`ACTION_BAR_BY_STEP`),
      e em 375px os botões de Destinos quebram em duas linhas onde os de
      Configuração cabiam em uma. Isso é a etapa nova sendo diferente, não a
      transição movendo a casca — e exigir igualdade ali reprovaria um
      comportamento correto.
    */
    for (const [i, nome] of nomes.entries()) {
      if (nome === 'barra de ação') continue;
      expect(depois[i], `A zona "${nome}" mudou de caixa entre as duas etapas.`).toEqual(antes[i]);
    }
  });

  test('FR-023 — a altura da coluna vai de uma etapa à outra sem passar pela soma nem por zero', async ({
    page,
  }) => {
    await abrirEmDestinos(page);

    const alturaDaCredencial = (await caixaDe(colunaPrincipal(page))).height;

    await avancar(page).click();
    const durante = await amostrar(async () => (await caixaDe(colunaPrincipal(page))).height, 12);
    await expect(page.getByRole('heading', { name: t.destinations.heading })).toBeVisible();
    const alturaDosDestinos = (await caixaDe(colunaPrincipal(page))).height;

    const teto = Math.max(alturaDaCredencial, alturaDosDestinos);
    const piso = Math.min(alturaDaCredencial, alturaDosDestinos);

    for (const altura of durante) {
      /*
        O que o FR-023 proíbe é salto **causado pela transição**: ir à altura do
        maior, ou a zero, e voltar. A altura passa a ser a da etapa que entra já
        no primeiro quadro — o bloco que sai está fora do fluxo e não soma
        (contracts/surfaces.md §1.3).
      */
      expect(altura).toBeGreaterThan(0);
      expect(altura).toBeLessThanOrEqual(teto);
      expect(altura).toBeGreaterThanOrEqual(piso);
      expect(altura).toBeLessThan(alturaDaCredencial + alturaDosDestinos);
    }
  });

  test('FR-017, SC-008 — Tab durante a transição alcança só a etapa nova', async ({ page }) => {
    await abrirEmDestinos(page);

    await avancar(page).click();

    /*
      Sem esperar a animação terminar: é justamente durante os 200ms que existem
      dois conjuntos de controles em cena, e é aí que a árvore que sai teria de
      estar alcançável para a falha aparecer.
    */
    const alcancaveis = await page.evaluate(() => {
      const foco = document.querySelectorAll<HTMLElement>(
        'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      return [...foco]
        .filter((no) => no.closest('[inert]') === null && no.offsetParent !== null)
        .map((no) => no.textContent?.trim() ?? '');
    });

    expect(
      alcancaveis.join(' | '),
      'A árvore que sai é `inert`: sem isso, os controles da etapa anterior continuam ' +
        'alcançáveis por Tab durante a transição, e a contagem muda por 200ms (FR-017).',
    ).not.toContain(t.credential.heading);

    // E o foco já está no cabeçalho da etapa nova, sem esperar quadro nenhum.
    const focado = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? '');
    expect(focado).toBe(t.destinations.heading);
  });

  test('FR-022 — voltar tem direção oposta e a casca continua imóvel', async ({ page }) => {
    await abrirEmDestinos(page);
    await avancar(page).click();
    await expect(page.getByRole('heading', { name: t.destinations.heading })).toBeVisible();

    await voltar(page).click();
    const durante = await amostrar(
      async () => Promise.all((await zonas(page)).map(async (z) => caixaDe(z.alvo))),
      12,
    );

    await expect(page.getByRole('heading', { name: t.credential.heading })).toBeVisible();
    await expect(page.locator('[inert]')).toHaveCount(0);
    const depois = await Promise.all((await zonas(page)).map(async (z) => caixaDe(z.alvo)));

    // Mesma promessa do avanço, no sentido oposto: nenhum quadro difere do
    // estado final.
    for (const quadro of durante) {
      for (const [i, caixa] of quadro.entries()) expect(caixa).toEqual(depois[i]);
    }
  });

  test('FR-025 — o disco da trilha continua legível como um dos três estados', async ({
    page,
  }) => {
    await abrirEmDestinos(page);
    await avancar(page).click();
    await expect(page.getByRole('heading', { name: t.destinations.heading })).toBeVisible();

    /*
      A fusão interpola cor; ela não pode produzir um quadro em que o disco não
      seja legível como preenchido, tingido ou vazado. A distinção é por
      **forma**, e a tabela `DISC_CLASSES` não muda (contracts/surfaces.md §2).
    */
    const trilha = page.locator('.zone-rail');
    /*
      Abaixo de 64rem a trilha vira `StepSummary` no topo do conteúdo
      (007/FR-037), e não há disco a inspecionar. O caso é da trilha; ele não
      finge cobrir a largura em que ela não existe.
    */
    test.skip((await trilha.count()) === 0, 'a trilha não existe em largura estreita');

    await expect(trilha.getByRole('listitem')).toHaveCount(5);
    await expect(trilha.locator('[aria-current="step"]')).toHaveCount(1);
    await expect(trilha).toContainText(t.steps.destinations);
    // Os dois serviços continuam nomeados na trilha depois da troca.
    await expect(page.locator('.zone-topbar')).toContainText(SPOTIFY);
    await expect(page.locator('.zone-topbar')).toContainText(YOUTUBE);
  });
});

/**
 * US2 · a lista de correspondências (FR-017, FR-026, SC-009).
 *
 * O caso do teto de defasagem é **real e agudo** aqui: `search_done` despacha a
 * lista inteira num quadro só, e sem o teto a centésima vigésima linha esperaria
 * 4,8 segundos para aparecer (research §R2, §R7).
 *
 * A fórmula em si é medida sem DOM, em `tests/unit/stagger.spec.ts`. O que só o
 * navegador prova é que as cento e vinte linhas **chegam**, dentro do orçamento,
 * e que a região viva continua anunciando a mesma contagem de sempre.
 */
const LISTA_LONGA = Array.from(
  { length: 120 },
  (_, i) => `Faixa ${String(i + 1)} - Artista ${String(i + 1)}`,
).join('\n');

/** O teto da defasagem (240ms) mais o degrau `base` (200ms), com folga. */
const ORCAMENTO_DA_ENTRADA = 2_000;

test.describe('US2 · a revisão se forma sem fazer ninguém esperar', () => {
  /**
   * A busca das cento e vinte linhas é uma requisição por linha através do mock,
   * e ela **não** é o que se está medindo: o que se mede é a entrada, depois que
   * `search_done` despacha a lista. Por isso a espera pela busca é generosa e a
   * da entrada é apertada — misturar as duas produziria um teste que passa por
   * folga em vez de por acerto.
   */
  const ORCAMENTO_DA_BUSCA = 60_000;

  async function ateAListaCompleta(page: Page): Promise<Locator> {
    await mockSpotify(page);
    await seedCredential(page, SPOTIFY_CLIENT_ID, 'spotify');
    await ateRevisao(page, LISTA_LONGA, SPOTIFY);

    // A busca terminou quando a região viva troca da contagem em curso para a
    // final. É o marco que separa "sem requisição em voo" de "com".
    await expect(
      page.getByText(fmt(t.review.progressDone, { done: 120, total: 120 })),
    ).toBeVisible({ timeout: ORCAMENTO_DA_BUSCA });

    return page.getByRole('list', { name: t.review.listLabel }).getByRole('listitem');
  }

  test('FR-017, SC-009 — cento e vinte linhas entram com a última dentro do teto', async ({
    page,
  }) => {
    test.setTimeout(ORCAMENTO_DA_BUSCA + 30_000);
    const linhas = await ateAListaCompleta(page);

    await expect(linhas).toHaveCount(120);

    /*
      A **última** delas, e não uma qualquer: é ela que o teto protege. Sem o
      teto a defasagem acumulada seria 119 x 40ms = 4,76s, e esta asserção
      falharia por tempo em vez de por ausência (research §R7).
    */
    await expect(linhas.last()).toHaveCSS('opacity', '1', {
      timeout: ORCAMENTO_DA_ENTRADA,
    });
  });

  test('FR-026 — a contagem anunciada pela região viva é a de sempre', async ({ page }) => {
    test.setTimeout(ORCAMENTO_DA_BUSCA + 30_000);
    const linhas = await ateAListaCompleta(page);

    /*
      As regiões vivas de `SearchProgress` não mudam de texto, de momento nem de
      contagem: nenhuma linha é anunciada por entrar — a entrada é visual
      (contracts/surfaces.md §3.4).
    */
    await expect(linhas).toHaveCount(120);
    await expect(page.getByText(t.review.listLabel, { exact: true })).toHaveCount(0);
  });

  test('FR-026a — a primeira linha chega opaca, sem estado intermediário preso', async ({
    page,
  }) => {
    test.setTimeout(ORCAMENTO_DA_BUSCA + 30_000);
    const linhas = await ateAListaCompleta(page);

    // Nenhuma linha fica presa a meio caminho: o estado em repouso do DOM é o
    // estado final, e a animação é puramente aditiva.
    await expect(linhas.first()).toHaveCSS('opacity', '1', {
      timeout: ORCAMENTO_DA_ENTRADA,
    });
  });
});

/**
 * US4 · a faixa de adesivos de Destinos (FR-032, FR-033).
 *
 * A camada é `absolute inset-0` e **nunca esteve no fluxo**, de modo que nenhum
 * quadro da entrada desloca conteúdo acima dela. Isso não é verificável sem
 * layout de verdade: `happy-dom` não calcula caixa, e o teste de componente
 * afirma a classe, não a geometria (contracts/surfaces.md §5.2).
 */
test.describe('US4 · os adesivos assentam sem mover a tela', () => {
  test('FR-033 — nada acima da faixa se desloca em nenhum quadro', async ({ page }) => {
    await abrirEmDestinos(page);

    const titulo = page.getByRole('heading', { name: t.destinations.heading });
    const grupo = page.getByRole('group', { name: t.destinations.groupLabel });

    await avancar(page).click();
    await expect(titulo).toBeVisible();

    /*
      A referência é tomada **depois** de a troca de etapa terminar, e a espera é
      pelo bloco de saída desaparecer — não por um relógio.

      Isolar as duas coisas é o ponto: durante os 200ms da transição o miolo
      inteiro desliza no eixo `x`, e o título vai junto por desenho (FR-022).
      Misturar os dois faria este caso acusar o movimento certo pelo motivo
      errado. Quando a transição acaba, o escalonamento dos onze ainda está
      correndo — o teto sozinho é 240ms —, e é ele que fica sob medição.
    */
    await expect(page.locator('[inert]')).toHaveCount(0);

    const referencia = {
      titulo: await caixaDe(titulo),
      grupo: await caixaDe(grupo),
    };

    const durante = await amostrar(
      async () => ({ titulo: await caixaDe(titulo), grupo: await caixaDe(grupo) }),
      16,
    );

    for (const quadro of durante) {
      expect(
        quadro.titulo,
        'A faixa de adesivos é `absolute inset-0` e não ocupa célula de layout. Um único ' +
          'quadro que deslocasse o título significaria que ela entrou no fluxo (FR-033).',
      ).toEqual(referencia.titulo);
      expect(quadro.grupo).toEqual(referencia.grupo);
    }
  });

  test('FR-032a, SC-017 — voltar a Destinos mostra os adesivos já postos', async ({ page }) => {
    await abrirEmDestinos(page);
    await avancar(page).click();
    await expect(page.getByRole('heading', { name: t.destinations.heading })).toBeVisible();

    const adesivos = page.locator('main img[alt=""]');
    await expect(adesivos).toHaveCount(11);

    // Sair e voltar: a segunda aparição não encena, e os onze estão inteiros
    // desde o primeiro quadro em que a etapa existe.
    await voltar(page).click();
    await expect(page.getByRole('heading', { name: t.credential.heading })).toBeVisible();
    await avancar(page).click();
    await expect(page.getByRole('heading', { name: t.destinations.heading })).toBeVisible();

    await expect(adesivos).toHaveCount(11);
    await expect(adesivos.first()).toHaveCSS('opacity', '1');
  });
});

/**
 * Transversais · o que atravessa as quatro histórias — FR-018, FR-018a, FR-034,
 * FR-036, SC-012, SC-013, SC-014.
 *
 * Nenhum destes cabe em teste de componente: interrupção resolve em quadros,
 * rolagem horizontal é geometria, e a contenção de foco do diálogo é do
 * navegador — `happy-dom` expõe `showModal()` mas não emula a camada de topo.
 */
test.describe('Transversais · repouso, interrupção e diálogo', () => {
  test('FR-034, SC-014 — em repouso não há animação em curso', async ({ page }) => {
    await abrirEmDestinos(page);
    await avancar(page).click();
    await expect(page.getByRole('heading', { name: t.destinations.heading })).toBeVisible();
    await expect(page.locator('[inert]')).toHaveCount(0);

    /*
      **A tela chega ao repouso, e fica.** A afirmação tem duas metades, e as
      duas importam.

      A primeira é que o movimento **termina**: a entrada dos adesivos é a última
      coisa a rodar nesta etapa, e o pior caso dela é o teto de defasagem
      (240ms) mais o degrau `base` (200ms). Uma medição única logo depois da
      troca pegaria justamente esse rabo e acusaria movimento ocioso onde há
      movimento acabando.

      A segunda é que ele **não recomeça**. Movimento contínuo neste produto
      significa trabalho acontecendo, e a ausência dele em repouso é o que
      preserva esse significado (FR-034).
    */
    await expect
      .poll(async () => animacoesEmCurso(page), {
        message:
          'O movimento desta etapa tem de terminar: a entrada dos adesivos é a última coisa ' +
          'a rodar, e o pior caso dela é o teto de 240ms mais os 200ms de `base`.',
        timeout: 3_000,
      })
      .toBe(0);

    const emRepouso = await amostrar(async () => animacoesEmCurso(page), 12);
    expect(
      emRepouso,
      'Nada anima em repouso. O fundo ambiente não se move, os adesivos assentam e ficam ' +
        'imóveis, e nenhuma superfície ganhou movimento ocioso (FR-034, SC-014).',
    ).toEqual(new Array<number>(12).fill(0));
  });

  test('FR-018, FR-018a, SC-013 — avançar e voltar no meio da transição resolve no estado final', async ({
    page,
  }) => {
    await abrirEmDestinos(page);

    /*
      Sem esperar: o segundo clique cai **dentro** dos 200ms do primeiro. A
      animação nova parte do valor corrente e segue dali — nenhum salto ao estado
      final precede a troca, porque cortar e recomeçar produziria um piscar a
      cada clique rápido (contracts/motion-catalog.md §4a).

      O que se afirma é o **estado final** e a **ausência de nó preso**. Os
      quadros intermediários de uma interrupção não são objeto de asserção, e um
      teste que os afirmasse seria instável por construção.
    */
    await avancar(page).click();
    await voltar(page).click();

    await expect(page.getByRole('heading', { name: t.credential.heading })).toBeVisible();
    await expect(
      page.locator('[inert]'),
      'Nenhum nó ficou preso em cena depois da interrupção (FR-018).',
    ).toHaveCount(0);

    // E a etapa que ficou é operável, não um fantasma opaco.
    await expect(avancar(page)).toBeEnabled();
    await expect(page.getByRole('heading', { name: t.destinations.heading })).toHaveCount(0);
  });

  test('FR-018 — três trocas encadeadas ainda assim resolvem na última', async ({ page }) => {
    await abrirEmDestinos(page);

    await avancar(page).click();
    await avancar(page).click();
    await voltar(page).click();

    await expect(page.getByRole('heading', { name: t.destinations.heading })).toBeVisible();
    await expect(page.locator('[inert]')).toHaveCount(0);
    // Um único `aria-current="step"` na página, seja ele da trilha ou do
    // `StepSummary` que a substitui em largura estreita (007/FR-041).
    await expect(page.locator('[aria-current="step"]')).toHaveCount(1);
  });

  test('SC-012 — nenhuma rolagem horizontal em nenhum quadro da transição', async ({ page }) => {
    /*
      Vale nos três projetos, e é no `narrow-375` que ele morde: a casca colapsa
      em coluna única, e um deslocamento de 16px que não fosse contido produziria
      barra horizontal exatamente durante a transição.
    */
    await abrirEmDestinos(page);
    await avancar(page).click();

    const excedeu = await amostrar(
      async () =>
        page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
        ),
      16,
    );

    expect(
      excedeu,
      'O deslocamento horizontal da transição tem de ser contido: sem isso a página ganha ' +
        'barra de rolagem lateral durante os 200ms (SC-012).',
    ).toEqual(new Array<boolean>(16).fill(false));

    await expect(page.getByRole('heading', { name: t.destinations.heading })).toBeVisible();
    const aoFinal = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(aoFinal).toBe(false);
  });
});

/**
 * FR-036 · o diálogo não anima, e por isso está operável de imediato.
 *
 * A proibição de animar entrada e saída de diálogo é o que protege o Princípio V
 * da constituição: o diálogo de confirmação é o que segura "nenhuma escrita sem
 * confirmação explícita", e animar a saída exigiria segurá-lo em cena depois do
 * fechamento (contracts/surfaces.md §6).
 *
 * O caso é do navegador porque a contenção de foco é do navegador: `happy-dom`
 * expõe `showModal()` e marca `open`, mas não emula a camada de topo.
 */
test.describe('FR-036 · diálogo aberto durante uma transição', () => {
  test('abre e fica operável sem esperar a transição terminar', async ({ page }) => {
    await abrirEmDestinos(page);

    /*
      A ação de recomeço só existe quando há trabalho a descartar (006/FR-015),
      então o texto colado vem antes. É de Entrada que se volta a Destinos, e é
      nessa volta que os dois cliques se encavalam.
    */
    await avancar(page).click();
    await expect(page.getByRole('heading', { name: t.destinations.heading })).toBeVisible();
    await avancar(page).click();
    await expect(page.getByRole('heading', { name: t.input.heading })).toBeVisible();
    await page.getByLabel(t.input.textareaLabel).fill('Imagine - John Lennon');
    await expect(page.getByRole('button', { name: t.flow.reset, exact: true })).toBeVisible();

    /*
      A coincidência é real e alcançável: "Recomeçar" vive na casca e existe em
      toda etapa, de modo que ela pode ser acionada **dentro** dos 200ms de uma
      troca. Nenhuma espera entre os dois cliques, de propósito.
    */
    await voltar(page).click();
    await page.getByRole('button', { name: t.flow.reset, exact: true }).click();

    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();
    await expect(dialogo).toContainText(t.flow.resetTitle);

    // Operável **de imediato**: o foco entrou, e os dois controles respondem.
    const focoDentro = await page.evaluate(
      () => document.activeElement?.closest('dialog') !== null,
    );
    expect(focoDentro).toBe(true);

    // E o diálogo não é filho da árvore que sai: cancelar o devolve à etapa
    // nova, inteira.
    await page.getByRole('button', { name: t.common.cancel, exact: true }).click();
    await expect(dialogo).toBeHidden();
    await expect(page.getByRole('heading', { name: t.destinations.heading })).toBeVisible();
    await expect(page.locator('[inert]')).toHaveCount(0);
  });
});

/**
 * FR-015, SC-004, SC-005 — a preferência não custa informação.
 *
 * ## Por que a comparação acontece dentro de um teste só
 *
 * O projeto Playwright `reduced-motion` prova que o fluxo **funciona** sob a
 * preferência, e ele roda a suíte inteira. O que ele não prova é a **igualdade**:
 * duas execuções em processos diferentes não têm como comparar contagens entre
 * si sem um número escrito à mão no meio — e um número escrito à mão envelhece
 * a cada texto novo.
 *
 * `page.emulateMedia` resolve isso: o mesmo percurso, duas vezes, no mesmo
 * contexto, com a preferência trocada e a página recarregada entre as duas. O
 * que se compara é uma execução contra a outra, e não contra uma expectativa.
 */
test.describe('FR-015, SC-004 · a mesma informação com e sem movimento', () => {
  /** Textos visíveis e controles alcançáveis, na ordem do documento. */
  async function inventario(page: Page): Promise<{ textos: string[]; controles: string[] }> {
    return page.evaluate(() => {
      const visivel = (no: Element): boolean => {
        if (no.closest('[inert]') !== null) return false;
        if (no.closest('[aria-hidden="true"]') !== null) return false;
        const caixa = no.getBoundingClientRect();
        return caixa.width > 0 && caixa.height > 0;
      };

      const textos = [...document.querySelectorAll('p, h1, h2, h3, span, label, legend')]
        .filter((no) => visivel(no) && (no.textContent ?? '').trim() !== '')
        .map((no) => (no.textContent ?? '').trim());

      const controles = [
        ...document.querySelectorAll<HTMLElement>(
          'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ]
        .filter((no) => no.closest('[inert]') === null && no.offsetParent !== null)
        .map((no) => no.getAttribute('aria-label') ?? no.textContent?.trim() ?? '');

      return { textos, controles };
    });
  }

  /** As três etapas alcançáveis sem rede. O ciclo de serviço exige provedor. */
  async function percorrer(page: Page): Promise<Record<string, Awaited<ReturnType<typeof inventario>>>> {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: t.credential.heading })).toBeVisible();
    const credencial = await inventario(page);

    await avancar(page).click();
    await expect(page.getByRole('heading', { name: t.destinations.heading })).toBeVisible();
    await expect(page.locator('[inert]')).toHaveCount(0);
    const destinos = await inventario(page);

    await avancar(page).click();
    await expect(page.getByRole('heading', { name: t.input.heading })).toBeVisible();
    await expect(page.locator('[inert]')).toHaveCount(0);
    const entrada = await inventario(page);

    return { credencial, destinos, entrada };
  }

  test('SC-004 — tela a tela, a contagem de textos e de controles é idêntica', async ({
    page,
  }) => {
    await seedCredential(page, SPOTIFY_CLIENT_ID, 'spotify');
    await seedCredential(page, YT_CLIENT_ID, 'youtube');

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const comMovimento = await percorrer(page);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    const semMovimento = await percorrer(page);

    for (const tela of ['credencial', 'destinos', 'entrada'] as const) {
      expect(
        semMovimento[tela]?.textos,
        `A etapa "${tela}" perdeu ou ganhou texto sob movimento reduzido. Tudo que é ` +
          'informação permanece — o que a preferência tira é o movimento, nunca o conteúdo ' +
          '(FR-015, SC-004).',
      ).toEqual(comMovimento[tela]?.textos);

      expect(
        semMovimento[tela]?.controles,
        `A etapa "${tela}" mudou a contagem de controles alcançáveis sob movimento reduzido.`,
      ).toEqual(comMovimento[tela]?.controles);
    }
  });

  test('SC-005 — sob a preferência, o fluxo chega ao repouso sem animação nenhuma', async ({
    page,
  }) => {
    await seedCredential(page, SPOTIFY_CLIENT_ID, 'spotify');
    await seedCredential(page, YT_CLIENT_ID, 'youtube');
    await page.emulateMedia({ reducedMotion: 'reduce' });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: t.credential.heading })).toBeVisible();
    await avancar(page).click();

    /*
      **Em um quadro.** Sem `AnimatePresence` não há bloco fora do fluxo
      esperando 200ms para sair, e a etapa nova é o único conteúdo desde o
      primeiro quadro (contracts/motion-catalog.md §5).
    */
    await expect(page.locator('[inert]')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: t.destinations.heading })).toBeVisible();

    /*
      **A asserção é sobre a biblioteca, e o recorte tem razão.**

      A regra global de `index.css` zera transição e animação de CSS com
      `transition-duration: 0.01ms !important` — e não com `none`, para que
      `transitionend` continue disparando. A consequência é que uma troca de cor
      ainda aparece por um instante como `CSSTransition` em curso, e exigir zero
      absoluto aqui reprovaria a estratégia que o projeto escolheu de propósito.

      O que **não** pode existir é movimento vindo da biblioteca: ela anima por
      WAAPI e por atualização de valor, e a regra de CSS não a alcança. É a
      classe `Animation` que denuncia isso, e é ela que tem de estar ausente.
    */
    const daBiblioteca = await page.evaluate(() => {
      const consultar = document.getAnimations.bind(document) as (opcoes?: {
        subtree?: boolean;
      }) => Animation[];
      return consultar({ subtree: true })
        .filter((a) => a.playState === 'running' && a.constructor.name !== 'CSSTransition')
        .map((a) => a.constructor.name);
    });

    expect(
      daBiblioteca,
      'Sob a preferência, cada primitiva devolve o estado final estático. Nenhum interruptor ' +
        'de cima serve: a regra de CSS não alcança a biblioteca, e ' +
        '`MotionConfig reducedMotion="user"` preservaria a `opacity` (contracts/motion-catalog.md §5).',
    ).toEqual([]);

    // E o instante de transição de cor passa depressa: o repouso chega bem
    // dentro do que seria um único degrau da escala.
    await expect.poll(async () => animacoesEmCurso(page), { timeout: 500 }).toBe(0);
  });
});

/**
 * FR-029 · a troca de tema funde — medida no navegador.
 *
 * ## Por que só aqui
 *
 * A decisão de fundir ou não é lógica pura, e está em
 * `tests/unit/theme-transition.spec.ts`. O que **nenhum** teste de unidade
 * alcança é se a regra de CSS de fato chega aos pseudo-elementos que o
 * navegador cria — eles não existem no DOM, não aparecem em `happy-dom`, e uma
 * asserção sobre o texto da folha passaria com o seletor escrito errado.
 */
interface JanelaComSonda {
  __fusao: { chamadas: number; duracoes: number[] };
}

/** Envolve a API para observar a fusão de dentro, antes que ela termine. */
async function sondarFusao(page: Page): Promise<void> {
  await page.evaluate(() => {
    const janela = window as unknown as JanelaComSonda;
    janela.__fusao = { chamadas: 0, duracoes: [] };

    const original = document.startViewTransition?.bind(document);
    if (original === undefined) return;

    document.startViewTransition = ((mudar: () => void) => {
      janela.__fusao.chamadas += 1;
      const transicao = original(mudar);
      void transicao.ready.then(() => {
        const consultar = document.getAnimations.bind(document) as (opcoes?: {
          subtree?: boolean;
        }) => Animation[];
        for (const animacao of consultar({ subtree: true })) {
          const pseudo = (animacao.effect as KeyframeEffect | null)?.pseudoElement;
          if (pseudo === null || pseudo === undefined) continue;
          janela.__fusao.duracoes.push(Number(animacao.effect?.getTiming().duration ?? 0));
        }
      });
      return transicao;
    }) as typeof document.startViewTransition;
  });
}

async function sonda(page: Page): Promise<JanelaComSonda['__fusao']> {
  return page.evaluate(() => (window as unknown as JanelaComSonda).__fusao);
}

test.describe('FR-029 · a troca de tema funde', () => {
  /** O degrau `theme` da escala, em milissegundos. */
  const DEGRAU_THEME = 400;

  test('a fusão roda no degrau `theme`, e a troca chega no quadro seguinte', async ({ page }) => {
    await seedCredential(page, SPOTIFY_CLIENT_ID, 'spotify');
    await page.goto('/');
    await sondarFusao(page);

    test.skip(
      !(await page.evaluate(() => typeof document.startViewTransition === 'function')),
      'este navegador não tem transição de vista; a troca acontece seca, como antes',
    );
    /*
      No projeto `reduced-motion` a fusão é suprimida de propósito, e é o caso
      seguinte que afirma isso. Rodar este aqui lá mediria a supressão esperando
      encontrar animação — reprovaria o comportamento correto.
    */
    test.skip(
      await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches),
      'a fusão é suprimida sob movimento reduzido; ver o caso do FR-014',
    );

    await page.getByRole('radio', { name: t.theme.dark }).click();

    /*
      **O atributo troca no quadro seguinte**, e não no do clique: a API
      fotografa o estado atual antes de aplicar a mudança. Um quadro é
      imperceptível — a fotografia já está na tela —, mas é observável, e por
      isso a espera aqui é explícita em vez de uma leitura direta que passaria
      por sorte de temporização.
    */
    await expect
      .poll(async () => page.evaluate(() => document.documentElement.getAttribute('data-theme')))
      .toBe('dark');

    await expect.poll(async () => (await sonda(page)).duracoes.length).toBeGreaterThan(0);

    const { chamadas, duracoes } = await sonda(page);
    expect(chamadas).toBe(1);
    expect(
      [...new Set(duracoes)],
      'Toda animação da fusão lê o degrau `theme`. Um valor diferente aqui é o padrão do ' +
        'navegador vazando para dentro do sistema — um tempo que ninguém escolheu (FR-006).',
    ).toEqual([DEGRAU_THEME]);
  });

  test('FR-014 — sob movimento reduzido a fusão não acontece, e o tema troca igual', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seedCredential(page, SPOTIFY_CLIENT_ID, 'spotify');
    await page.goto('/');
    await sondarFusao(page);

    await page.getByRole('radio', { name: t.theme.dark }).click();

    /*
      Sem fusão a mudança é síncrona, e a asserção pode ser direta. O contraste
      com o caso acima **é** parte do que se afirma: quem pediu menos movimento
      não paga nem o quadro de espera.
    */
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe(
      'dark',
    );
    expect(
      (await sonda(page)).chamadas,
      'A fusão cobre a tela inteira — é o movimento mais amplo do produto, e quem pediu menos ' +
        'movimento recebe a troca seca (FR-014, FR-015).',
    ).toBe(0);
  });

  test('a primeira pintura não funde — carregar não é trocar', async ({ page }) => {
    /*
      Mesmo princípio do `initial={false}` da troca de etapa (FR-024):
      `public/theme-boot.js` já escreveu o atributo antes da primeira pintura, e
      confirmar o que já está na tela não é uma troca.
    */
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'tp.v2.theme',
        JSON.stringify({ schemaVersion: 2, preference: 'dark' }),
      );
    });
    await seedCredential(page, SPOTIFY_CLIENT_ID, 'spotify');
    await page.goto('/');
    await sondarFusao(page);

    await expect(page.getByRole('heading', { name: t.credential.heading })).toBeVisible();

    expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe(
      'dark',
    );
    expect((await sonda(page)).chamadas).toBe(0);
  });
});
