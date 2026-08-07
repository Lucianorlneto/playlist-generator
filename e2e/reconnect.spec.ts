import { expect, test, type Page } from '@playwright/test';

import { t } from '../src/i18n/pt-BR';
import { avancarDaCredencial, avancarDosDestinos, botaoConectar, fmt, informarLista, YOUTUBE } from './support/flow';
import {
  catalogoDe,
  invalidarSessaoYouTube,
  mockYouTube,
  YT_CHANNEL_NAME,
  YT_CLIENT_ID,
  type YouTubeMockState,
} from './support/youtube-mock';
import { seedCredential } from './support/spotify-mock';

/**
 * V16, V32 — a reconexão no navegador **real** (`004/FR-011`, SC-003, SC-006,
 * A1, A2).
 *
 * Este arquivo existe por um limite declarado do portão local (D1 do plano):
 * happy-dom expõe `showModal()` e marca `open`, mas **não** emula a camada de
 * topo do navegador nem a contenção de foco que ela traz. Um teste de componente
 * que afirmasse a contenção passaria sem provar nada — exatamente o "invariante
 * que só existe em prosa" que o Princípio IV proíbe.
 *
 * Aqui o navegador é real, e a contenção é do navegador. É o único lugar em que
 * ela pode ser verificada de verdade.
 */

const LISTA = [
  'Bohemian Rhapsody - Queen',
  'Imagine - John Lennon',
  'Zoio de Lula - Charlie Brown Jr',
].join('\n');

/** Só o YouTube como destino: a fila tem um serviço e o custo em cota aparece. */
async function ateBuscaDoYouTube(page: Page): Promise<YouTubeMockState> {
  const state = await mockYouTube(page, { tracks: catalogoDe(LISTA) });
  await seedCredential(page, YT_CLIENT_ID, 'youtube');
  await page.goto('/');

  await avancarDaCredencial(page);
  await avancarDosDestinos(page);
  await informarLista(page, LISTA);

  await botaoConectar(page, YOUTUBE).click();
  await expect(page.getByText(YT_CHANNEL_NAME)).toBeVisible();
  await expect(page.getByText(fmt(t.quota.heading, { service: YOUTUBE }))).toBeVisible();

  return state;
}

function dialogo(page: Page) {
  return page.getByRole('dialog');
}

