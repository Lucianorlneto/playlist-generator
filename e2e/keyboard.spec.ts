import { expect, test, type Page } from '@playwright/test';

import { t } from '../src/i18n/pt-BR';
import {
  ateEntrada,
  botaoConectar,
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
 * Operação integral por teclado no fluxo de cinco etapas (FR-047).
 *
 * Cobre as telas herdadas da 001 e as que a 002 acrescentou: destinos, fila,
 * estimativa de cota, ajuste de lista e resumo consolidado.
 */

const LISTA = ['Bohemian Rhapsody - Queen', 'Imagine - John Lennon'].join('\n');

/** Percorre a etapa por Tab até encontrar o controle, ou falha após um limite. */
async function focarPorTeclado(page: Page, seletor: string, limite = 40): Promise<void> {
  for (let passo = 0; passo < limite; passo += 1) {
    const focado = await page.evaluate((alvo) => {
      const elemento = document.querySelector(alvo);
      return elemento !== null && elemento === document.activeElement;
    }, seletor);
    if (focado) return;
    await page.keyboard.press('Tab');
  }
  throw new Error(`Controle "${seletor}" não foi alcançado por teclado em ${limite} tabulações`);
}

/**
 * Aciona um controle sem mouse: foco explícito e Enter.
 *
 * Casamento **exato** de nome: "Continuar" por substring também alcança
 * "Continuar de onde parei" do banner de rascunho, que reaparece a cada volta da
 * autorização — e o teste passaria a exercitar o botão errado.
 */
async function acionar(page: Page, nome: string): Promise<void> {
  const controle = page.getByRole('button', { name: nome, exact: true }).first();
  // Um botão desabilitado ignora `focus()` em silêncio — esperar aqui é o que
  // separa "não é alcançável por teclado" de "ainda não estava habilitado".
  await expect(controle).toBeEnabled();
  await controle.focus();
  await expect(controle).toBeFocused();
  // `locator.press` refoca antes de teclar: sem isso, uma re-renderização entre
  // o foco e a tecla mandaria o Enter para o `body` e o teste falharia por
  // corrida, não por inacessibilidade.
  await controle.press('Enter');
}

test.describe('FR-047 — operação por teclado', () => {
  test('a etapa de credencial é operável só pelo teclado, incluindo revelar', async ({ page }) => {
    await mockSpotify(page);
    await page.goto('/');

    await page.keyboard.press('Tab'); // "Ir para o conteúdo"
    await focarPorTeclado(page, 'input[type="text"], input:not([type])');
    await page.keyboard.type(CLIENT_ID);
    await page.keyboard.press('Enter');

    const mascarado = page.getByLabel(fmt(t.credential.maskedLabel, { service: SPOTIFY }));
    await expect(mascarado).toBeVisible();

    const revelar = page.getByRole('button', { name: fmt(t.credential.reveal, { service: SPOTIFY }) });
    await revelar.focus();
    await expect(revelar).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press('Enter');

    const ocultar = page.getByRole('button', { name: fmt(t.credential.hide, { service: SPOTIFY }) });
    await expect(ocultar).toHaveAttribute('aria-pressed', 'true');
    await expect(mascarado).toContainText(CLIENT_ID);
  });

  test('o fluxo inteiro pode ser concluído sem mouse', async ({ page }) => {
    await mockSpotify(page);
    await seedCredential(page);
    await page.goto('/');

    // Etapa 1 → 2
    await acionar(page, t.common.next);
    await expect(page.getByRole('heading', { name: t.destinations.heading })).toBeVisible();

    // Etapa 2: a caixa de destino é alternável por barra de espaço (FR-047).
    const caixa = page.getByRole('checkbox', {
      name: fmt(t.destinations.selectLabel, { service: SPOTIFY }),
    });
    await caixa.focus();
    await page.keyboard.press('Space');
    await expect(caixa).not.toBeChecked();
    await page.keyboard.press('Space');
    await expect(caixa).toBeChecked();

    await acionar(page, t.common.next);
    await expect(page.getByRole('heading', { name: t.input.heading })).toBeVisible();

    await page.getByLabel(t.input.textareaLabel).focus();
    await page.keyboard.type('Bohemian Rhapsody - Queen');
    await acionar(page, t.input.start);

    await acionar(page, fmt(t.connect.connect, { service: SPOTIFY }));
    await expect(tituloRevisao(page, SPOTIFY)).toBeVisible();

    await page.getByLabel(t.playlistConfig.nameLabel).focus();
    await page.keyboard.type('Somente Teclado');

    await acionar(page, fmt(t.playlistConfig.create, { service: SPOTIFY }));
    await expect(tituloResultado(page, SPOTIFY)).toBeVisible();
  });

  test('o foco vai para o cabeçalho a cada transição de etapa', async ({ page }) => {
    await mockSpotify(page);
    await seedCredential(page);
    await page.goto('/');

    await acionar(page, t.common.next);
    await expect(page.getByRole('heading', { name: t.destinations.heading })).toBeFocused();

    await acionar(page, t.common.next);
    await expect(page.getByRole('heading', { name: t.input.heading })).toBeFocused();

    await page.getByLabel(t.input.textareaLabel).fill('Imagine - John Lennon');
    await acionar(page, t.input.start);
    await expect(page.getByRole('heading', { name: fmt(t.connect.heading, { service: SPOTIFY }) })).toBeFocused();

    await acionar(page, fmt(t.connect.connect, { service: SPOTIFY }));
    await expect(tituloRevisao(page, SPOTIFY)).toBeFocused();
  });

  test('o botão de cancelar a busca é alcançável enquanto ela roda', async ({ page }) => {
    await mockSpotify(page);
    await seedCredential(page);
    await ateEntrada(
      page,
      Array.from({ length: 60 }, (_, index) => `Faixa ${index} - Artista ${index}`).join('\n'),
    );
    await botaoConectar(page, SPOTIFY).click();

    const cancelar = page.getByRole('button', { name: t.review.cancelSearch }).first();
    await expect(cancelar).toBeVisible();
    await cancelar.focus();
    await expect(cancelar).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(page.getByText(t.review.searchCanceled)).toBeVisible();
  });

  test('fila, estimativa, ajuste de lista e resumo são operáveis por teclado', async ({ page }) => {
    await mockSpotify(page);
    await mockYouTube(page, { tracks: catalogoDe(LISTA) });
    await seedCredential(page, CLIENT_ID, 'spotify');
    await seedCredential(page, YT_CLIENT_ID, 'youtube');

    await ateEntrada(page, LISTA);
    await acionar(page, fmt(t.connect.connect, { service: SPOTIFY }));
    await expect(tituloRevisao(page, SPOTIFY)).toBeVisible();

    /*
      FR-018: a posição na fila é anunciada, não apenas desenhada.

      **O portador mudou na 008, a garantia não** (008/FR-013, SC-009). Até aqui
      quem anunciava era o `QueueIndicator`, por `role="status"` e `aria-label`,
      no topo da etapa de serviço. A posição passou para a **linha de contexto do
      cabeçalho**, que é texto real, aparece em todas as fases do ciclo e é a
      região viva que anuncia a troca de serviço — o `QueueIndicator` virou a
      repetição visual que o arquivo de design desenha dentro do cabeçalho dos
      cartões de orçamento e de resultado.

      A asserção continua sendo a mesma pergunta: **a posição é anunciada?** O
      que ela deixou de assumir é *qual elemento* a anuncia, que era detalhe de
      implementação da 002.
    */
    const posicao = fmt(t.queue.position, { service: SPOTIFY, current: 1, total: 2 });
    // Filtrado pelo conteúdo: o aviso de rascunho recuperado também é
    // `role="status"`, e nesta altura do fluxo ele está na tela.
    await expect(page.getByRole('status').filter({ hasText: posicao })).toHaveCount(1);

    await page.getByLabel(t.playlistConfig.nameLabel).fill('Por Teclado');
    await acionar(page, fmt(t.playlistConfig.create, { service: SPOTIFY }));
    await expect(tituloResultado(page, SPOTIFY)).toBeVisible();

    // Ajuste de lista a partir do resultado do serviço anterior (FR-013).
    await acionar(page, t.result.adjustList);
    const listaAjuste = page.getByRole('list', {
      name: fmt(t.reduction.listLabel, { service: YOUTUBE }),
    });
    await expect(listaAjuste).toBeVisible();
    const remover = listaAjuste.getByRole('button').first();
    await remover.focus();
    await expect(remover).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByText(t.reduction.removedCountOne)).toBeVisible();
    await acionar(page, t.reduction.confirm);

    await acionar(page, fmt(t.result.continueNext, { service: YOUTUBE }));
    await acionar(page, fmt(t.connect.connect, { service: YOUTUBE }));
    await expect(page.getByText(YT_CHANNEL_NAME)).toBeVisible();

    // Estimativa de cota: alcançável e acionável sem mouse (FR-029, SC-011).
    await expect(page.getByText(fmt(t.quota.heading, { service: YOUTUBE }))).toBeVisible();
    await acionar(page, t.quota.proceed);

    await expect(tituloRevisao(page, YOUTUBE)).toBeVisible();
    await incluirPendentes(page);
    await acionar(page, fmt(t.playlistConfig.create, { service: YOUTUBE }));
    await expect(tituloResultado(page, YOUTUBE)).toBeVisible();

    // Resumo consolidado.
    await acionar(page, t.common.next);
    await expect(page.getByRole('heading', { name: t.summary.heading })).toBeFocused();
    const recomecar = page.getByRole('button', { name: t.summary.startOver });
    await recomecar.focus();
    await expect(recomecar).toBeFocused();
  });
});

