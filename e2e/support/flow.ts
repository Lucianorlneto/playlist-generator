import { expect, type Page } from '@playwright/test';

import { t } from '../../src/i18n/pt-BR';

/**
 * Navegação compartilhada pelas suítes de ponta a ponta.
 *
 * O fluxo tem cinco etapas (FR-043) e quase todo rótulo interpola `{service}`.
 * Deixar isso espalhado por arquivo produziria seis cópias divergentes da mesma
 * sequência — e foi exatamente o que aconteceu quando a 001 tinha quatro etapas
 * e um provedor só.
 *
 * ```text
 * Configuração → Destinos → Entrada → [ciclo por serviço] → Resumo
 * ```
 */

export const SPOTIFY = t.providers.spotify.name;
export const YOUTUBE = t.providers.youtube.name;

/** Mesma interpolação de `src/i18n`, replicada para não importar a runtime. */
export function fmt(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/gu, (match, key: string) =>
    Object.hasOwn(values, key) ? String(values[key]) : match,
  );
}

/** Bloco de credencial de um serviço na etapa 1 — evita ambiguidade entre os dois. */
export function secaoCredencial(page: Page, service: string) {
  const heading =
    service === SPOTIFY
      ? t.providers.spotify.credentialHeading
      : t.providers.youtube.credentialHeading;
  return page.getByRole('region', { name: heading });
}

/** Etapa 1 → 2. As credenciais já estão salvas; basta confirmar. */
export async function avancarDaCredencial(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: t.credential.heading })).toBeVisible();
  await page.getByRole('button', { name: t.common.next, exact: true }).click();
}

/** Etapa 2 → 3. Os destinos com credencial já vêm marcados (SC-003). */
export async function avancarDosDestinos(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: t.destinations.heading })).toBeVisible();
  await page.getByRole('button', { name: t.common.next, exact: true }).click();
}

/** Etapa 3 → ciclo do primeiro serviço. A lista é informada uma vez só (FR-013). */
export async function informarLista(page: Page, lista: string): Promise<void> {
  await expect(page.getByRole('heading', { name: t.input.heading })).toBeVisible();
  await page.getByLabel(t.input.textareaLabel).fill(lista);
  await page.getByRole('button', { name: t.input.start }).click();
}

/** Abertura → entrada, parando antes do ciclo do primeiro serviço. */
export async function ateEntrada(page: Page, lista: string): Promise<void> {
  await page.goto('/');
  await avancarDaCredencial(page);
  await avancarDosDestinos(page);
  await informarLista(page, lista);
}

export function botaoConectar(page: Page, service: string) {
  return page.getByRole('button', { name: fmt(t.connect.connect, { service }) });
}

export function botaoCriar(page: Page, service: string) {
  return page.getByRole('button', { name: fmt(t.playlistConfig.create, { service }) });
}

export function tituloRevisao(page: Page, service: string) {
  return page.getByRole('heading', { name: fmt(t.review.heading, { service }) });
}

export function tituloResultado(page: Page, service: string) {
  return page.getByRole('heading', { name: fmt(t.result.heading, { service }) });
}

/**
 * Marca as candidatas que a revisão deixou desmarcadas.
 *
 * No YouTube isso é a regra, não a exceção: o limiar de confiança é 0,88 e todo
 * indício de versão rebaixa o item para `Incerta` (FR-023, FR-025). Confirmar
 * item por item é justamente o que FR-019 exige do usuário.
 */
export async function incluirPendentes(page: Page): Promise<void> {
  const caixas = page.getByRole('list', { name: t.review.listLabel }).getByRole('checkbox');
  for (const caixa of await caixas.all()) {
    if (await caixa.isDisabled()) continue;
    if (!(await caixa.isChecked())) await caixa.check();
  }
}

/** Abertura → revisão do primeiro serviço da fila, com autorização feita. */
export async function ateRevisao(
  page: Page,
  lista: string,
  service: string = SPOTIFY,
): Promise<void> {
  await ateEntrada(page, lista);
  await botaoConectar(page, service).click();
  await expect(tituloRevisao(page, service)).toBeVisible();
}
