import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Settle } from '@/ui/motion';

import {
  instalarPreferenciaDeMovimento,
  preferirMovimentoReduzido,
} from '../support/movimento';

/**
 * O portão de ociosidade de `Settle` — FR-010a, FR-011, FR-014, SC-015
 * (`010/contracts/motion-catalog.md` §4).
 *
 * ## O que estes casos observam, e por que é a medição
 *
 * `Settle` acomoda posição por FLIP: mede onde cada irmão estava, mede onde ele
 * foi parar, e desfaz a diferença por transformação. **A animação é barata; a
 * medição não é** — `getBoundingClientRect` força o navegador a resolver o
 * layout pendente, e é isso que o FR-011 protege quando há requisição em voo.
 *
 * Por isso a asserção central é sobre `getBoundingClientRect` e não sobre o
 * estilo em linha resultante: em `happy-dom` todo retângulo é zero, e uma
 * asserção de "nenhuma transformação" passaria com o portão escancarado. A
 * contagem de medições, não.
 */

instalarPreferenciaDeMovimento();

/** Espia a única leitura de layout que a primitiva faz. */
function espiarMedicao() {
  return vi.spyOn(Element.prototype, 'getBoundingClientRect');
}

function Lista({ idle }: { readonly idle: boolean }) {
  return (
    <Settle idle={idle}>
      <ul data-testid="lista">
        <li>um</li>
        <li>dois</li>
      </ul>
    </Settle>
  );
}

beforeEach(() => {
  preferirMovimentoReduzido(false);
});

describe('FR-010a · o portão não tem valor padrão e fecha por inteiro', () => {
  it('com `idle={false}` nenhum irmão é medido', () => {
    const medir = espiarMedicao();
    render(<Lista idle={false} />);

    expect(
      medir,
      'Com o portão fechado a primitiva não anima **e não mede**. Fechar só a animação ' +
        'deixaria de pé o custo que o FR-011 protege: a leitura de layout forçada.',
    ).not.toHaveBeenCalled();
  });

  it('com `idle={true}` os irmãos são medidos — o contrapeso', () => {
    /*
      **Sem este caso o anterior mede a si mesmo.** Uma asserção de "não mediu"
      passaria com a primitiva apagada, com o `useLayoutEffect` nunca disparado
      ou com a referência nunca pendurada no nó do chamador.
    */
    const medir = espiarMedicao();
    render(<Lista idle={true} />);

    expect(medir).toHaveBeenCalled();
  });

  it('com `idle={false}` nenhuma transformação sobra nos irmãos', () => {
    render(<Lista idle={false} />);

    const irmaos = [...screen.getByTestId('lista').children];
    for (const irmao of irmaos) {
      const estilo = irmao.getAttribute('style') ?? '';
      expect(estilo).not.toContain('transform');
      expect(estilo).not.toContain('translate');
    }
  });
});

describe('FR-014, SC-015 · sob movimento reduzido a nova posição chega em um quadro', () => {
  it('a preferência fecha o portão tão firmemente quanto `idle={false}`', () => {
    preferirMovimentoReduzido(true);

    const medir = espiarMedicao();
    render(<Lista idle={true} />);

    /*
      Não há estado intermediário porque não há animação, e não há animação
      porque não houve medição. O DOM já está no estado final — que é a
      propriedade que faz o conteúdo permanecer legível mesmo se a biblioteca
      falhar (contracts/motion-catalog.md §5).
    */
    expect(medir).not.toHaveBeenCalled();

    const irmaos = [...screen.getByTestId('lista').children];
    for (const irmao of irmaos) {
      expect(irmao.getAttribute('style') ?? '').toBe('');
    }
  });
});

describe('§4 · a primitiva não cria elemento nenhum', () => {
  it('o filho único chega ao DOM sem envoltório', () => {
    /*
      É o que permite `Settle` conviver com `Stagger` na mesma lista. Um
      envoltório dentro de uma `<ul>` produziria `ul > div > li`, que é violação
      **séria** na regra `list` do axe — e o FR-020 não admite nenhuma.
    */
    const { container } = render(<Lista idle={true} />);

    expect(container.children).toHaveLength(1);
    expect(container.firstElementChild?.tagName).toBe('UL');
    expect(screen.getByTestId('lista').children).toHaveLength(2);
  });
});
