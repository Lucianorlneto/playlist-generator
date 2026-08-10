/**
 * A linha de contexto do cabeçalho — 008/FR-009 a FR-012, SC-004.
 *
 * A tabela de `contracts/header-context.md` §1 tem dez linhas, e este arquivo as
 * percorre **uma a uma**. O que torna isso necessário, e não zelo, é o modo de
 * falha da 007: a implementação exibia "Olá, {nome completo}" nas cinco etapas, e
 * ninguém notou porque **não havia nada que pudesse falhar**.
 *
 * Duas propriedades deste arquivo merecem atenção em revisão:
 *
 * 1. **as ausências são verificadas como ausência**, com `kind === 'absent'`. Um
 *    teste que só conferisse presença passaria com o defeito da 007 intacto;
 * 2. **a cobertura das fases é por exaustão do tipo**, não por lista escrita à
 *    mão. Uma fase nova em `RunPhase` derruba este arquivo em vez de produzir
 *    uma linha vazia na tela de alguém.
 */

import { describe, expect, it } from 'vitest';

import { headerContext, type HeaderSnapshot } from '@/domain/header';
import type { RunPhase, WizardStep } from '@/domain/types';
import { t } from '@/i18n/pt-BR';

const BASE: HeaderSnapshot = {
  step: 'destinations',
  phase: null,
  provider: null,
  position: 1,
  total: 2,
  displayName: 'Luciano Rodrigues',
};

function snapshot(overrides: Partial<HeaderSnapshot> = {}): HeaderSnapshot {
  return { ...BASE, ...overrides };
}

/** O instantâneo da etapa de serviço, na fase e posição pedidas. */
function noCiclo(phase: RunPhase, overrides: Partial<HeaderSnapshot> = {}): HeaderSnapshot {
  return snapshot({ step: 'service', phase, provider: 'spotify', ...overrides });
}

describe('FR-009 · H1 — as duas ausências são normativas', () => {
  it.each(['credential', 'summary'] as const)(
    'a etapa %s não tem linha de contexto (nós Sim0L e w1fTC)',
    (step) => {
      // Verificado **como ausência**, e não como "não é saudação": as duas telas
      // em que a linha não deve existir são tão erradas quanto as três em que
      // ela existia com o texto trocado (SC-004).
      expect(headerContext(snapshot({ step }))).toEqual({ kind: 'absent' });
    },
  );
});

describe('FR-009 · H2 — saudação pessoal em Destinos e Entrada', () => {
  it('Destinos traz o primeiro nome e o complemento da etapa (nó uy2ns)', () => {
    expect(headerContext(snapshot({ step: 'destinations' }))).toEqual({
      kind: 'greeting',
      firstName: 'Luciano',
      complement: t.header.destinationsComplement,
    });
  });

  it('Entrada traz o mesmo nome com o complemento próprio (nó okw1h)', () => {
    expect(headerContext(snapshot({ step: 'input' }))).toEqual({
      kind: 'greeting',
      firstName: 'Luciano',
      complement: t.header.inputComplement,
    });
  });

  it('os dois complementos são diferentes entre si', () => {
    // Sem esta asserção, um copiar-colar entre as duas etapas passaria pelos
    // dois casos acima se as chaves apontassem para o mesmo texto.
    expect(t.header.destinationsComplement).not.toBe(t.header.inputComplement);
  });
});

describe('FR-010 · H4 — o recorte do primeiro nome', () => {
  it.each([
    ['Luciano Rodrigues', 'Luciano'],
    ['Luciano Rodrigues Lucio Neto', 'Luciano'],
    // Nome de um termo só **é** o próprio primeiro nome.
    ['Luciano', 'Luciano'],
    // Espaços em excesso não produzem termo vazio.
    ['   Luciano   Rodrigues  ', 'Luciano'],
  ])('%s → %s', (displayName, esperado) => {
    const context = headerContext(snapshot({ displayName }));
    expect(context.kind === 'greeting' && context.firstName).toBe(esperado);
  });
});

describe('FR-011 · H5 — degradação sem nome, nunca com buraco', () => {
  it.each([
    ['sem sessão nenhuma', null],
    ['nome vazio', ''],
    ['nome só de espaços', '   '],
  ])('%s: firstName é null e o complemento permanece', (_caso, displayName) => {
    const context = headerContext(snapshot({ displayName }));

    expect(context).toEqual({
      kind: 'greeting',
      firstName: null,
      complement: t.header.destinationsComplement,
    });
  });

  it('a linha nunca some por falta de nome — o complemento é frase completa', () => {
    // A alternativa descartada é o espaço vazio, que faria o cabeçalho pular
    // quando a primeira conexão acontecesse. A outra é o nome inventado.
    const context = headerContext(snapshot({ displayName: null }));
    expect(context.kind).toBe('greeting');
    expect(context.kind === 'greeting' && context.complement).not.toBe('');
  });
});

