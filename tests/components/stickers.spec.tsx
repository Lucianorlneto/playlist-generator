import { cleanup, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as MotionModule from '@/ui/motion';
import type { StaggerProps } from '@/ui/motion/Stagger';

import { instalarPreferenciaDeMovimento, preferirMovimentoReduzido } from '../support/movimento';

/**
 * Os adesivos de Destinos — FR-014, FR-032, FR-032a, FR-033, SC-017
 * (`010/contracts/surfaces.md` §5).
 *
 * ## Uma vez por sessão, e a razão é de atenção
 *
 * Voltar a Destinos para corrigir a lista ou trocar de destino é caminho comum.
 * Reencenar onze adesivos a cada volta chamaria atenção justamente para o que
 * menos importa na tela — e o que é charme na primeira vez é ruído na terceira.
 *
 * O sinalizador vive **em memória** e nunca é persistido: nem no rascunho, nem
 * em chave nova de armazenamento. Um rascunho recuperado não deve carregar o que
 * já foi encenado, e recarregar a página legitimamente reencena — é uma sessão
 * nova (`010/data-model.md` §4.1).
 *
 * ## Por que a primitiva é dublada em vez de observada pelo DOM
 *
 * A biblioteca de movimento **não produz rastro nenhum em `happy-dom`**: sem
 * WAAPI e sem loop de quadros, `animate()` não escreve estilo em linha e não
 * agenda `requestAnimationFrame`. Uma asserção sobre o DOM mediria a ausência do
 * ambiente, não a decisão do componente — e passaria com a encenação ligada ou
 * desligada, indiferentemente.
 *
 * O que **é** decisão do componente, e é o que o FR-032a governa, é montar ou
 * não a primitiva. O dublê torna isso observável sem inventar um atributo de
 * teste no código de produção.
 */

const encenacoes = vi.hoisted(() => ({ papeis: [] as string[] }));

vi.mock('@/ui/motion', async (importarOriginal) => {
  const original = await importarOriginal<typeof MotionModule>();
  return {
    ...original,
    Stagger: ({ role, className, decorative, children }: StaggerProps) => {
      encenacoes.papeis.push(role);
      return (
        <div className={className} aria-hidden={decorative === true ? 'true' : undefined}>
          {children}
        </div>
      );
    },
  };
});

const { Stickers, __reencenarAdesivos } = await import('@/ui/Stickers');

instalarPreferenciaDeMovimento();

function adesivos(container: HTMLElement): HTMLImageElement[] {
  return [...container.querySelectorAll('img')];
}

function camada(container: HTMLElement): HTMLElement {
  const no = container.querySelector<HTMLElement>('[aria-hidden="true"]');
  if (no === null) throw new Error('a camada de adesivos não foi encontrada');
  return no;
}

beforeEach(() => {
  preferirMovimentoReduzido(false);
  __reencenarAdesivos();
  encenacoes.papeis = [];
});

describe('FR-032 · a primeira aparição encena', () => {
  it('a camada monta no papel `decor`, com os onze adesivos', () => {
    const { container } = render(<Stickers />);

    expect(encenacoes.papeis).toEqual(['decor']);
    expect(adesivos(container)).toHaveLength(11);
  });
});

describe('FR-032a e SC-017 · a segunda aparição mostra os adesivos já postos', () => {
  it('remontar na mesma sessão não reencena', () => {
    render(<Stickers />);
    cleanup();
    encenacoes.papeis = [];

    const { container } = render(<Stickers />);

    expect(
      encenacoes.papeis,
      'Voltar a Destinos é caminho comum. O que é charme na primeira vez é ruído na terceira ' +
        '(FR-032a, contracts/surfaces.md §5.0).',
    ).toEqual([]);
    expect(adesivos(container)).toHaveLength(11);
  });

  it('e os onze continuam nas coordenadas da tabela', () => {
    render(<Stickers />);
    cleanup();

    const { container } = render(<Stickers />);
    for (const adesivo of adesivos(container)) {
      const estilo = adesivo.getAttribute('style') ?? '';
      expect(estilo).toContain('left');
      expect(estilo).toContain('top');
      expect(estilo).toContain('width');
    }
  });

  it('uma sessão nova reencena — o contrapeso', () => {
    /*
      **Sem este caso, "não reencenou" mede a si mesmo.** A asserção passaria com
      o sinalizador preso em `true` desde o início, e a primeira aparição nunca
      encenaria. Recarregar a página é uma sessão nova, e reencenar ali é o
      comportamento certo (contracts/surfaces.md §5.0).
    */
    render(<Stickers />);
    cleanup();
    encenacoes.papeis = [];

    __reencenarAdesivos();
    render(<Stickers />);

    expect(encenacoes.papeis).toEqual(['decor']);
  });
});

describe('FR-014 · sob movimento reduzido não existe etapa intermediária', () => {
  it('os onze estão lá desde o primeiro quadro', () => {
    /*
      A supressão em si é da primitiva — `Stagger` consulta `useReducedMotion()`
      e devolve todos os irmãos visíveis, sem defasagem, e o portão disso está em
      `tests/unit/motion-catalog.spec.ts` e no projeto Playwright
      `reduced-motion`. O que se afirma aqui é o que esta tela deve à
      preferência: **nada a menos** (FR-015, SC-004).
    */
    preferirMovimentoReduzido(true);

    const { container } = render(<Stickers />);
    expect(adesivos(container)).toHaveLength(11);
  });
});

describe('§5.2 · a camada não empurra nada e não fala com ninguém', () => {
  it('continua absoluta, fora do fluxo e fora da árvore de acessibilidade', () => {
    const { container } = render(<Stickers />);

    const classe = camada(container).getAttribute('class') ?? '';
    expect(classe).toContain('absolute');
    expect(classe).toContain('inset-0');
    expect(classe).toContain('pointer-events-none');
    expect(camada(container).getAttribute('aria-hidden')).toBe('true');
  });

  it('nenhum adesivo ganhou envoltório próprio', () => {
    /*
      Um envoltório com `transform` viraria bloco de contenção para os
      `position: absolute` dos adesivos, e a composição inteira desabaria no
      canto de uma caixa de altura zero (contracts/motion-catalog.md §2.2).
    */
    const { container } = render(<Stickers />);

    for (const filho of camada(container).children) {
      expect(filho.tagName).toBe('IMG');
    }
  });

  it('a camada é a mesma nas duas aparições', () => {
    // A encenação não pode mudar a composição: só o momento em que ela aparece.
    const primeira = render(<Stickers />);
    const classePrimeira = camada(primeira.container).getAttribute('class');
    cleanup();

    const segunda = render(<Stickers />);
    expect(camada(segunda.container).getAttribute('class')).toBe(classePrimeira);
  });
});
