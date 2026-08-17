import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ReviewScreen } from '@/features/review/ReviewScreen';
import { t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';

import { makeItem, makeLine, makeQueue, makeRun } from '../fixtures/factories';
import { instalarPreferenciaDeMovimento, preferirMovimentoReduzido } from '../support/movimento';

/**
 * A revisão se formando — FR-026, FR-026a, FR-027, SC-015
 * (`010/contracts/surfaces.md` §3).
 *
 * ## A apuração que mudou o desenho
 *
 * As linhas **não chegam em fluxo** (research §R2). Durante a busca só a
 * contagem avança; `search_done` despacha a lista inteira depois que a promessa
 * resolve. A entrada escalonada acontece, portanto, num momento em que **não há
 * requisição em voo** — ela fica do lado permitido da fronteira do FR-010 sem
 * precisar de exceção.
 *
 * Isso torna o caso do teto de defasagem real e agudo: cento e vinte linhas
 * montam no mesmo quadro, não pingando. O teto em si é medido sem DOM, em
 * `tests/unit/stagger.spec.ts`.
 *
 * ## Numa execução retomada, o que já estava em cena não anima
 *
 * A entrada é por **montagem de nó**, e a identidade é `item.line.id`, que já é
 * a chave da lista. Nenhum tratamento especial: o que remonta anima, o que
 * permanece não.
 */

instalarPreferenciaDeMovimento();

const LINHAS = [makeLine(), makeLine(), makeLine()];

/** Espia a única leitura de layout que `Settle` faz. */
function espiarMedicao() {
  return vi.spyOn(Element.prototype, 'getBoundingClientRect');
}

function semear(opcoes: { readonly buscando: boolean; readonly comItens: boolean }): void {
  const items = opcoes.comItens ? LINHAS.map((linha) => makeItem({ line: linha })) : [];
  useAppStore.setState({
    step: 'service',
    lines: LINHAS,
    destinations: { selected: ['spotify'], locked: true },
    queue: makeQueue(['spotify'], {
      runs: {
        spotify: makeRun('spotify', {
          phase: opcoes.buscando ? 'search' : 'review',
          lineIds: LINHAS.map((linha) => linha.id),
          items,
        }),
      },
    }),
    search: {
      running: opcoes.buscando,
      done: opcoes.buscando ? 1 : LINHAS.length,
      total: LINHAS.length,
      canceled: false,
    },
  });
}

function lista(): HTMLElement {
  return screen.getByRole('list', { name: t.review.listLabel });
}

beforeEach(() => {
  preferirMovimentoReduzido(false);
  semear({ buscando: false, comItens: true });
});

describe('FR-026a e SC-015 · durante a busca, nada anima', () => {
  it('o portão de `Settle` está fechado e nenhum irmão é medido', () => {
    semear({ buscando: true, comItens: false });

    const medir = espiarMedicao();
    render(<ReviewScreen provider="spotify" />);

    expect(
      medir,
      'Com `search.running` verdadeiro há requisição em voo, e o portão fecha a medição ' +
        'junto com a animação — é a medição que o FR-011 protege (FR-027).',
    ).not.toHaveBeenCalled();
  });

  it('fora da busca o portão abre — o contrapeso', () => {
    /*
      **Sem este caso o anterior mede a si mesmo.** Uma asserção de "não mediu"
      passaria com `Settle` ausente da tela, ou com o portão preso em `false`.
    */
    semear({ buscando: false, comItens: true });

    const medir = espiarMedicao();
    render(<ReviewScreen provider="spotify" />);

    expect(medir).toHaveBeenCalled();
  });

  it('a tela continua com a barra e a contagem durante a busca', () => {
    // O que **não** anima também não some: a busca continua tendo o
    // `<progress>` nativo e o número, que é toda a informação da fase.
    semear({ buscando: true, comItens: false });
    render(<ReviewScreen provider="spotify" />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});

describe('FR-026 · quando a busca termina, as linhas entram escalonadas', () => {
  it('a lista é o próprio contêiner do escalonamento, sem envoltório por linha', () => {
    /*
      As linhas continuam sendo filhas diretas da `<ul>`. Um envoltório por linha
      produziria `ul > div > li`, que é violação **séria** na regra `list` do
      axe — e o FR-020 não admite nenhuma (contracts/motion-catalog.md §2.2).
    */
    render(<ReviewScreen provider="spotify" />);

    const filhas = [...lista().children];
    expect(filhas).toHaveLength(LINHAS.length);
    for (const filha of filhas) expect(filha.tagName).toBe('LI');
  });

  it('a chave de identidade continua sendo a da linha, e a ordem é a de entrada', () => {
    render(<ReviewScreen provider="spotify" />);

    const textos = [...lista().children].map((li) => li.textContent ?? '');
    for (const [i, linha] of LINHAS.entries()) {
      expect(textos[i]).toContain(linha.raw);
    }
  });
});

describe('FR-026a · numa execução retomada, o que já estava em cena permanece imóvel', () => {
  it('as linhas presentes antes da busca não são reanimadas quando ela termina', () => {
    /*
      A entrada é por montagem de nó. Semear a busca **com** os itens já obtidos
      — que é o que `mergeItems` produz numa retomada — e depois encerrá-la não
      remonta nó nenhum, e portanto não anima nenhum.
    */
    semear({ buscando: true, comItens: true });
    render(<ReviewScreen provider="spotify" />);

    const antes = [...lista().children];
    expect(antes).toHaveLength(LINHAS.length);

    act(() => {
      semear({ buscando: false, comItens: true });
    });

    const depois = [...lista().children];
    // Os **mesmos nós**: identidade preservada é o que faz `Stagger` não os
    // considerar recém-chegados.
    for (const [i, no] of depois.entries()) expect(no).toBe(antes[i]);
  });
});

describe('FR-014 · sob movimento reduzido a revisão inteira permanece', () => {
  it('nem escalonamento nem acomodação, e nenhuma linha a menos', () => {
    preferirMovimentoReduzido(true);

    const medir = espiarMedicao();
    render(<ReviewScreen provider="spotify" />);

    expect(medir).not.toHaveBeenCalled();
    expect(lista().children).toHaveLength(LINHAS.length);
    // Tudo que é informação permanece — SC-004 mede isso literalmente.
    expect(screen.getByRole('list', { name: t.review.listLabel })).toBeVisible();
  });
});
