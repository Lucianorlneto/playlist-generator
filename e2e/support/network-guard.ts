import { expect, type Page } from '@playwright/test';

/**
 * Guarda de origem remota no navegador de verdade (FR-039, SC-014) — T070.
 *
 * A varredura estática de `tests/unit/no-secrets.spec.ts` lê o código-fonte.
 * Esta camada observa o que a página **realmente pede** — que é o único lugar
 * onde uma origem embutida por dependência transitiva, por sourcemap ou por um
 * `url()` gerado em tempo de build apareceria.
 *
 * A lista é fechada, no mesmo espírito da tabela de hosts do Princípio II:
 * host não declarado é falha, não aviso.
 */

/**
 * Hosts autorizados.
 *
 * Espelha `PROVIDER_HOSTS` de `src/services/providers/hosts.ts` mais os dois
 * hosts de imagem que o CSP já permite em `img-src`. Nos testes os provedores
 * estão mockados por `page.route`, então na prática nem esses são alcançados —
 * mas declará-los mantém a lista honesta sobre o que o produto pode pedir.
 */
const HOSTS_AUTORIZADOS = new Set([
  'accounts.spotify.com',
  'api.spotify.com',
  'www.googleapis.com',
  'accounts.google.com',
  'i.scdn.co',
  'i.ytimg.com',
]);

/** Esquemas que não são rede: dados embutidos e o próprio artefato. */
const ESQUEMAS_LOCAIS = new Set(['data:', 'blob:', 'about:', 'file:']);

export interface NetworkGuard {
  /** Requisições que escaparam da lista, na ordem em que aconteceram. */
  readonly escapes: string[];
  /** Falha o teste se alguma escapou. */
  assertClean: () => void;
}

/**
 * Instala o ouvinte. Precisa ser chamado **antes** do primeiro `goto`, ou as
 * requisições da carga inicial — justamente onde a fonte entraria — passariam
 * despercebidas.
 */
export function guardNetwork(page: Page, baseUrl = '127.0.0.1'): NetworkGuard {
  const escapes: string[] = [];

  page.on('request', (request) => {
    const url = request.url();

    const esquema = url.slice(0, url.indexOf(':') + 1);
    if (ESQUEMAS_LOCAIS.has(esquema)) return;

    let host: string;
    try {
      host = new URL(url).hostname;
    } catch {
      return;
    }

    // Mesma origem: o dev server e o `dist/` servido.
    if (host === baseUrl || host === 'localhost') return;
    if (HOSTS_AUTORIZADOS.has(host)) return;

    escapes.push(`${request.method()} ${url}`);
  });

  return {
    escapes,
    assertClean: () => {
      expect(
        escapes,
        `Requisições para host não autorizado (FR-039):\n  ${escapes.join('\n  ')}`,
      ).toEqual([]);
    },
  };
}
