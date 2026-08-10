import { expect, test, type Page } from '@playwright/test';

import { t } from '../src/i18n/pt-BR';
import { CLIENT_ID, mockSpotify, seedCredential } from './support/spotify-mock';

/**
 * A casca não rola; quem rola é o conteúdo.
 *
 * ## Por que isto precisa de teste, e por que ele precisa ser de navegador
 *
 * A barra superior e a trilha são **zonas de orientação**: elas respondem
 * "estou conectado?" e "onde eu estou, e o que já decidi?". Uma zona que
 * responde a pergunta de orientação deixa de responder no instante em que sai da
 * tela — e era o que acontecia enquanto a página inteira rolava.
 *
 * A estrutura que corrige isso é frágil de um jeito específico: ela depende de
 * **`min-h-0`** num item de flex. Um item de flex tem `min-height: auto` por
 * padrão e se recusa a encolher abaixo do próprio conteúdo, de modo que sem essa
 * classe o contêiner cresce e devolve a rolagem ao documento — levando as duas
 * zonas junto. A classe pode ser removida por engano numa refatoração de layout
 * e **nada falha**: a tela continua funcionando, só volta a rolar inteira.
 *
 * Nenhum teste de componente alcança isso. `jsdom` e `happy-dom` não fazem
 * layout: `scrollHeight` e `clientHeight` são zero, e a asserção passaria vazia
 * em qualquer estrutura.
 */

/** Leva a uma etapa alta o bastante para a área de conteúdo rolar. */
async function ateEtapaAlta(page: Page): Promise<void> {
  await mockSpotify(page);
  await seedCredential(page, CLIENT_ID, 'spotify');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: t.credential.heading })).toBeVisible();
}

/** Os contêineres que de fato rolam agora, com o quanto rolaram. */
async function rolarTudoQuePode(page: Page): Promise<number> {
  return page.evaluate(() => {
    const roláveis = [...document.querySelectorAll('*')].filter((node) => {
      const overflow = getComputedStyle(node).overflowY;
      return (
        (overflow === 'auto' || overflow === 'scroll') && node.scrollHeight > node.clientHeight + 1
      );
    });
    for (const node of roláveis) node.scrollTop = node.scrollHeight;
    return roláveis.length;
  });
}