/**
 * FR-016, SC-010 e SC-012 nos **dois temas** (T063).
 *
 * O anel de foco passou a usar `outline` em vez de `box-shadow` (research §12),
 * e sua cor é `--accent-text` — que **diverge entre os temas**: `#816001` no
 * claro, `#f5b301` no escuro. Verificar num tema só deixaria metade da
 * afirmação sem prova.
 *
 * Os dois valores mudaram na feature 007, junto com a paleta inteira. O que não
 * mudou é a afirmação: o anel é `outline`, tem 2px e acompanha o tema. Um teste
 * que citasse o hex sem citar o token estaria protegendo o valor em vez da
 * regra — por isso a linha abaixo lê os dois de `src/styles/tokens.css`.
 *
 * Nenhuma asserção de comportamento é alterada aqui: o que se acrescenta é
 * verificação sobre o que já existia.
 */
test.describe('FR-016 e SC-010 — foco visível nos dois temas', () => {
  for (const tema of ['light', 'dark'] as const) {
    test(`o anel de foco é desenhado por outline no tema ${tema}`, async ({ page }) => {
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
      await seedCredential(page);
      await page.goto('/');

      /*
        O foco precisa chegar **por teclado**. `element.focus()` programático não
        casa `:focus-visible` no Chromium, e a medição pegaria o anel padrão do
        navegador em vez do nosso — passando ou falhando por motivo errado.
      */
      const selecionado = page.locator('[role="radio"][tabindex="0"]');
      await focarPorTeclado(page, '[role="radio"][tabindex="0"]');

      const foco = await selecionado.evaluate((node) => {
        const estilo = getComputedStyle(node);
        return {
          outlineStyle: estilo.outlineStyle,
          outlineWidth: estilo.outlineWidth,
          outlineColor: estilo.outlineColor,
          boxShadow: estilo.boxShadow,
        };
      });

      expect(foco.outlineStyle).toBe('solid');
      expect(Number.parseFloat(foco.outlineWidth)).toBeGreaterThanOrEqual(2);
      // `box-shadow` desaparece em modo de cores forçadas; o foco não pode
      // depender dele.
      expect(foco.boxShadow === 'none' || foco.boxShadow === '').toBe(true);

      /*
        A cor do anel acompanha o tema, e o valor esperado é lido do próprio
        `--accent-text` em vigor — não de um hex copiado para cá. Comparar contra
        uma cópia significaria que trocar a paleta quebra este teste por um
        motivo que nada tem a ver com foco visível, que é o que ele protege.
      */
      const esperado = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--accent-text').trim(),
      );
      const emRgb = await page.evaluate((hex) => {
        const sonda = document.createElement('span');
        sonda.style.color = hex;
        document.body.append(sonda);
        const cor = getComputedStyle(sonda).color;
        sonda.remove();
        return cor;
      }, esperado);

      expect(foco.outlineColor).toBe(emRgb);
    });

    test(`o ThemeControl é uma parada única de Tab no tema ${tema}`, async ({ page }) => {
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
      await page.goto('/');

      await focarPorTeclado(page, '[role="radio"][tabindex="0"]');
      await expect(page.getByRole('radio', { checked: true })).toBeFocused();

      // Os não selecionados ficam fora da ordem de tabulação; as setas navegam
      // dentro do grupo. É o que impede o controle novo de acrescentar três
      // paradas ao caminho de teclado do cabeçalho (SC-016).
      expect(await page.locator('[role="radio"][tabindex="-1"]').count()).toBe(2);
    });
  }
});

