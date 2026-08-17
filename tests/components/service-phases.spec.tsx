import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import type { RunPhase } from '@/domain/types';
import { useAppStore } from '@/store';
import { Wizard } from '@/app/Wizard';

import {
  makeCreation,
  makeCredentials,
  makeItem,
  makeLine,
  makeQueue,
  makeResult,
  makeRun,
  makeSession,
  makeSessions,
} from '../fixtures/factories';
import { instalarPreferenciaDeMovimento, preferirMovimentoReduzido } from '../support/movimento';

/**
 * Nenhuma fase do ciclo de serviço anima — FR-021a, SC-016
 * (`010/contracts/surfaces.md` §1.4).
 *
 * ## A razão é semântica, não de custo
 *
 * `StepTransition` envolve a troca de **etapa do assistente** e nada mais.
 * Várias fases do ciclo trocam **sozinhas**, quando a busca ou a criação
 * termina. Uma transição com direção comunica avanço comandado, e aplicá-la a
 * uma troca autônoma mentiria sobre quem agiu.
 *
 * A proibição de `009/contracts/motion.md` §3 permanece literal para elas, e o
 * cartão de criação continua com o movimento próprio da 009 — que não deve
 * receber outro por cima.
 *
 * ## O que este arquivo observa
 *
 * A marca de uma transição de tela é o bloco que **sai**: fora do fluxo, inerte
 * e escondido do leitor. Se nenhuma fase produz um, nenhuma fase transita.
 */

instalarPreferenciaDeMovimento();

const CLIENT_ID = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';

/** As seis fases que o ciclo atravessa, na ordem em que o redutor as visita. */
const FASES: readonly RunPhase[] = [
  'connect',
  'estimate',
  'search',
  'review',
  'creating',
  'done',
];

const LINHAS = [makeLine(), makeLine()];

/**
 * Uma execução coerente para cada fase.
 *
 * Montar `phase` sozinho produziria estado que o fluxo não alcança — uma fase
 * `creating` sem `creation`, por exemplo —, e um teste sobre estado impossível
 * verifica um sistema que não existe.
 */
function execucaoNa(fase: RunPhase) {
  const base = {
    phase: fase,
    lineIds: LINHAS.map((linha) => linha.id),
    items: LINHAS.map((linha) => makeItem({ line: linha })),
  };
  if (fase === 'creating') return makeRun('spotify', { ...base, creation: makeCreation() });
  if (fase === 'done') return makeRun('spotify', { ...base, result: makeResult(), outcome: 'completed' });
  return makeRun('spotify', base);
}

function semearFase(fase: RunPhase): void {
  useAppStore.setState({
    step: 'service',
    lines: LINHAS,
    destinations: { selected: ['spotify'], locked: true },
    queue: makeQueue(['spotify'], { runs: { spotify: execucaoNa(fase) } }),
    credentials: makeCredentials({ spotify: CLIENT_ID }),
    sessions: makeSessions({ spotify: makeSession('spotify') }),
    draftNotice: 'none',
  });
}

beforeEach(() => {
  preferirMovimentoReduzido(false);
  semearFase('connect');
});

describe('FR-021a e SC-016 · percorrer o ciclo não produz transição de tela', () => {
  it('nenhuma troca de fase deixa um bloco saindo', () => {
    const { container } = render(<Wizard />);

    for (const fase of FASES) {
      act(() => {
        semearFase(fase);
      });

      expect(
        container.querySelector('[inert]'),
        `A fase ${fase} produziu um bloco de saída. \`StepTransition\` envolve a troca de ` +
          'etapa do assistente e nada mais: várias fases do ciclo trocam sozinhas, e uma ' +
          'transição com direção mentiria sobre quem agiu (FR-021a).',
      ).toBeNull();
    }
  });

  it('a etapa Serviço em si transita — o contrapeso', () => {
    /*
      **Sem este caso o anterior mede a si mesmo.** Uma asserção de "nenhum bloco
      de saída" passaria com a transição desligada em toda parte, ou com o
      seletor errado. Chegar à etapa Serviço **vindo de outra etapa** tem de
      produzir exatamente o bloco que as trocas de fase não produzem.
    */
    useAppStore.setState({ step: 'input' });
    const { container } = render(<Wizard />);

    act(() => {
      useAppStore.getState().goToStep('service');
    });

    expect(container.querySelector('[inert]')).not.toBeNull();
  });
});
