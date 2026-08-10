import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { t } from '../src/i18n/pt-BR';
import { ateEntrada, botaoConectar, SPOTIFY, tituloRevisao } from './support/flow';
import { CLIENT_ID, mockSpotify, seedCredential } from './support/spotify-mock';
import { YT_CLIENT_ID } from './support/youtube-mock';

/**
 * Tema claro e escuro no navegador de verdade (US1, FR-007, FR-010, SC-003, SC-004).
 *
 * Três coisas que só este nível verifica, e que nenhum teste de componente
 * alcança:
 *
 * 1. **Ausência de piscada** — depende de ordem de carregamento de script, não
 *    de estado de React;
 * 2. **Troca durante busca em andamento** — depende de o tema não passar pelo
 *    caminho de reidratação do rascunho;
 * 3. **Persistência entre cargas** — depende do `localStorage` real.
 */

const KEY = 'tp.v2.theme';

/**
 * O `--bg` de cada tema, lido de `src/styles/tokens.css`.
 *
 * **Nenhum hex é copiado para este arquivo.** A afirmação que estes casos
 * protegem é "o tema certo já está no primeiro quadro, e sobrevive à recarga" —
 * não "o fundo escuro é `#0d1219`". Copiar o valor faria a feature 007, que
 * troca a paleta inteira por decisão de projeto (FR-001), quebrar um teste que
 * nada tem a ver com paleta; e faria a próxima troca quebrá-lo de novo.
 *
 * O `:root` do arquivo é o tema claro; o bloco `[data-theme='dark']` é o escuro.
 */
const TOKENS_CSS = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8');

function bgDoBloco(seletor: string): string {
  const inicio = TOKENS_CSS.indexOf(`${seletor} {`);
  if (inicio === -1) throw new Error(`Bloco "${seletor}" não encontrado em tokens.css`);

  const trecho = TOKENS_CSS.slice(inicio);
  const match = /--bg:\s*#([0-9a-f]{6})\s*;/iu.exec(trecho);
  if (match?.[1] === undefined) throw new Error(`--bg não declarado em "${seletor}"`);

  const hex = match[1];
  const canal = (posicao: number): number => Number.parseInt(hex.slice(posicao, posicao + 2), 16);
  return `rgb(${String(canal(0))}, ${String(canal(2))}, ${String(canal(4))})`;
}

const BG_CLARO = bgDoBloco(':root');
const BG_ESCURO = bgDoBloco("[data-theme='dark']");

/** Grava a preferência antes de a página carregar — como um retorno de visita. */
async function semearPreferencia(page: Page, preference: string): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(
        key as string,
        JSON.stringify({ schemaVersion: 2, preference: value }),
      );
    },
    [KEY, preference],
  );
}

async function temaAplicado(page: Page): Promise<string | null> {
  return page.evaluate(() => document.documentElement.getAttribute('data-theme'));
}

async function corDeFundo(page: Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}

test.describe('FR-010 e SC-004 · o tema correto já está no primeiro quadro', () => {
  test('preferência manual divergente do sistema não produz piscada', async ({ browser }) => {
    // O caso que só `public/theme-boot.js` resolve: "Claro" gravado, sistema em
    // escuro. A camada CSS sozinha entregaria escuro no primeiro quadro e o
    // React corrigiria depois — que é exatamente a piscada.
    const context = await browser.newContext({ colorScheme: 'dark' });
    const page = await context.newPage();
    await semearPreferencia(page, 'light');

    /**
     * **Método declarado** (T035): registrar o atributo em cada mudança de
     * `readyState`, começando em `interactive` — que é o momento do
     * `DOMContentLoaded`, antes de o `<script type="module">` executar, porque
     * módulo é adiado por definição.
     *
     * Se `data-theme` já vale `light` em `interactive`, quem o escreveu foi o
     * script clássico e não o React. É a diferença entre "o tema certo aparece"
     * e "o tema certo aparece **sem piscar**".
     */
    await page.addInitScript(() => {
      const marcas: Array<[string, string | null]> = [];
      (window as unknown as Record<string, unknown>).__marcas = marcas;
      document.addEventListener('readystatechange', () => {
        marcas.push([document.readyState, document.documentElement.getAttribute('data-theme')]);
      });
    });

    await mockSpotify(page);
    await page.goto('/');

    const marcas = (await page.evaluate(
      () => (window as unknown as Record<string, unknown>).__marcas,
    )) as Array<[string, string | null]>;

    const interativo = marcas.find(([estado]) => estado === 'interactive');
    expect(interativo, 'nenhuma marca registrada em readyState=interactive').toBeDefined();
    expect(interativo?.[1]).toBe('light');

    // E a cor efetivamente pintada é a do tema claro.
    await expect(page.locator('body')).toHaveCSS('background-color', BG_CLARO);

    await context.close();
  });

  test('sem preferência gravada, o sistema decide já na primeira pintura', async ({ browser }) => {
    // Este caminho não usa script nenhum: é o `@media (prefers-color-scheme)` de
    // tokens.css, e é o estado inicial de todos os usuários.
    const escuro = await browser.newContext({ colorScheme: 'dark' });
    const pageEscura = await escuro.newPage();
    await mockSpotify(pageEscura);
    await pageEscura.goto('/');
    await expect(pageEscura.locator('body')).toHaveCSS('background-color', BG_ESCURO);
    await escuro.close();

    const claro = await browser.newContext({ colorScheme: 'light' });
    const pageClara = await claro.newPage();
    await mockSpotify(pageClara);
    await pageClara.goto('/');
    await expect(pageClara.locator('body')).toHaveCSS('background-color', BG_CLARO);
    await claro.close();
  });
});