test.describe('a barra superior e a trilha permanecem à vista', () => {
  test('nem uma nem outra se move quando o conteúdo rola', async ({ page }) => {
    await ateEtapaAlta(page);

    const barra = page.getByRole('banner');
    const trilha = page.getByRole('navigation', { name: t.rail.title });

    const antesBarra = await barra.boundingBox();
    // A trilha não existe abaixo do ponto de corte; o caso roda nos dois
    // projetos, e ali a asserção sobre ela simplesmente não se aplica.
    const temTrilha = (await trilha.count()) > 0;
    const antesTrilha = temTrilha ? await trilha.boundingBox() : null;

    const quantos = await rolarTudoQuePode(page);
    expect(quantos, 'nada rolou — o cenário não exercitou a fixação').toBeGreaterThan(0);

    expect((await barra.boundingBox())?.y, 'a barra superior saiu do lugar').toBe(antesBarra?.y);
    if (antesTrilha !== null) {
      expect((await trilha.boundingBox())?.y, 'a trilha saiu do lugar').toBe(antesTrilha.y);
    }
  });

  test('a barra de ações também fica, e no pé da janela', async ({ page }) => {
    /*
      **A terceira zona fixa, e a que ficou de fora até a fidelidade de design da
      008.** A faixa de ações nasceu dentro do contêiner que rola, e o defeito não
      aparecia em tela vazia: só quando a etapa ficava alta — em Destinos, a faixa
      de adesivos foi o bastante — "Continuar" saía do campo de visão e o usuário
      tinha de rolar para descobrir que havia como avançar.

      O arquivo de design a desenha fora da rolagem, encostada no pé da área
      principal (`Action Bar`, 78 px dos 892 de `Body`), e é isso que as duas
      asserções abaixo fixam: ela não se move, e o seu pé é o pé da janela.
    */
    await mockSpotify(page);
    await seedCredential(page, CLIENT_ID, 'spotify');
    await page.goto('/');
    await expect(page.getByRole('heading', { name: t.credential.heading })).toBeVisible();
    // Destinos é a etapa em que a faixa convive com a decoração alta.
    await page.getByRole('button', { name: t.common.next, exact: true }).click();
    await expect(page.getByRole('heading', { name: t.destinations.heading })).toBeVisible();

    const faixa = page.getByRole('group', { name: t.actionBar.label });
    const antes = await faixa.boundingBox();
    expect(antes, 'a etapa de Destinos deixou de ter faixa de ações').not.toBeNull();

    await rolarTudoQuePode(page);

    expect((await faixa.boundingBox())?.y, 'a faixa de ações saiu do lugar').toBe(antes?.y);

    const altura = page.viewportSize()?.height ?? 0;
    expect(
      (antes?.y ?? 0) + (antes?.height ?? 0),
      'a faixa de ações não está encostada no pé da janela',
    ).toBeCloseTo(altura, 0);
  });

  test('o documento não rola — a rolagem pertence à área de conteúdo', async ({ page }) => {
    await ateEtapaAlta(page);
    await rolarTudoQuePode(page);

    /*
      A asserção que pega a remoção do `min-h-0`. Se o contêiner voltar a crescer,
      a rolagem volta para o documento — e é justamente aí que o documento passa
      a ter conteúdo além da janela.
    */
    const documento = await page.evaluate(() => ({
      scrollTop: document.documentElement.scrollTop,
      excedente: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    }));

    expect(documento.scrollTop).toBe(0);
    expect(
      documento.excedente,
      'o documento voltou a ter conteúdo além da janela',
    ).toBeLessThanOrEqual(1);
  });

  test('nem a rolagem programática move a casca', async ({ page }) => {
    /*
      **O caminho que escapou na primeira tentativa desta correção, e por isso
      tem caso próprio.**

      Rolar com a roda funcionava, e o defeito ficava invisível: os `sr-only` do
      produto são `position: absolute` e, sem um ancestral posicionado, ancoravam
      no **documento** — escapando do `overflow-hidden` da casca e devolvendo ao
      html 832 px de altura fantasma. Nada aparecia na tela até alguém usar o
      caminho de teclado, o link "Ir para o conteúdo" ou qualquer coisa que
      chame `scrollIntoView` — e aí a página inteira deslizava, levando a barra
      superior para fora.

      Os três gestos abaixo cobrem os três caminhos: roda, API e âncora.
    */
    await ateEtapaAlta(page);
    const barra = page.getByRole('banner');
    const origem = await barra.boundingBox();

    await page.evaluate(() => {
      window.scrollTo(0, 5000);
    });
    expect((await barra.boundingBox())?.y, 'window.scrollTo moveu a casca').toBe(origem?.y);

    await page.mouse.move(400, 400);
    await page.mouse.wheel(0, 800);
    expect((await barra.boundingBox())?.y, 'a roda do mouse moveu a casca').toBe(origem?.y);

    await page.evaluate(() => {
      document.getElementById('conteudo')?.scrollIntoView();
    });
    expect((await barra.boundingBox())?.y, 'o salto de âncora moveu a casca').toBe(origem?.y);

    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test('todo contêiner rolável é alcançável por teclado', async ({ page }) => {
    /*
      Uma região que rola e não contém nada focável é inalcançável por teclado —
      quem navega sem ponteiro não tem como chegar ao conteúdo escondido. É a
      regra `scrollable-region-focusable` do axe, que os testes de acessibilidade
      deste projeto **não** pegam: sem layout, `happy-dom` nunca considera nada
      rolável.

      A área de conteúdo sempre tem controles, e a trilha tem a ação de recomeçar
      quando há trabalho a descartar. A asserção existe para o dia em que uma
      dessas duas coisas deixar de ser verdade.
    */
    await ateEtapaAlta(page);

    const semSaida = await page.evaluate(() => {
      const FOCAVEL =
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
        'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

      return [...document.querySelectorAll('*')]
        .filter((node) => {
          const overflow = getComputedStyle(node).overflowY;
          return (
            (overflow === 'auto' || overflow === 'scroll') &&
            node.scrollHeight > node.clientHeight + 1
          );
        })
        .filter((node) => node.querySelector(FOCAVEL) === null && !node.matches(FOCAVEL))
        .map((node) => `${node.tagName.toLowerCase()}.${node.className.toString().split(' ')[0] ?? ''}`);
    });

    expect(
      semSaida,
      `Contêineres que rolam sem nenhum elemento focável dentro: ${semSaida.join(', ')}. ` +
        'Dê a eles `tabIndex={0}` ou garanta um controle alcançável no conteúdo.',
    ).toEqual([]);
  });
});