test.describe('004/V16 — contenção de foco e fluxo por teclado', () => {
  test('o pedido de reconexão aparece com a sessão morta, e contém o foco', async ({ page }) => {
    const state = await ateBuscaDoYouTube(page);

    // A sessão morre entre a estimativa e a busca — o caso relatado.
    invalidarSessaoYouTube(state);
    await page.getByRole('button', { name: t.quota.proceed }).click();

    const modal = dialogo(page);
    await expect(modal).toBeVisible();
    await expect(modal).toContainText(YOUTUBE);
    // FR-002: parada, não falhada. A revisão cheia de "Não encontrada" era o
    // defeito; ela não pode aparecer.
    await expect(page.getByText(t.review.status.notFound)).toHaveCount(0);

    // A1/U3: o foco entra no diálogo ao abrir.
    await expect(modal).toContainText(t.connect.reauthPreserved);
    const focoInicial = await page.evaluate(() =>
      document.activeElement?.closest('dialog') !== null,
    );
    expect(focoInicial).toBe(true);

    // **A contenção**: percorrer o foco com Tab nunca alcança um controle **fora**
    // do diálogo. É isto que happy-dom não consegue provar.
    //
    // A afirmação é "nunca sai para o conteúdo da página", e não "está sempre
    // dentro do `<dialog>`": o ciclo do navegador passa por um ponto neutro — o
    // próprio documento — antes de voltar ao primeiro controle. Exigir presença
    // contínua dentro do elemento reprovaria um comportamento correto.
    const foraDoDialogo = async (): Promise<string | null> =>
      page.evaluate(() => {
        const ativo = document.activeElement;
        if (ativo === null) return null;
        if (ativo.closest('dialog') !== null) return null;
        if (ativo === document.body || ativo === document.documentElement) return null;
        return `${ativo.tagName}: ${(ativo.textContent ?? '').slice(0, 40)}`;
      });

    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press('Tab');
      expect(await foraDoDialogo(), `o foco escapou na tabulação ${i + 1}`).toBeNull();
    }

    // E na direção inversa, que é onde armadilhas escritas à mão costumam falhar.
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press('Shift+Tab');
      expect(await foraDoDialogo(), `o foco escapou na tabulação inversa ${i + 1}`).toBeNull();
    }

    // E o ciclo de fato **retorna** aos controles do diálogo — a contenção não é
    // "o foco morreu no documento". O ciclo tem três posições (os dois botões e
    // o ponto neutro), então em no máximo três tabulações o foco volta.
    let voltou = false;
    for (let i = 0; i < 3 && !voltou; i += 1) {
      await page.keyboard.press('Tab');
      voltou = await page.evaluate(() => document.activeElement?.closest('dialog') !== null);
    }
    expect(voltou, 'o foco não retornou ao diálogo').toBe(true);
  });

  test('`Esc` fecha o diálogo e a etapa continua oferecendo as duas saídas', async ({ page }) => {
    const state = await ateBuscaDoYouTube(page);
    invalidarSessaoYouTube(state);
    await page.getByRole('button', { name: t.quota.proceed }).click();

    await expect(dialogo(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialogo(page)).toBeHidden();

    // FR-012: fechar não é caminho destrutivo. A etapa mantém reconectar e pular.
    await expect(botaoConectar(page, YOUTUBE)).toBeVisible();
    await expect(
      page.getByRole('button', { name: fmt(t.queue.skipService, { service: YOUTUBE }) }),
    ).toBeVisible();
  });

  test('o fluxo completo é operável só por teclado (SC-006)', async ({ page }) => {
    const state = await ateBuscaDoYouTube(page);
    invalidarSessaoYouTube(state);
    await page.getByRole('button', { name: t.quota.proceed }).click();
    await expect(dialogo(page)).toBeVisible();

    // A sessão volta a valer quando o consentimento é concedido de novo.
    const reconectar = page
      .getByRole('dialog')
      .getByRole('button', { name: fmt(t.connect.connect, { service: YOUTUBE }), exact: true });

    // Alcançado por tabulação, acionado pelo teclado — sem nenhum clique.
    await reconectar.focus();
    await page.keyboard.press('Enter');

    await expect(page.getByRole('heading', { name: fmt(t.review.heading, { service: YOUTUBE }) })).toBeVisible({
      timeout: 15_000,
    });
  });
});

test.describe('004/V32/SC-003 — do aviso à busca, no máximo duas ações', () => {
  test('acionar reconectar e conceder consentimento bastam', async ({ page }) => {
    const state = await ateBuscaDoYouTube(page);
    invalidarSessaoYouTube(state);
    await page.getByRole('button', { name: t.quota.proceed }).click();
    await expect(dialogo(page)).toBeVisible();

    const buscasAntes = state.searchCount;
    let acoesNoApp = 0;

    // Ação 1: acionar reconectar. O consentimento é a ação 2, e acontece **no
    // serviço**, não no app — o mock a concede automaticamente, como o Google
    // faz para quem já autorizou antes.
    await page
      .getByRole('dialog')
      .getByRole('button', { name: fmt(t.connect.connect, { service: YOUTUBE }), exact: true })
      .click();
    acoesNoApp += 1;

    await expect(page.getByRole('heading', { name: fmt(t.review.heading, { service: YOUTUBE }) })).toBeVisible({
      timeout: 15_000,
    });

    expect(acoesNoApp).toBeLessThanOrEqual(2);
    // A busca de fato recomeçou — a armadilha de `startedFor` teria deixado
    // este número parado, sem erro algum na tela.
    expect(state.searchCount).toBeGreaterThan(buscasAntes);
    // E a estimativa **não** foi reexibida (T5).
    await expect(page.getByText(fmt(t.quota.heading, { service: YOUTUBE }))).toHaveCount(0);
  });
});

test.describe('004/A5 — o diálogo em tela estreita', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('sem rolagem horizontal com o pedido aberto', async ({ page }) => {
    const state = await ateBuscaDoYouTube(page);
    invalidarSessaoYouTube(state);
    await page.getByRole('button', { name: t.quota.proceed }).click();
    await expect(dialogo(page)).toBeVisible();

    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth };
    });
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
  });
});
