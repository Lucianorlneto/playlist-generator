import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { Wizard } from '@/app/Wizard';
import type { WizardStep } from '@/domain/types';
import { t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';

import { makeCredentials, makeQueue, makeSession, makeSessions } from '../fixtures/factories';
import { instalarPreferenciaDeMovimento, preferirMovimentoReduzido } from '../support/movimento';

/**
 * A troca de etapa — FR-016, FR-017, FR-021b, FR-022, FR-024, SC-008, SC-010
 * (`010/contracts/surfaces.md` §1 e §7).
 *
 * ## Onde o risco desta feature mora
 *
 * Por 200ms existem **duas** telas de etapa em cena: dois cabeçalhos, dois
 * conjuntos de controles. Se a árvore que sai continuar alcançável, a transição
 * introduz exatamente a falha que o FR-017 proíbe — alterar a ordem de leitura e
 * a contagem de controles, ainda que por um quinto de segundo.
 *
 * E o foco não pode esperar: é por isso que `mode="wait"` foi descartado
 * (research §R6). Com ele, o cabeçalho novo só montaria depois de a tela antiga
 * sair, e o foco chegaria 200ms atrasado — violação direta do SC-008.
 */

instalarPreferenciaDeMovimento();

const CLIENT_ID = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
const YT_CLIENT_ID = '1234567890-abcdefghijklmnop.apps.googleusercontent.com';

function semear(step: WizardStep): void {
  useAppStore.setState({
    step,
    destinations: { selected: ['spotify', 'youtube'], locked: false },
    queue: makeQueue(['spotify', 'youtube']),
    credentials: makeCredentials({ spotify: CLIENT_ID, youtube: YT_CLIENT_ID }),
    sessions: makeSessions({ spotify: makeSession('spotify') }),
    draftNotice: 'none',
  });
}

/** Percorre o fluxo como a aplicação percorre: pela ação do store. */
function irPara(step: WizardStep): void {
  act(() => {
    useAppStore.getState().goToStep(step);
  });
}

/** A árvore que saiu: fora do fluxo, inerte e escondida do leitor de tela. */
function arvoreQueSai(container: HTMLElement): Element | null {
  return container.querySelector('[inert]');
}

beforeEach(() => {
  preferirMovimentoReduzido(false);
  semear('credential');
});

describe('FR-016 e SC-008 · o foco chega ao título sem esperar a animação', () => {
  it('o cabeçalho da etapa nova já está focado no mesmo quadro', () => {
    render(<Wizard />);
    irPara('destinations');

    const titulo = screen.getByRole('heading', { name: t.destinations.heading, level: 2 });
    expect(
      document.activeElement,
      'O foco chega no mesmo quadro. Com `AnimatePresence mode="wait"` ele chegaria 200ms ' +
        'depois, porque o cabeçalho novo só montaria com a tela antiga já fora (SC-008).',
    ).toBe(titulo);
  });

  it('o cabeçalho focado é o da etapa que entra, e não o da que sai', () => {
    render(<Wizard />);
    irPara('destinations');

    expect(document.activeElement?.textContent).toBe(t.destinations.heading);
  });
});

describe('FR-017 e SC-010 · a árvore que sai some para o teclado e para o leitor', () => {
  it('o bloco que sai recebe `inert` e `aria-hidden`', () => {
    const { container } = render(<Wizard />);
    irPara('destinations');

    const saindo = arvoreQueSai(container);
    expect(
      saindo,
      'Sem `inert`, os controles da etapa anterior continuam alcançáveis por Tab durante a ' +
        'transição, e a contagem de controles muda por 200ms (FR-017).',
    ).not.toBeNull();
    expect(saindo?.getAttribute('aria-hidden')).toBe('true');
  });

  it('a etapa que sai é a anterior, e a que fica no fluxo é a nova', () => {
    const { container } = render(<Wizard />);
    irPara('destinations');

    const saindo = arvoreQueSai(container);
    expect(saindo?.textContent).toContain(t.credential.heading);

    // A que entra não é inerte: é ela que define a altura e recebe o foco.
    const entrando = [...container.querySelectorAll('[data-etapa]')].find(
      (no) => !no.hasAttribute('inert'),
    );
    expect(entrando?.textContent).toContain(t.destinations.heading);
  });

  it('existe um único `aria-current="step"` durante a transição', () => {
    /*
      A trilha é a única que declara a posição no fluxo (007/FR-041), e ela vive
      **fora** do bloco que transita. Este caso é o portão de que a transição não
      duplicou a casca junto com o conteúdo.
    */
    render(<Wizard />);
    irPara('destinations');

    expect(document.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
  });
});

describe('FR-024 · a primeira montagem não é uma troca', () => {
  it('montar direto numa etapa não deixa nada saindo', () => {
    /*
      Recarregar a página, voltar do retorno de autorização ou restaurar um
      rascunho não é uma troca. `initial={false}` no `AnimatePresence` mais o `0`
      de `stepDirection` com `from` nulo são as duas metades disso
      (contracts/surfaces.md §1.6).
    */
    semear('input');
    const { container } = render(<Wizard />);

    expect(arvoreQueSai(container)).toBeNull();
  });

  it('e a etapa montada já está no fluxo, sem deslocamento pendente', () => {
    semear('input');
    const { container } = render(<Wizard />);

    const etapa = container.querySelector('[data-etapa]');
    expect(etapa).not.toBeNull();
    expect(etapa?.hasAttribute('inert')).toBe(false);
  });
});

describe('FR-014 e SC-005 · sob movimento reduzido a etapa entra em um quadro', () => {
  it('nada fica em cena saindo', () => {
    preferirMovimentoReduzido(true);
    const { container } = render(<Wizard />);
    irPara('destinations');

    expect(
      arvoreQueSai(container),
      'Sem `AnimatePresence` não há bloco fora do fluxo esperando 200ms para sair: a etapa ' +
        'nova é o único conteúdo, no primeiro quadro (contracts/motion-catalog.md §5).',
    ).toBeNull();
  });

  it('e a etapa nova está inteira, com o foco no cabeçalho', () => {
    preferirMovimentoReduzido(true);
    render(<Wizard />);
    irPara('destinations');

    const titulo = screen.getByRole('heading', { name: t.destinations.heading, level: 2 });
    expect(document.activeElement).toBe(titulo);
    // O que permanece é tudo que é informação (FR-015, SC-004).
    expect(screen.getByRole('heading', { name: t.destinations.heading })).toBeVisible();
  });
});

describe('FR-021b · o aviso de rascunho não transita com a etapa', () => {
  it('ele fica fora do bloco que sai', () => {
    useAppStore.setState({ draftNotice: 'recovered', draftSavedAt: Date.now() });
    const { container } = render(<Wizard />);
    irPara('destinations');

    const saindo = arvoreQueSai(container);
    expect(
      saindo?.textContent ?? '',
      'O aviso não pertence a nenhuma etapa — sobrevive a todas. Transitá-lo junto o faria ' +
        'sair e voltar a cada avanço, sugerindo que sumiu (contracts/surfaces.md §1.5).',
    ).not.toContain(t.draft.recoveredHeading);
  });

  it('e continua em cena e operável depois da troca', () => {
    useAppStore.setState({ draftNotice: 'recovered', draftSavedAt: Date.now() });
    render(<Wizard />);
    irPara('destinations');

    expect(screen.getByText(t.draft.recoveredHeading)).toBeVisible();
    expect(screen.getByRole('button', { name: t.draft.continue })).toBeEnabled();
  });
});