/**
 * 007/FR-039, FR-040 e SC-008 — o caminho de teclado pelas três zonas.
 *
 * A feature moveu controles entre zonas e criou outros. O risco não é que algum
 * fique inacessível — isso o teste anterior pegaria —, é que a **ordem** deixe
 * de seguir o olho: barra superior → trilha → conteúdo → barra de ações. Uma
 * ordem de tabulação que salta do conteúdo de volta para o cabeçalho é
 * navegável e é desorientadora, e nenhuma asserção de "existe e é focável"
 * percebe isso.
 */
test.describe('007 — ordem de tabulação e foco visível na casca nova', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  /** Em que zona da casca vive o elemento em foco. */
  async function zonaFocada(page: Page): Promise<'topbar' | 'rail' | 'main' | 'fora'> {
    return page.evaluate(() => {
      const ativo = document.activeElement;
      if (ativo === null) return 'fora';
      if (ativo.closest('header') !== null) return 'topbar';
      if (ativo.closest('nav[aria-label]') !== null) return 'rail';
      if (ativo.closest('main') !== null) return 'main';
      return 'fora';
    });
  }

  test('a ordem é barra superior → trilha → conteúdo, sem voltar atrás', async ({ page }) => {
    await mockSpotify(page);
    await seedCredential(page, CLIENT_ID, 'spotify');
    await ateEntrada(page, LISTA);

    const ordem = ['topbar', 'rail', 'main'] as const;
    let maisLonge = -1;

    // O primeiro Tab pousa no link de pular, que vive fora das três zonas.
    await page.keyboard.press('Tab');

    for (let passo = 0; passo < 40; passo += 1) {
      await page.keyboard.press('Tab');
      const zona = await zonaFocada(page);
      if (zona === 'fora') continue;

      const indice = ordem.indexOf(zona);
      expect(
        indice,
        `o foco voltou de "${ordem[maisLonge] ?? '?'}" para "${zona}" — a ordem de tabulação descolou da ordem visual`,
      ).toBeGreaterThanOrEqual(maisLonge);
      maisLonge = Math.max(maisLonge, indice);

      if (maisLonge === ordem.length - 1) break;
    }

    expect(maisLonge, 'a tabulação nunca alcançou a área principal').toBe(ordem.length - 1);
  });

  test('todo controle criado ou movido pela feature tem foco visível por outline', async ({
    page,
  }) => {
    await mockSpotify(page);
    await seedCredential(page, CLIENT_ID, 'spotify');
    await ateEntrada(page, LISTA);

    /*
      Os controles que a 007 criou ou moveu: a ação do chip de conexão, na barra
      superior, e a ação de recomeçar, que saiu do cabeçalho para o rodapé da
      trilha. O `ThemeControl` já é coberto pelo bloco anterior, nos dois temas.

      Os alvos são seletores CSS e não localizadores porque o foco precisa chegar
      **por teclado**: `focus()` programático não casa `:focus-visible` no
      Chromium, e `getComputedStyle` não consulta pseudoclasse — a medição leria
      o estilo em repouso e passaria por engano.
    */
    const alvos = [
      'header button[aria-label*="a conta do"]',
      'nav[aria-label] button',
    ];

    for (const seletor of alvos) {
      await expect(page.locator(seletor).first()).toBeVisible();
      await focarPorTeclado(page, seletor);

      const estilo = await page.locator(seletor).first().evaluate((node) => {
        const s = getComputedStyle(node);
        return { style: s.outlineStyle, width: s.outlineWidth, shadow: s.boxShadow };
      });

      expect(estilo.style, `o foco de "${seletor}" não é desenhado por outline`).toBe('solid');
      expect(Number.parseFloat(estilo.width)).toBeGreaterThanOrEqual(2);
      // `box-shadow` desaparece em modo de cores forçadas; o foco não pode
      // depender dele (FR-028).
      expect(estilo.shadow === 'none' || estilo.shadow === '').toBe(true);
    }
  });

  test('a barra superior está em toda etapa, e a trilha também em largura ampla', async ({
    page,
  }) => {
    await mockSpotify(page);
    await seedCredential(page, CLIENT_ID, 'spotify');
    await page.goto('/');

    // Configuração
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('navigation', { name: t.rail.title })).toBeVisible();
    await acionar(page, t.common.next);

    // Destinos
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('navigation', { name: t.rail.title })).toBeVisible();
    await acionar(page, t.common.next);

    // Entrada
    await page.getByLabel(t.input.textareaLabel).fill(LISTA);
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('navigation', { name: t.rail.title })).toBeVisible();
    await acionar(page, t.input.start);

    // Ciclo do serviço
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('navigation', { name: t.rail.title })).toBeVisible();
  });
});

