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

    // FR-018: a posição na fila é anunciada, não apenas desenhada.
    await expect(page.getByLabel(t.queue.label)).toHaveText(
      fmt(t.queue.position, { service: SPOTIFY, current: 1, total: 2 }),
    );

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
 * e sua cor é `--accent-text` — que **diverge entre os temas**: `#9a5b00` no
 * claro, `#f4a900` no escuro. Verificar num tema só deixaria metade da
 * afirmação sem prova.
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
      // A cor do anel acompanha o tema.
      expect(foco.outlineColor).toBe(tema === 'dark' ? 'rgb(244, 169, 0)' : 'rgb(154, 91, 0)');
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
