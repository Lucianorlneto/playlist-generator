import { expect, test } from '@playwright/test';

import { t } from '../src/i18n/pt-BR';
import { botaoConectar, botaoCriar, fmt, SPOTIFY, tituloResultado, tituloRevisao } from './support/flow';
import { CLIENT_ID, mockSpotify, seedCredential } from './support/spotify-mock';

/**
 * O fluxo completo de uma lista **sem separador algum** (US1, US2).
 *
 * É o pedido original em forma executável: colar uma lista que a versão anterior
 * reprovava inteira no parser, buscar, escolher à mão entre as candidatas de um
 * título isolado, confirmar e criar a playlist. Todos os provedores mockados,
 * nenhuma rede real (Princípio IV).
 *
 * Três coisas que só esta suíte verifica juntas:
 *
 * - nenhuma linha chega à revisão com "sem conteúdo para buscar";
 * - o título genérico pede escolha humana e **diz por quê**;
 * - a escolha manual entra na playlist criada.
 */

/** Nenhuma destas linhas tem hífen, travessão ou "by". Todas eram inválidas. */
const TITULO_GENERICO = 'Amor';

const LISTA = [
  'nao sei viver sem ter voce cpm 22',
  'zoio de lula charlie brown jr',
  TITULO_GENERICO,
].join('\n');

test.describe('003 — lista sem separador vira playlist', () => {
  test('cola, busca, escolhe à mão o título isolado e cria', async ({ page }) => {
    await mockSpotify(page, {
      ambiguousQueries: [TITULO_GENERICO],
      catalog: [
        { name: 'Não Sei Viver Sem Ter Você', artists: ['CPM 22'] },
        { name: 'Zoio de Lula', artists: ['Charlie Brown Jr'] },
      ],
    });
    await seedCredential(page, CLIENT_ID, 'spotify');
    await page.goto('/');

    await page.getByRole('button', { name: t.common.next, exact: true }).click();
    await page.getByRole('button', { name: t.common.next, exact: true }).click();

    // Etapa 3 — a dica precisa dizer que o separador é opcional (FR-006).
    await expect(page.getByRole('heading', { name: t.input.heading })).toBeVisible();
    await expect(page.getByText(t.input.separatorsHint)).toBeVisible();

    await page.getByLabel(t.input.textareaLabel).fill(LISTA);

    // US4/AC1 — a previsão de esforço aparece **antes** de começar.
    await expect(
      page.getByText(fmt(t.input.manualEffortOther, { count: 3 })),
    ).toBeVisible();

    await page.getByRole('button', { name: t.input.start }).click();
    await botaoConectar(page, SPOTIFY).click();
    await expect(tituloRevisao(page, SPOTIFY)).toBeVisible();

    const lista = page.getByRole('list', { name: t.review.listLabel });

    // Nenhuma linha foi reprovada por falta de separador — o portão saiu.
    await expect(lista.getByText(t.review.status.unparsed)).toHaveCount(0);
    await expect(lista.getByRole('listitem')).toHaveCount(3);

    // As duas linhas que trazem o artista no meio do texto resolvem sozinhas:
    // a reivindicação é decidida **pelos dados** (`003/research §4`).
    await expect(lista.getByText(t.review.status.confident)).toHaveCount(2);

    // O título genérico pede escolha, e o motivo é dito por extenso (FR-017).
    const itemGenerico = lista.getByRole('listitem').filter({ hasText: TITULO_GENERICO });
    await expect(itemGenerico.getByText(t.review.attentionReason.noArtistAmbiguous)).toBeVisible();

    // Escolha manual entre as candidatas daquele título isolado.
    await itemGenerico.getByRole('button', { name: t.review.alternatives }).click();
    await itemGenerico.getByRole('button', { name: t.review.chooseCandidate }).first().click();

    // Escolher marca o item para entrar; antes disso ele estava desmarcado.
    const caixaGenerico = itemGenerico.getByRole('checkbox');
    if (!(await caixaGenerico.isChecked())) await caixaGenerico.check();

    for (const caixa of await lista.getByRole('checkbox').all()) {
      if (await caixa.isDisabled()) continue;
      if (!(await caixa.isChecked())) await caixa.check();
    }

    await page.getByLabel(t.playlistConfig.nameLabel).fill('Sem Separador');
    await botaoCriar(page, SPOTIFY).click();

    await expect(tituloResultado(page, SPOTIFY)).toBeVisible();
    // As três linhas entraram: as duas que declaravam o artista no meio do
    // texto e a que precisou de escolha humana.
    const rotulo = page.getByRole('term').filter({ hasText: t.result.added });
    await expect(rotulo).toBeVisible();
    // O `<dd>` que segue o rótulo "Itens adicionados", não o primeiro da tela.
    await expect(
      page.locator('dt', { hasText: t.result.added }).locator('xpath=following-sibling::dd[1]'),
    ).toHaveText('3');
  });

  test('a linha sem conteúdo alfanumérico continua sendo recusada (FR-011)', async ({ page }) => {
    await mockSpotify(page);
    await seedCredential(page, CLIENT_ID, 'spotify');
    await page.goto('/');

    await page.getByRole('button', { name: t.common.next, exact: true }).click();
    await page.getByRole('button', { name: t.common.next, exact: true }).click();
    await page.getByLabel(t.input.textareaLabel).fill('zoio de lula charlie brown jr\n---\n🎵');
    await page.getByRole('button', { name: t.input.start }).click();
    await botaoConectar(page, SPOTIFY).click();
    await expect(tituloRevisao(page, SPOTIFY)).toBeVisible();

    const lista = page.getByRole('list', { name: t.review.listLabel });

    // Duas linhas de lixo, recusadas antes de custar qualquer requisição.
    await expect(lista.getByText(t.review.status.unparsed)).toHaveCount(2);
    await expect(lista.getByText(t.review.statusHint.unparsed).first()).toBeVisible();
  });
});