/**
 * V16 — pular e recomeçar por teclado (`006/FR-023`).
 *
 * A contenção de foco dos dois diálogos é do navegador, pelo `<dialog>` nativo,
 * e por isso só pode ser provada aqui: happy-dom não emula a camada de topo
 * (D1 do `004/plan.md`). É o mesmo motivo pelo qual `reconnect.spec.ts` prova a
 * do diálogo de reautorização.
 */
test.describe('006 — pular e recomeçar sem mouse', () => {
  test('o comando de recomeço é alcançável por Tab e contém o foco', async ({ page }) => {
    await mockSpotify(page);
    await seedCredential(page, CLIENT_ID, 'spotify');

    await ateEntrada(page, LISTA);
    await botaoConectar(page, SPOTIFY).click();
    await expect(tituloRevisao(page, SPOTIFY)).toBeVisible();

    // `focarPorTeclado` casa por seletor CSS, e não há um que aponte este botão
    // sem um atributo só para teste. O critério aqui é o texto do elemento
    // **focado**, que é exatamente o que a operação por teclado enxerga.
    let alcancado = false;
    for (let passo = 0; passo < 40 && !alcancado; passo += 1) {
      alcancado = await page.evaluate(
        (rotulo) => document.activeElement?.textContent?.trim() === rotulo,
        t.flow.reset,
      );
      if (!alcancado) await page.keyboard.press('Tab');
    }
    expect(alcancado, 'o comando de recomeço não foi alcançado por teclado').toBe(true);

    await page.keyboard.press('Enter');

    // O foco entrou no diálogo e fica contido nele.
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(await page.evaluate(() => document.activeElement?.closest('dialog') !== null)).toBe(
      true,
    );

    // `Esc` fecha sem descartar, e devolve o foco ao botão de origem.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(tituloRevisao(page, SPOTIFY)).toBeVisible();
  });

  test('pular o único destino, confirmar e chegar à seleção — só com teclado', async ({
    page,
  }) => {
    await mockSpotify(page);
    await seedCredential(page, CLIENT_ID, 'spotify');

    await ateEntrada(page, LISTA);
    await botaoConectar(page, SPOTIFY).click();
    await expect(tituloRevisao(page, SPOTIFY)).toBeVisible();

    await acionar(page, fmt(t.queue.skipService, { service: SPOTIFY }));
    await expect(page.getByRole('dialog')).toBeVisible();

    await acionar(page, t.common.discard);

    await expect(page.getByRole('heading', { name: t.destinations.heading })).toBeVisible();
  });
});