test.describe('SC-005 · a escolha sobrevive à recarga', () => {
  test('escolher "Escuro" e recarregar mantém o tema escuro', async ({ page }) => {
    await mockSpotify(page);
    await page.goto('/');

    await page.getByRole('radio', { name: t.theme.dark }).click();
    await expect(page.locator('body')).toHaveCSS('background-color', BG_ESCURO);

    await page.reload();

    expect(await temaAplicado(page)).toBe('dark');
    await expect(page.getByRole('radio', { name: t.theme.dark })).toBeChecked();
  });

  test('voltar a "Sistema" devolve o controle à preferência do sistema', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'light' });
    const page = await context.newPage();
    await mockSpotify(page);
    await page.goto('/');

    await page.getByRole('radio', { name: t.theme.dark }).click();
    await expect(page.locator('body')).toHaveCSS('background-color', BG_ESCURO);

    await page.getByRole('radio', { name: t.theme.system }).click();
    await expect(page.locator('body')).toHaveCSS('background-color', BG_CLARO);

    await page.reload();
    await expect(page.getByRole('radio', { name: t.theme.system })).toBeChecked();

    await context.close();
  });
});

test.describe('FR-007 e SC-003 · trocar de tema não perturba o trabalho', () => {
  test('a troca durante a busca não interrompe nem reinicia a execução', async ({ page }) => {
    await mockSpotify(page);
    await seedCredential(page);

    const lista = ['Bohemian Rhapsody - Queen', 'Imagine - John Lennon', 'Yesterday - The Beatles'];
    await ateEntrada(page, lista.join('\n'));

    /**
     * A etapa atual, e **só** ela.
     *
     * O cabeçalho também mostra a fase da execução ("Conectando" → "Buscando" →
     * "Revisando"), que muda sozinha enquanto o trabalho avança. Comparar o
     * texto inteiro da navegação confundiria progresso legítimo com regressão —
     * o invariante do FR-007 é que a troca de tema não muda a **etapa**, não que
     * a tela congele.
     */
    const etapaAtual = page.locator('[aria-current="step"]');
    const etapaAntes = await etapaAtual.textContent();
    await botaoConectar(page, SPOTIFY).click();

    // A troca acontece **com a busca em andamento**, que é o cenário do FR-007.
    await page.getByRole('radio', { name: t.theme.dark }).click();
    await expect(page.locator('body')).toHaveCSS('background-color', BG_ESCURO);

    expect(await etapaAtual.textContent()).toBe(etapaAntes);
    // …e a execução chegou ao fim sem reiniciar nem ser cancelada: as três
    // linhas estão na revisão, cada uma com seu numeral de entrada.
    await expect(tituloRevisao(page, SPOTIFY)).toBeVisible();
    for (const entrada of lista) {
      await expect(page.getByText(entrada, { exact: false }).first()).toBeVisible();
    }
  });

  test('a preferência de tema não é apagada ao descartar o rascunho (FR-013)', async ({ page }) => {
    await mockSpotify(page);
    await seedCredential(page);
    await page.goto('/');

    await page.getByRole('radio', { name: t.theme.dark }).click();

    await page.evaluate(() => {
      window.localStorage.removeItem('tp.v2.draft');
      for (const provider of ['spotify', 'youtube']) {
        window.localStorage.removeItem(`tp.v2.credential.${provider}`);
        window.localStorage.removeItem(`tp.v2.session.${provider}`);
      }
    });
    await page.reload();

    expect(await temaAplicado(page)).toBe('dark');
  });
});

