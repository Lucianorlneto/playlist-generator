import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { DURACAO_MS } from '@/ui/motion/scale';
import { comFusaoDeTema } from '@/ui/motion/themeTransition';

/**
 * A fusão da troca de tema — 010/FR-029, FR-014, FR-015.
 *
 * ## O invariante que importa não é a fusão; é a mudança
 *
 * A fusão é enfeite: navegador sem suporte, ou pessoa que pediu menos
 * movimento, recebe a troca seca — que é o comportamento de sempre. O que **não**
 * pode variar é a mudança acontecer, exatamente uma vez, em todo caminho. Um
 * tema que não trocasse porque a API faltou seria perda de função, e é isso que
 * estes casos vigiam.
 */

const CSS = readFileSync(join(process.cwd(), 'src/styles/index.css'), 'utf8');

/** Um `Document` de mentira com só o que a função consulta. */
function documentoCom(startViewTransition: ((cb: () => void) => unknown) | undefined): Document {
  return { startViewTransition } as unknown as Document;
}

function preferirMovimentoReduzido(reduzir: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    (query: string) => ({
      matches: reduzir && query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('FR-029 · a mudança acontece uma vez, com fusão ou sem', () => {
  it('com suporte e sem preferência, a mudança atravessa a transição de vista', () => {
    preferirMovimentoReduzido(false);

    const mudar = vi.fn();
    const iniciar = vi.fn((callback: () => void) => {
      callback();
      return {};
    });

    comFusaoDeTema(mudar, documentoCom(iniciar));

    expect(iniciar).toHaveBeenCalledTimes(1);
    expect(mudar).toHaveBeenCalledTimes(1);
  });

  it('sem suporte, a mudança acontece direto — e acontece', () => {
    /*
      **É o caso que protege a função, não o enfeite.** A API é recente; um
      navegador sem ela tem de receber a troca de tema de sempre, e não uma tela
      que não troca de cor.
    */
    preferirMovimentoReduzido(false);

    const mudar = vi.fn();
    comFusaoDeTema(mudar, documentoCom(undefined));

    expect(mudar).toHaveBeenCalledTimes(1);
  });

  it('sob movimento reduzido, a API nem é chamada', () => {
    preferirMovimentoReduzido(true);

    const mudar = vi.fn();
    const iniciar = vi.fn();

    comFusaoDeTema(mudar, documentoCom(iniciar));

    expect(
      iniciar,
      'A fusão cobre a tela inteira — é o movimento mais amplo do produto. Quem pediu menos ' +
        'movimento recebe a troca seca (FR-014).',
    ).not.toHaveBeenCalled();
    expect(mudar, 'e o tema troca do mesmo jeito (FR-015)').toHaveBeenCalledTimes(1);
  });

  it('sem `matchMedia`, a ausência não é lida como preferência', () => {
    // Ambiente sem a consulta é ambiente sem preferência declarada. Tratar a
    // ausência como "reduzir" desligaria a fusão em navegador nenhum e em
    // ambiente de teste — falhando para o lado errado, em silêncio.
    vi.stubGlobal('matchMedia', undefined);

    const mudar = vi.fn();
    const iniciar = vi.fn((callback: () => void) => {
      callback();
      return {};
    });

    comFusaoDeTema(mudar, documentoCom(iniciar));

    expect(iniciar).toHaveBeenCalledTimes(1);
    expect(mudar).toHaveBeenCalledTimes(1);
  });
});

describe('FR-006 · a duração da fusão vem da escala, não de um número solto', () => {
  it('o CSS lê o degrau `theme`', () => {
    const bloco =
      /::view-transition-group\(root\),\s*::view-transition-old\(root\),\s*::view-transition-new\(root\)\s*\{([\s\S]*?)\}/u.exec(
        CSS,
      )?.[1] ?? '';

    expect(bloco).toContain('var(--transition-duration-theme)');
    expect(bloco).toContain('var(--ease-standard)');
    // E o degrau existe na origem, com o valor que o contrato declara.
    expect(DURACAO_MS.theme).toBe(400);
  });

  it('a supressão alcança os pseudo-elementos, que o seletor universal não casa', () => {
    /*
      **Sem esta regra a fusão seria o único movimento fora do alcance da
      preferência.** A regra global de `index.css` usa `*`, e `*` não casa
      pseudo-elemento — a supressão em JavaScript cobriria o caminho normal, mas
      não um `startViewTransition` disparado de qualquer outro lugar.
    */
    const suprime =
      /@media \(prefers-reduced-motion: reduce\) \{\s*::view-transition-old\(root\),\s*::view-transition-new\(root\)\s*\{\s*animation:\s*none/u.test(
        CSS,
      );

    expect(suprime, 'nenhuma regra de movimento reduzido alcança ::view-transition-*').toBe(true);
  });
});