/**
 * 008/FR-025 e FR-033 — o cartão de destino trocou a apresentação do controle,
 * e não o controle.
 *
 * A marca de verificação visível passou a ser um `<span aria-hidden>` estilizado
 * por `peer-checked:`, e o `<input type="checkbox">` real ficou `sr-only`. É
 * exatamente o tipo de troca que quebra teclado sem que nada falhe: `sr-only`
 * esconde visualmente, mas um `display: none` ou um `hidden` posto por engano
 * esconderia **semanticamente**, e o controle sairia da ordem de tabulação.
 *
 * Estes casos exigem navegador de verdade: o anel de foco depende de
 * `:focus-visible` e de `peer-focus-visible:`, que só existem com CSS aplicado —
 * nenhum teste de componente os alcança.
 */
test.describe('008/FR-025 e FR-033 — teclado no cartão de destino', () => {
  test('Tab alcança o controle de cada cartão, e Espaço alterna a seleção', async ({ page }) => {
    await mockSpotify(page);
    await mockYouTube(page);
    await seedCredential(page, CLIENT_ID, 'spotify');
    await seedCredential(page, YT_CLIENT_ID, 'youtube');
    await page.goto('/');

    await acionar(page, t.common.next);
    await expect(page.getByRole('heading', { name: t.destinations.heading })).toBeVisible();

    for (const service of [SPOTIFY, YOUTUBE]) {
      const caixa = page.getByRole('checkbox', {
        name: fmt(t.destinations.selectLabel, { service }),
      });

      // Alcançável por **tabulação**, não só por `focus()` programático: é a
      // diferença entre "está na árvore" e "está na ordem de tabulação".
      await focarPorTeclado(page, `#destino-${service === SPOTIFY ? 'spotify' : 'youtube'}`);
      await expect(caixa).toBeFocused();

      await page.keyboard.press('Space');
      await expect(caixa).not.toBeChecked();
      await page.keyboard.press('Space');
      await expect(caixa).toBeChecked();
    }
  });

  test('o foco é visível na marca de verificação, e não no controle escondido', async ({
    page,
  }) => {
    await mockSpotify(page);
    await seedCredential(page, CLIENT_ID, 'spotify');
    await page.goto('/');

    await acionar(page, t.common.next);
    await expect(page.getByRole('heading', { name: t.destinations.heading })).toBeVisible();

    await page.locator('#destino-spotify').focus();

    /*
      O anel vive na marca de verificação por `peer-focus-visible:`. Medir o
      `outline-style` computado é o que separa "a classe está escrita" de "o
      anel aparece na tela" — e o segundo é o que importa para quem navega por
      teclado.
    */
    const marca = page.locator('[data-destino="spotify"] > span:last-child');
    await expect(marca).toHaveCSS('outline-style', 'solid');
    const largura = await marca.evaluate(
      (node) => Number.parseFloat(getComputedStyle(node).outlineWidth),
    );
    expect(largura, 'o anel de foco não tem espessura').toBeGreaterThan(0);
  });

  test('o cartão inteiro é alvo de clique, do título ao vazio', async ({ page }) => {
    /*
      `sr-only` no controle não pode custar o alvo de clique. Até a fidelidade de
      design da 008 o alvo era só o título — uma palavra e meia num cartão de
      quase setecentos pixels —, e o resto da área não fazia nada.

      Os dois cliques abaixo são por **coordenada**, e é a única forma honesta de
      testar isto: o alvo é um `<label>` vazio em camada absoluta, de modo que o
      elemento que o ponteiro atinge nunca é o texto, mesmo quando o dedo do
      usuário pousa exatamente sobre ele. Um `locator.click()` no texto falharia
      a verificação de acionabilidade do Playwright descrevendo como defeito
      exatamente o que se quer.
    */
    await mockSpotify(page);
    await seedCredential(page, CLIENT_ID, 'spotify');
    await page.goto('/');

    await acionar(page, t.common.next);
    await expect(page.getByRole('heading', { name: t.destinations.heading })).toBeVisible();

    const caixa = page.getByRole('checkbox', {
      name: fmt(t.destinations.selectLabel, { service: SPOTIFY }),
    });
    await expect(caixa).toBeChecked();

    /** Clica no centro de um retângulo, como um ponteiro de verdade. */
    async function clicarNoCentro(alvo: ReturnType<typeof page.locator>): Promise<void> {
      const caixaDelimitadora = await alvo.boundingBox();
      expect(caixaDelimitadora, 'o alvo não tem área na tela').not.toBeNull();
      await page.mouse.click(
        caixaDelimitadora!.x + caixaDelimitadora!.width / 2,
        caixaDelimitadora!.y + caixaDelimitadora!.height / 2,
      );
    }

    // Sobre o título, que era o único alvo antes.
    await clicarNoCentro(page.getByText(fmt(t.destinations.selectLabel, { service: SPOTIFY })));
    await expect(caixa, 'clicar no título não alternou').not.toBeChecked();

    // E sobre a faixa vazia entre o texto e a marca de verificação, que é a
    // parte do cartão que não respondia a nada.
    const cartao = page.locator('[data-destino="spotify"]');
    const area = await cartao.boundingBox();
    await page.mouse.click(area!.x + area!.width * 0.7, area!.y + area!.height / 2);
    await expect(caixa, 'clicar na área vazia do cartão não alternou').toBeChecked();
  });
});