test.describe('FR-011 · registro corrompido não quebra nem fala', () => {
  test('JSON inválido na chave de tema volta a acompanhar o sistema, em silêncio', async ({
    browser,
  }) => {
    const context = await browser.newContext({ colorScheme: 'light' });
    const page = await context.newPage();
    await page.addInitScript(
      ([key]) => {
        window.localStorage.setItem(key as string, '{ isto não é json');
      },
      [KEY],
    );

    const erros: string[] = [];
    page.on('pageerror', (error) => erros.push(error.message));

    await mockSpotify(page);
    await page.goto('/');

    await expect(page.locator('body')).toHaveCSS('background-color', BG_CLARO);
    await expect(page.getByRole('radio', { name: t.theme.system })).toBeChecked();
    expect(erros).toEqual([]);

    // Nenhum alerta visível sobre armazenamento.
    expect(await corDeFundo(page)).toBe(BG_CLARO);

    await context.close();
  });
});

/**
 * 008/FR-036 — as superfícies novas da 008 nos dois temas.
 *
 * **Este é o único portão que exercita a troca por `[data-theme]` com CSS real**,
 * e portanto o único capaz de medir os tokens derivados de 008/FR-003: jsdom não
 * resolve `color-mix`, e um teste de componente que conferisse
 * `className.includes('bg-brand-tint-spotify')` provaria apenas que alguém
 * escreveu a classe — que é exatamente o modo de falha desta feature.
 *
 * A afirmação de FR-036 é forte e vale enunciar: a divergência autorizada entre
 * os dois temas é **cromática apenas**. Estrutura, composição e estados são
 * idênticos, e é isso que os casos abaixo comparam.
 */