describe('FR-009 · H3 e H7 — contexto de serviço, nunca saudação', () => {
  it.each(['pending', 'connect', 'awaiting_reauth', 'search', 'review'] as const)(
    'a fase %s traz a posição na fila (nós dIPW6 e DP6mq)',
    (phase) => {
      expect(headerContext(noCiclo(phase))).toEqual({
        kind: 'service',
        text: 'Spotify — 1 de 2',
      });
    },
  );

  it('a fase estimate traz o sufixo de orçamento (nó TSwx6)', () => {
    expect(headerContext(noCiclo('estimate', { provider: 'youtube', position: 2 }))).toEqual({
      kind: 'service',
      text: `YouTube · ${t.queue.phase.estimate}`,
    });
  });

  it.each(['creating', 'done'] as const)(
    'a fase %s traz o sufixo de conclusão (nós SjphR, C13Hj e zCaeY)',
    (phase) => {
      // `creating` recebe a linha de conclusão porque é a tela `SjphR` do
      // arquivo, e ali o slot já mostra "Spotify · Concluído": a linha nomeia o
      // **cartão em que se está**, não o instante exato da operação.
      expect(headerContext(noCiclo(phase))).toEqual({
        kind: 'service',
        text: `Spotify · ${t.queue.phase.done}`,
      });
    },
  );

  it.each([
    ['skipped', t.queue.phase.skipped],
    ['failed', t.queue.phase.failed],
  ] as const)('a fase %s nomeia o desfecho real, e não "Concluído"', (phase, esperado) => {
    // Divergência deliberada em relação a `contracts/header-context.md` §2, que
    // agrupa as três em "execução com desfecho → · Concluído". Dizer "Concluído"
    // de um serviço pulado é afirmar o que não aconteceu — o que FR-029 proíbe
    // literalmente na trilha, e pelo mesmo motivo aqui.
    const context = headerContext(noCiclo(phase));
    expect(context).toEqual({ kind: 'service', text: `Spotify · ${esperado}` });
    expect(context.kind === 'service' && context.text).not.toContain(t.queue.phase.done);
  });

  it('nenhuma fase do ciclo produz saudação (H7)', () => {
    const fases: readonly RunPhase[] = [
      'pending',
      'connect',
      'estimate',
      'search',
      'review',
      'creating',
      'awaiting_reauth',
      'done',
      'skipped',
      'failed',
    ];

    for (const phase of fases) {
      expect(headerContext(noCiclo(phase)).kind, `a fase ${phase} produziu saudação`).toBe(
        'service',
      );
    }
  });
});

describe('FR-012 · H6 — a posição some com destino único', () => {
  it('com total 1 a linha é só o nome do serviço', () => {
    expect(headerContext(noCiclo('search', { position: 1, total: 1 }))).toEqual({
      kind: 'service',
      text: 'Spotify',
    });
  });

  it('com total 2 a posição aparece', () => {
    const context = headerContext(noCiclo('search', { position: 2, provider: 'youtube' }));
    expect(context.kind === 'service' && context.text).toBe('YouTube — 2 de 2');
  });

  it('o sufixo de fase não é afetado pelo destino único', () => {
    // A omissão de FR-012 vale para a **posição**, não para o sufixo: "Spotify ·
    // Concluído" continua correto com um destino só.
    expect(headerContext(noCiclo('done', { total: 1 }))).toEqual({
      kind: 'service',
      text: `Spotify · ${t.queue.phase.done}`,
    });
  });
});

/**
 * A cobertura **total** de `RunPhase` (FR-009).
 *
 * O tipo é a fonte da lista, não um array escrito à mão: `PHASES` é declarado
 * como `readonly RunPhase[]` e a asserção de completude compara a sua contagem
 * com a quantidade de fases que a máquina de execução declara. Acrescentar uma
 * fase sem decidir a sua linha derruba **este** teste, com o nome da fase, em
 * vez de deixar um cabeçalho vazio numa tela que ninguém abriu ainda.
 */
describe('FR-009 · nenhuma fase de RunPhase fica sem linha', () => {
  const PHASES: readonly RunPhase[] = [
    'pending',
    'connect',
    'estimate',
    'search',
    'review',
    'creating',
    'awaiting_reauth',
    'done',
    'skipped',
    'failed',
  ];

  it.each(PHASES)('a fase %s produz texto não vazio', (phase) => {
    const context = headerContext(noCiclo(phase));
    expect(context.kind).toBe('service');
    expect(context.kind === 'service' && context.text.trim()).not.toBe('');
  });

  it('a lista deste teste cobre o tipo inteiro', () => {
    // A verificação estrutural: um `Record` exaustivo sobre `RunPhase` só
    // compila se todas as chaves estiverem presentes, e a contagem confirma que
    // nenhuma foi esquecida na lista acima.
    const exaustivo: Record<RunPhase, true> = {
      pending: true,
      connect: true,
      estimate: true,
      search: true,
      review: true,
      creating: true,
      awaiting_reauth: true,
      done: true,
      skipped: true,
      failed: true,
    };
    expect(new Set(PHASES).size).toBe(Object.keys(exaustivo).length);
  });
});

describe('bordas', () => {
  it('a etapa de serviço sem provedor corrente não desenha linha', () => {
    // Acontece entre a saída de uma execução e a entrada da seguinte. A linha
    // some em vez de exibir um travessão solto — mesma disciplina de FR-011.
    expect(headerContext(snapshot({ step: 'service', provider: null }))).toEqual({
      kind: 'absent',
    });
  });

  it('a saudação não depende da fila', () => {
    // Um instantâneo de Destinos com fila preenchida não vira contexto de
    // serviço: é a **etapa** que decide a forma, e só ela.
    const context = headerContext(
      snapshot({ step: 'destinations', provider: 'spotify', phase: 'search' }),
    );
    expect(context.kind).toBe('greeting');
  });

  it('as cinco etapas do fluxo estão cobertas', () => {
    const exaustivo: Record<WizardStep, true> = {
      credential: true,
      destinations: true,
      input: true,
      service: true,
      summary: true,
    };
    const formas = Object.keys(exaustivo).map(
      (step) => headerContext(noCiclo('search', { step: step as WizardStep })).kind,
    );
    expect(formas).toEqual(['absent', 'greeting', 'greeting', 'service', 'absent']);
  });
});
