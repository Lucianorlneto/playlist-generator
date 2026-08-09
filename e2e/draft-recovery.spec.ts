import { expect, test, type Page } from '@playwright/test';

import { t } from '../src/i18n/pt-BR';
import {
  ateEntrada,
  ateRevisao,
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
 * Recuperação do rascunho no esquema v2 (FR-037 a FR-039, FR-042, SC-014).
 *
 * O que mudou em relação à 001: o rascunho guarda a **fila** inteira, e a
 * retomada volta ao serviço e à etapa exatos — não só à etapa global. Um serviço
 * já concluído volta com o resultado congelado.
 */

const LISTA = ['Bohemian Rhapsody - Queen', 'Imagine - John Lennon', 'Hey Jude - The Beatles'].join(
  '\n',
);

const CHAVE_RASCUNHO = 'tp.v2.draft';
const CHAVE_CREDENCIAL = 'tp.v2.credential.spotify';

/** O rascunho é gravado com debounce de 500 ms. */
async function esperarGravacao(page: Page): Promise<void> {
  await page.waitForTimeout(900);
}

test.describe('US4 — recuperação do rascunho', () => {
  test('recarregar no meio da revisão retoma na mesma etapa com as escolhas intactas', async ({
    page,
  }) => {
    await mockSpotify(page);
    await seedCredential(page);
    await ateRevisao(page, LISTA, SPOTIFY);

    await page.getByLabel(t.playlistConfig.nameLabel).fill('Trabalho em Andamento');

    // Escolha manual: desmarcar a primeira faixa.
    const primeiraCaixa = page.getByRole('checkbox').first();
    await primeiraCaixa.uncheck();
    await expect(primeiraCaixa).not.toBeChecked();

    await esperarGravacao(page);
    await page.reload();

    await expect(page.getByText(t.draft.recoveredHeading)).toBeVisible();
    await expect(tituloRevisao(page, SPOTIFY)).toBeVisible();
    await expect(page.getByLabel(t.playlistConfig.nameLabel)).toHaveValue('Trabalho em Andamento');
    await expect(page.getByRole('checkbox').first()).not.toBeChecked();
    await expect(page.getByText('Bohemian Rhapsody - Queen')).toBeVisible();
  });

  test('descartar o rascunho zera o trabalho e preserva a credencial', async ({ page }) => {
    await mockSpotify(page);
    await seedCredential(page);
    await ateEntrada(page, LISTA);

    await esperarGravacao(page);
    await page.reload();

    await expect(page.getByText(t.draft.recoveredHeading)).toBeVisible();
    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: t.draft.discard }).click();

    await expect(page.getByText(t.draft.discarded)).toBeVisible();
    // O descarte devolve à escolha de destinos, com o trabalho zerado.
    await expect(page.getByRole('heading', { name: t.destinations.heading })).toBeVisible();

    // A credencial sobrevive ao descarte, no esquema v2 (FR-006).
    await page.reload();
    const credencial = await page.evaluate(
      (chave) => window.localStorage.getItem(chave),
      CHAVE_CREDENCIAL,
    );
    expect(credencial).not.toBeNull();
  });

  test('a criação bem-sucedida apaga o rascunho', async ({ page }) => {
    await mockSpotify(page);
    await seedCredential(page);
    await ateRevisao(page, LISTA, SPOTIFY);

    await page.getByLabel(t.playlistConfig.nameLabel).fill('Lista Concluída');
    await botaoCriar(page, SPOTIFY).click();
    await expect(tituloResultado(page, SPOTIFY)).toBeVisible();

    const rascunho = await page.evaluate(
      (chave) => window.localStorage.getItem(chave),
      CHAVE_RASCUNHO,
    );
    expect(rascunho).toBeNull();
  });

  test('a retomada volta ao serviço e à etapa exatos, com o serviço concluído congelado (SC-014)', async ({
    page,
  }) => {
    await mockSpotify(page);
    await mockYouTube(page, { tracks: catalogoDe(LISTA) });
    await seedCredential(page, CLIENT_ID, 'spotify');
    await seedCredential(page, YT_CLIENT_ID, 'youtube');

    // Ciclo do Spotify até o resultado.
    await ateEntrada(page, LISTA);
    await botaoConectar(page, SPOTIFY).click();
    await expect(tituloRevisao(page, SPOTIFY)).toBeVisible();
    await page.getByLabel(t.playlistConfig.nameLabel).fill('Dois Destinos');
    await botaoCriar(page, SPOTIFY).click();
    await expect(tituloResultado(page, SPOTIFY)).toBeVisible();

    // Ciclo do YouTube, parando na revisão.
    await page.getByRole('button', { name: fmt(t.result.continueNext, { service: YOUTUBE }) }).click();
    await botaoConectar(page, YOUTUBE).click();
    await expect(page.getByRole('banner').getByText(YT_CHANNEL_NAME)).toBeVisible();
    await page.getByRole('button', { name: t.quota.proceed }).click();
    await expect(tituloRevisao(page, YOUTUBE)).toBeVisible();

    await esperarGravacao(page);
    await page.reload();

    // FR-039, SC-014: volta ao **segundo** serviço, na revisão, com o texto, o
    // nome e a seleção de destinos preservados.
    await expect(page.getByText(t.draft.recoveredHeading)).toBeVisible();
    await expect(tituloRevisao(page, YOUTUBE)).toBeVisible();
    await expect(page.getByLabel(t.playlistConfig.nameLabel)).toHaveValue('Dois Destinos');
    await expect(
      page.getByText(fmt(t.queue.position, { service: YOUTUBE, current: 2, total: 2 })),
    ).toBeVisible();
  });

  test('o encerramento por cota preserva o rascunho para relato (FR-038)', async ({ page }) => {
    await mockSpotify(page);
    // A primeira inserção passa; a segunda esbarra na cota.
    await mockYouTube(page, { tracks: catalogoDe(LISTA), quotaExceededFromItem: 1 });
    await seedCredential(page, YT_CLIENT_ID, 'youtube');

    await ateEntrada(page, LISTA);
    await botaoConectar(page, YOUTUBE).click();
    await expect(page.getByRole('banner').getByText(YT_CHANNEL_NAME)).toBeVisible();
    await page.getByRole('button', { name: t.quota.proceed }).click();
    await expect(tituloRevisao(page, YOUTUBE)).toBeVisible();

    await page.getByLabel(t.playlistConfig.nameLabel).fill('Vai Faltar Cota');
    await incluirPendentes(page);
    await botaoCriar(page, YOUTUBE).click();

    await expect(
      page.getByText(fmt(t.quota.exhaustedHeading, { service: YOUTUBE })),
    ).toBeVisible();

    // FR-038: o rascunho **permanece** — a reabertura oferece relato e descarte,
    // nunca retomada.
    const rascunho = await page.evaluate(
      (chave) => window.localStorage.getItem(chave),
      CHAVE_RASCUNHO,
    );
    expect(rascunho).not.toBeNull();
  });
});