test.describe('008/FR-036 · painel e cartão de destino nos dois temas', () => {
  /** Leva à etapa de Destinos com os dois serviços cadastrados. */
  async function ateDestinos(page: Page, tema: 'light' | 'dark'): Promise<void> {
    await semearPreferencia(page, tema);
    await mockSpotify(page);
    await seedCredential(page, CLIENT_ID, 'spotify');
    await seedCredential(page, YT_CLIENT_ID, 'youtube');
    await page.goto('/');
    await page.getByRole('button', { name: t.common.next, exact: true }).click();
    await expect(page.getByRole('heading', { name: t.destinations.heading })).toBeVisible();
  }

  /**
   * A estrutura observável da etapa: o que **não** pode variar com o tema.
   *
   * Contagens e ordem, nunca cores — as cores são justamente o que muda, e
   * incluí-las aqui faria o caso afirmar o oposto do que FR-036 permite.
   */
  async function estruturaDe(page: Page): Promise<unknown> {
    return page.evaluate(() => {
      const cartoes = [...document.querySelectorAll('[data-destino]')];
      const painel = document.querySelector('aside');
      return {
        cartoes: cartoes.map((cartao) => ({
          destino: cartao.getAttribute('data-destino'),
          filhos: cartao.children.length,
          marcado: cartao.querySelector('input[type="checkbox"]:checked') !== null,
          temDistintivo: /bg-brand-tint-/u.test(cartao.innerHTML),
          texto: cartao.textContent?.trim() ?? '',
        })),
        painel: {
          itens: painel?.querySelectorAll('ol li').length ?? 0,
          texto: painel?.textContent?.trim() ?? '',
        },
      };
    });
  }

  test('a estrutura e os estados são idênticos nos dois temas', async ({ page }) => {
    await ateDestinos(page, 'light');
    const claro = await estruturaDe(page);

    await ateDestinos(page, 'dark');
    const escuro = await estruturaDe(page);

    expect(escuro, 'a estrutura da etapa diverge entre os temas').toEqual(claro);
  });

  for (const tema of ['light', 'dark'] as const) {
    test(`no tema ${tema} o distintivo tem substrato próprio e o glifo tem outra cor`, async ({
      page,
    }) => {
      await ateDestinos(page, tema);

      const distintivo = page.locator('[data-destino="spotify"] .rounded-card').first();
      const fundo = await distintivo.evaluate((node) => getComputedStyle(node).backgroundColor);
      const glifo = await distintivo
        .locator('svg')
        .evaluate((node) => getComputedStyle(node).color);

      /*
        A verificação que só o navegador entrega: `color-mix` resolvido. Um
        substrato transparente significaria que o token derivado não chegou —
        e a classe estaria escrita do mesmo jeito, sem nada falhar.
      */
      expect(fundo, 'o substrato do distintivo não foi resolvido').not.toBe(
        'rgba(0, 0, 0, 0)',
      );
      expect(fundo, 'o substrato ficou igual ao glifo').not.toBe(glifo);
    });

    test(`no tema ${tema} o cartão selecionado se distingue do não selecionado`, async ({
      page,
    }) => {
      await ateDestinos(page, tema);

      const cartao = page.locator('[data-destino="spotify"]');
      const marcado = await cartao.evaluate((node) => ({
        fundo: getComputedStyle(node).backgroundColor,
        borda: getComputedStyle(node).borderTopColor,
      }));

      /*
        O clique vai no **cartão**: o controle real é `sr-only` desde a 008 e não
        tem área clicável própria, e desde a fidelidade de design o alvo é a área
        inteira — um `<label>` vazio em camada absoluta, e não mais só o título.

        Por coordenada, e não por `locator.click()`, porque o elemento que o
        ponteiro atinge é sempre essa camada: mirar o texto reprovaria na
        verificação de acionabilidade descrevendo como defeito o comportamento
        pretendido.
      */
      const area = await cartao.boundingBox();
      expect(area, 'o cartão não tem área na tela').not.toBeNull();
      await page.mouse.click(area!.x + area!.width / 2, area!.y + area!.height / 2);

      const desmarcado = await cartao.evaluate((node) => ({
        fundo: getComputedStyle(node).backgroundColor,
        borda: getComputedStyle(node).borderTopColor,
      }));

      // FR-024 pede **as duas** distinções: contorno **e** substrato.
      expect(desmarcado.fundo, 'o substrato não distingue o selecionado').not.toBe(marcado.fundo);
      expect(desmarcado.borda, 'o contorno não distingue o selecionado').not.toBe(marcado.borda);
    });

    test(`no tema ${tema} o painel de ordem de execução tem superfície e contorno próprios`, async ({
      page,
    }) => {
      await ateDestinos(page, tema);

      const painel = page.locator('aside > div').first();
      const estilo = await painel.evaluate((node) => ({
        fundo: getComputedStyle(node).backgroundColor,
        borda: getComputedStyle(node).borderTopColor,
      }));
      const corpo = await page
        .locator('body')
        .evaluate((node) => getComputedStyle(node).backgroundColor);

      expect(estilo.fundo, 'o painel se confunde com o substrato da página').not.toBe(corpo);
      expect(estilo.borda, 'o painel não tem contorno').not.toBe('rgba(0, 0, 0, 0)');
    });

    test(`no tema ${tema} o aviso do painel usa a tinta quente, não a secundária`, async ({
      page,
    }) => {
      /*
        `--accent-tint-ink` contra `--ink-muted`. O par antigo **passava** no
        contraste (4,78:1 no claro, 4,43:1 no escuro), e é justamente por isso
        que o portão precisa ser este: nenhum teste de limiar reprovaria um
        cinza-azulado frio sobre âmbar tingido, e ainda assim o arquivo de design
        escreve o aviso numa tinta da família do substrato.

        Comparado contra a legenda da fotografia, que é o `--ink-muted` do mesmo
        painel: ler o valor computado dos dois no mesmo tema é o que distingue "a
        classe está escrita" de "o token chegou na tela".
      */
      await ateDestinos(page, tema);

      const aviso = page.locator('aside p').filter({ hasText: t.destinations.panelHint });
      const legenda = page.locator('aside p').filter({ hasText: t.destinations.panelCaption });

      const corAviso = await aviso.evaluate((node) => getComputedStyle(node).color);
      const corLegenda = await legenda.evaluate((node) => getComputedStyle(node).color);

      expect(corAviso, 'o aviso voltou a usar a tinta secundária').not.toBe(corLegenda);

      /*
        E o glifo alinhado à **primeira linha**, não ao topo da caixa: com
        `items-start` puro ele pousa quase 3px acima do centro óptico. A
        asserção compara centros — o do ícone contra o da primeira linha de
        texto, medida por um intervalo sobre o próprio nó de texto.
      */
      const desalinho = await aviso.evaluate((node) => {
        const glifo = node.querySelector('svg')!.getBoundingClientRect();
        const texto = [...node.childNodes].find((n) => n.nodeType === Node.TEXT_NODE)!;
        const intervalo = document.createRange();
        intervalo.selectNodeContents(texto);
        const primeiraLinha = intervalo.getClientRects()[0]!;
        return Math.abs(
          glifo.top + glifo.height / 2 - (primeiraLinha.top + primeiraLinha.height / 2),
        );
      });

      expect(desalinho, 'o glifo do aviso não está alinhado à primeira linha').toBeLessThan(2);
    });
  }
});
