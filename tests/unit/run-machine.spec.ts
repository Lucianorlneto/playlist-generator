import { describe, expect, it } from 'vitest';

import type { ProviderId } from '@/domain/providers';
import { emptyRun, isActive, outcomeOf, reduceRun, type RunEvent } from '@/domain/run/machine';
import {
  activeCount,
  advanceQueue,
  buildQueue,
  currentProvider,
  isQueueDone,
  replaceRun,
  showsQueueIndicator,
} from '@/domain/run/queue';
import type { AppErrorInfo, ServiceRun } from '@/domain/types';

import { makeCreation, makeItem, makeLine, makeResult } from '../fixtures/factories';

const ERRO: AppErrorInfo = {
  provider: 'spotify',
  kind: 'create_playlist_failed',
  title: 'Falhou',
  cause: 'Causa',
  nextStep: 'Próximo passo',
};

function run(overrides: Partial<ServiceRun> = {}, provider: ProviderId = 'spotify'): ServiceRun {
  return { ...emptyRun(provider, ['l0', 'l1']), ...overrides };
}

/** Aplica uma sequência de eventos, devolvendo o estado final. */
function drive(initial: ServiceRun, ...events: RunEvent[]): ServiceRun {
  return events.reduce(reduceRun, initial);
}

describe('FR-016 — o ciclo de um serviço', () => {
  it('percorre connect → search → review → creating → done no Spotify', () => {
    const inicial = run();
    const conectado = drive(inicial, { type: 'started' }, { type: 'authorized' });
    // Spotify não tem cota: a fase de estimativa é pulada sem rastro.
    expect(conectado.phase).toBe('search');

    const revisado = reduceRun(conectado, { type: 'search_done', items: [makeItem()] });
    expect(revisado.phase).toBe('review');

    const confirmado = reduceRun(revisado, { type: 'review_confirmed' });
    expect(confirmado.phase).toBe('creating');

    const criado = drive(
      confirmado,
      { type: 'creation_started', creation: makeCreation({ orderedUris: ['a'] }) },
      { type: 'created', result: makeResult({ addedCount: 1 }) },
    );
    expect(criado.phase).toBe('done');
    expect(criado.outcome).toBe('completed');
  });

  it('insere a fase de estimativa no YouTube (FR-029)', () => {
    const inicial = run({}, 'youtube');
    const conectado = drive(inicial, { type: 'started' }, { type: 'authorized' });
    expect(conectado.phase).toBe('estimate');
    expect(reduceRun(conectado, { type: 'estimate_ok' }).phase).toBe('search');
  });

  it('destino sem nenhuma linha é apresentado como pulado (invariante R5)', () => {
    const vazio = run({ lineIds: [] }, 'youtube');
    const conectado = drive(vazio, { type: 'started' }, { type: 'authorized' });
    const resolvido = reduceRun(conectado, { type: 'estimate_ok' });
    expect(resolvido.phase).toBe('skipped');
    expect(resolvido.outcome).toBe('skipped');
  });
});

describe('FR-019, Princípio V — nenhuma escrita sem confirmação daquele serviço', () => {
  /**
   * A garantia mais forte deste módulo: `creating` é inalcançável por qualquer
   * caminho que não passe por `review_confirmed`.
   */
  it('nenhuma sequência de eventos alcança `creating` sem `review_confirmed`', () => {
    const eventos: RunEvent[] = [
      { type: 'started' },
      { type: 'authorized' },
      { type: 'estimate_ready', estimate: null as never },
      { type: 'estimate_ok' },
      { type: 'estimate_blocked' },
      { type: 'lines_reduced', lineIds: ['l0'] },
      { type: 'search_done', items: [makeItem()] },
      { type: 'items_changed', items: [makeItem()] },
      { type: 'creation_started', creation: makeCreation() },
      { type: 'creation_progress', creation: makeCreation() },
      { type: 'created', result: makeResult() },
    ];

    for (const provider of ['spotify', 'youtube'] as ProviderId[]) {
      // Força bruta sobre todas as sequências de até 4 eventos.
      const explorar = (atual: ServiceRun, profundidade: number): void => {
        expect(atual.phase, `alcançou creating sem review_confirmed em ${provider}`).not.toBe(
          'creating',
        );
        if (profundidade === 0) return;
        for (const evento of eventos) {
          explorar(reduceRun(atual, evento), profundidade - 1);
        }
      };
      explorar(run({}, provider), 4);
    }
  });

  it('review_confirmed fora da fase de revisão não faz nada', () => {
    expect(reduceRun(run({ phase: 'search' }), { type: 'review_confirmed' }).phase).toBe('search');
    expect(reduceRun(run({ phase: 'connect' }), { type: 'review_confirmed' }).phase).toBe('connect');
    expect(reduceRun(run({ phase: 'estimate' }), { type: 'review_confirmed' }).phase).toBe(
      'estimate',
    );
  });
});

describe('invariante R2 — execução encerrada é imutável', () => {
  it('reduceRun sobre execução com outcome é a identidade', () => {
    const encerrado = run({ phase: 'done', outcome: 'completed', result: makeResult() });
    const eventos: RunEvent[] = [
      { type: 'started' },
      { type: 'authorized' },
      { type: 'search_done', items: [makeItem()] },
      { type: 'items_changed', items: [] },
      { type: 'review_confirmed' },
      { type: 'created', result: makeResult({ addedCount: 99 }) },
      { type: 'skipped' },
      { type: 'failed', error: ERRO },
      { type: 'lines_reduced', lineIds: [] },
    ];
    for (const evento of eventos) {
      expect(reduceRun(encerrado, evento)).toBe(encerrado);
    }
  });
});

describe('FR-040 — desfechos, sem limiar percentual', () => {
  it('playlist criada com todos os itens confirmados → completed', () => {
    const r = run({
      phase: 'creating',
      creation: makeCreation({ orderedUris: ['a', 'b'] }),
    });
    const final = reduceRun(r, { type: 'created', result: makeResult({ addedCount: 2 }) });
    expect(final.outcome).toBe('completed');
  });

  it('playlist criada com item confirmado faltando → partial', () => {
    const r = run({
      phase: 'creating',
      creation: makeCreation({ orderedUris: ['a', 'b', 'c'] }),
    });
    const final = reduceRun(r, { type: 'created', result: makeResult({ addedCount: 2 }) });
    expect(final.outcome).toBe('partial');
  });

  it('nenhuma playlist criada → failed', () => {
    const final = reduceRun(run({ phase: 'creating' }), { type: 'failed', error: ERRO });
    expect(final.outcome).toBe('failed');
    expect(final.error).toEqual(ERRO);
  });

  it('falha depois de a playlist existir → partial, não failed', () => {
    const r = run({
      phase: 'creating',
      creation: makeCreation({ orderedUris: ['a', 'b'] }),
      result: makeResult({ addedCount: 1 }),
    });
    expect(reduceRun(r, { type: 'failed', error: ERRO }).outcome).toBe('partial');
  });

  it('usuário encerrou antes de confirmar → skipped', () => {
    expect(reduceRun(run({ phase: 'review' }), { type: 'skipped' }).outcome).toBe('skipped');
    expect(reduceRun(run({ phase: 'connect' }), { type: 'skipped' }).outcome).toBe('skipped');
  });

  it('esgotamento de cota com playlist existente → parcial e incompleta (FR-032)', () => {
    const r = run(
      { phase: 'creating', creation: makeCreation({ orderedUris: ['a', 'b', 'c'] }) },
      'youtube',
    );
    const final = reduceRun(r, {
      type: 'quota_exhausted',
      result: makeResult({ provider: 'youtube', addedCount: 1, incompleteByQuota: true }),
      error: { ...ERRO, provider: 'youtube', kind: 'quota_exhausted' },
    });
    expect(final.outcome).toBe('partial');
    expect(final.result?.incompleteByQuota).toBe(true);
    expect(final.error?.kind).toBe('quota_exhausted');
  });

  it('esgotamento antes de criar a playlist → failed', () => {
    const final = reduceRun(run({ phase: 'creating' }, 'youtube'), {
      type: 'quota_exhausted',
      result: null,
      error: { ...ERRO, provider: 'youtube', kind: 'quota_exhausted' },
    });
    expect(final.outcome).toBe('failed');
  });

  it('outcomeOf não usa porcentagem alguma', () => {
    const quase = run({
      phase: 'creating',
      creation: makeCreation({ orderedUris: Array.from({ length: 100 }, (_, i) => `t${i}`) }),
      result: makeResult({ addedCount: 99 }),
    });
    expect(outcomeOf(quase)).toBe('partial');
  });
});

/**
 * V10 — a fase `awaiting_reauth` (`004/data-model §3`).
 *
 * A promessa que estas transições sustentam: perder a autorização no meio do
 * trabalho **para** a execução, não a encerra. `outcome` continua `null`,
 * `isActive` continua verdadeira, e o que já foi feito permanece no lugar.
 */
describe('004/V10 — session_lost e a fase awaiting_reauth', () => {
  const ERRO_COTA: AppErrorInfo = { ...ERRO, provider: 'youtube', kind: 'quota_exhausted' };

  it('a busca perdida vai a awaiting_reauth guardando o resultado parcial', () => {
    const parciais = [makeItem(), makeItem()];
    const parado = reduceRun(run({ phase: 'search' }), {
      type: 'session_lost',
      from: 'search',
      items: parciais,
    });

    expect(parado.phase).toBe('awaiting_reauth');
    expect(parado.resumeFrom).toBe('search');
    expect(parado.items).toEqual(parciais);
    // FR-002: parada, não encerrada.
    expect(parado.outcome).toBeNull();
    expect(isActive(parado)).toBe(true);
  });

  it('a criação perdida vai a awaiting_reauth sem tocar o progresso já gravado', () => {
    const progresso = makeCreation({ orderedUris: ['a', 'b', 'c'], committedItems: 2 });
    const parado = reduceRun(run({ phase: 'creating', creation: progresso }), {
      type: 'session_lost',
      from: 'creating',
    });

    expect(parado.phase).toBe('awaiting_reauth');
    expect(parado.resumeFrom).toBe('creating');
    // FR-030: o índice de confirmação é o ponto de retomada — mexer nele
    // duplicaria ou pularia faixa.
    expect(parado.creation).toEqual(progresso);
    expect(parado.outcome).toBeNull();
  });

  it('session_lost sem itens preserva os que já estavam na execução', () => {
    const anteriores = [makeItem()];
    const parado = reduceRun(run({ phase: 'search', items: anteriores }), {
      type: 'session_lost',
      from: 'search',
    });
    expect(parado.items).toEqual(anteriores);
  });

  it('autorizar devolve a execução exatamente à fase de onde ela saiu', () => {
    for (const origem of ['search', 'creating'] as const) {
      const parado = reduceRun(run({ phase: origem }), { type: 'session_lost', from: origem });
      const retomado = reduceRun(parado, { type: 'authorized' });

      expect(retomado.phase).toBe(origem);
      // A2: sair da fase zera o campo.
      expect(retomado.resumeFrom).toBeNull();
    }
  });

  it('retomar da busca **não** passa pela estimativa, nem no YouTube (T5)', () => {
    // A estimativa reexibida contaria a lista **inteira** e contradiria FR-013
    // no primeiro clique: o custo já foi dito no diálogo, sobre o que falta.
    const parado = reduceRun(run({ phase: 'search' }, 'youtube'), {
      type: 'session_lost',
      from: 'search',
    });
    expect(reduceRun(parado, { type: 'authorized' }).phase).toBe('search');
  });

  it('pular a partir de awaiting_reauth encerra o destino como skipped', () => {
    const parado = reduceRun(run({ phase: 'search' }), { type: 'session_lost', from: 'search' });
    const pulado = reduceRun(parado, { type: 'skipped' });

    expect(pulado.outcome).toBe('skipped');
    expect(pulado.phase).toBe('skipped');
  });

  it('cota esgotada a partir de awaiting_reauth encerra como já fazia', () => {
    const parado = reduceRun(
      run({ phase: 'creating', creation: makeCreation({ orderedUris: ['a', 'b'] }) }, 'youtube'),
      { type: 'session_lost', from: 'creating' },
    );
    const encerrado = reduceRun(parado, {
      type: 'quota_exhausted',
      result: makeResult({ provider: 'youtube', addedCount: 1, incompleteByQuota: true }),
      error: ERRO_COTA,
    });

    expect(encerrado.outcome).toBe('partial');
    expect(encerrado.result?.incompleteByQuota).toBe(true);
  });

  it('session_lost em qualquer outra fase é a identidade', () => {
    const outras: ServiceRun['phase'][] = [
      'pending',
      'connect',
      'estimate',
      'review',
      'awaiting_reauth',
    ];
    for (const phase of outras) {
      const atual = run({ phase });
      expect(reduceRun(atual, { type: 'session_lost', from: 'search' })).toBe(atual);
      expect(reduceRun(atual, { type: 'session_lost', from: 'creating' })).toBe(atual);
    }
  });

  it('R2 — execução encerrada ignora session_lost', () => {
    const encerrado = run({ phase: 'done', outcome: 'completed', result: makeResult() });
    expect(reduceRun(encerrado, { type: 'session_lost', from: 'search' })).toBe(encerrado);
    expect(reduceRun(encerrado, { type: 'session_lost', from: 'creating' })).toBe(encerrado);
  });

  it('A1/A2 — resumeFrom não-nulo ⟺ fase awaiting_reauth, e outcome é nulo lá', () => {
    const eventos: RunEvent[] = [
      { type: 'started' },
      { type: 'authorized' },
      { type: 'estimate_ok' },
      { type: 'search_done', items: [makeItem()] },
      { type: 'items_changed', items: [makeItem()] },
      { type: 'review_confirmed' },
      { type: 'session_lost', from: 'search', items: [makeItem()] },
      { type: 'session_lost', from: 'creating' },
      { type: 'creation_started', creation: makeCreation() },
      { type: 'created', result: makeResult() },
      { type: 'skipped' },
      { type: 'failed', error: ERRO },
    ];

    for (const provider of ['spotify', 'youtube'] as ProviderId[]) {
      const explorar = (atual: ServiceRun, profundidade: number): void => {
        const esperado = atual.phase === 'awaiting_reauth';
        expect(atual.resumeFrom !== null, `A2 quebrada em ${provider}/${atual.phase}`).toBe(
          esperado,
        );
        if (esperado) {
          expect(atual.outcome, `A1 quebrada em ${provider}`).toBeNull();
        }
        if (profundidade === 0) return;
        for (const evento of eventos) explorar(reduceRun(atual, evento), profundidade - 1);
      };
      explorar(run({}, provider), 4);
    }
  });

  it('emptyRun nasce sem ponto de retomada', () => {
    expect(emptyRun('spotify', ['l0']).resumeFrom).toBeNull();
  });
});

describe('FR-016, FR-021 — a fila', () => {
  it('constrói uma execução por destino, na ordem fixa', () => {
    const fila = buildQueue(['youtube', 'spotify'], ['l0', 'l1']);
    expect(fila.order).toEqual(['spotify', 'youtube']);
    expect(fila.currentIndex).toBe(-1);
    expect(fila.runs.spotify?.lineIds).toEqual(['l0', 'l1']);
    expect(fila.runs.youtube?.phase).toBe('pending');
  });

  /** Q1: no máximo uma execução ativa. */
  it('nunca há duas execuções ativas ao mesmo tempo', () => {
    let fila = buildQueue(['spotify', 'youtube'], ['l0']);
    fila = { ...fila, currentIndex: 0 };
    fila = replaceRun(fila, reduceRun(fila.runs.spotify as ServiceRun, { type: 'started' }));
    expect(activeCount(fila)).toBe(1);

    // Tentar iniciar o segundo antes de o primeiro encerrar não muda nada:
    // `advanceQueue` recusa avançar.
    const naoAvancou = advanceQueue(fila, []);
    expect(naoAvancou.currentIndex).toBe(0);
    expect(activeCount(naoAvancou)).toBe(1);
  });

  /** Q2: o próximo só sai de `pending` depois de o anterior ter `outcome`. */
  it('a fila só avança quando a execução corrente encerrou', () => {
    let fila = buildQueue(['spotify', 'youtube'], ['l0']);
    fila = { ...fila, currentIndex: 0 };

    expect(advanceQueue(fila, []).currentIndex).toBe(0);

    fila = replaceRun(fila, {
      ...(fila.runs.spotify as ServiceRun),
      phase: 'done',
      outcome: 'completed',
    });
    expect(advanceQueue(fila, []).currentIndex).toBe(1);
  });

  it('inicia o serviço que entra, sem deixá-lo em pending', () => {
    let fila = buildQueue(['spotify', 'youtube'], ['l0']);
    fila = { ...fila, currentIndex: 0 };
    fila = replaceRun(fila, {
      ...(fila.runs.spotify as ServiceRun),
      phase: 'done',
      outcome: 'completed',
    });

    const avancada = advanceQueue(fila, []);

    // `pending` não corresponde a nenhuma fase da interface: um serviço que
    // entrasse assim renderizaria uma tela vazia entre um destino e o seguinte.
    expect(avancada.runs.youtube?.phase).not.toBe('pending');
    expect(avancada.runs.youtube?.phase).toBe('connect');
  });

  it('avançar além do último serviço não quebra nem reinicia nada', () => {
    let fila = buildQueue(['spotify'], ['l0']);
    fila = { ...fila, currentIndex: 0 };
    fila = replaceRun(fila, {
      ...(fila.runs.spotify as ServiceRun),
      phase: 'done',
      outcome: 'completed',
    });

    const avancada = advanceQueue(fila, []);

    expect(avancada.currentIndex).toBe(1);
    expect(avancada.runs.spotify?.outcome).toBe('completed');
    expect(avancada.runs.spotify?.phase).toBe('done');
  });

  it('congela as linhas usadas na conclusão (FR-037, SC-018)', () => {
    const lines = [makeLine({ index: 0 }), makeLine({ index: 1 })];
    let fila = buildQueue(['spotify', 'youtube'], ['l0', 'l1']);
    fila = { ...fila, currentIndex: 0 };
    fila = replaceRun(fila, {
      ...(fila.runs.spotify as ServiceRun),
      phase: 'done',
      outcome: 'completed',
      lineIds: ['l0'],
    });

    const avancada = advanceQueue(fila, lines);
    expect(avancada.runs.spotify?.frozenLines?.map((line) => line.id)).toEqual(['l0']);
    // Cópia, não referência: alterar a fonte única não reescreve o congelado.
    expect(avancada.runs.spotify?.frozenLines?.[0]).not.toBe(lines[0]);
  });

  it('isQueueDone só é verdadeiro com todas as execuções encerradas', () => {
    let fila = buildQueue(['spotify', 'youtube'], ['l0']);
    expect(isQueueDone(fila)).toBe(false);
    fila = replaceRun(fila, { ...(fila.runs.spotify as ServiceRun), outcome: 'completed' });
    expect(isQueueDone(fila)).toBe(false);
    fila = replaceRun(fila, { ...(fila.runs.youtube as ServiceRun), outcome: 'skipped' });
    expect(isQueueDone(fila)).toBe(true);
  });

  /** Q4: um destino só não exibe indicação de fila. */
  it('a indicação de fila só existe com mais de um destino', () => {
    expect(showsQueueIndicator(buildQueue(['spotify'], []))).toBe(false);
    expect(showsQueueIndicator(buildQueue(['spotify', 'youtube'], []))).toBe(true);
  });

  it('currentProvider é nulo antes de a fila começar (Q3)', () => {
    const fila = buildQueue(['spotify', 'youtube'], ['l0']);
    expect(currentProvider(fila)).toBeNull();
  });

  /** R4: nenhuma transição de uma execução altera outra (FR-021, SC-007). */
  it('uma execução que falha não altera a outra', () => {
    let fila = buildQueue(['spotify', 'youtube'], ['l0']);
    fila = { ...fila, currentIndex: 0 };
    const youtubeAntes = fila.runs.youtube as ServiceRun;

    fila = replaceRun(
      fila,
      reduceRun({ ...(fila.runs.spotify as ServiceRun), phase: 'creating' }, {
        type: 'failed',
        error: ERRO,
      }),
    );

    expect(fila.runs.spotify?.outcome).toBe('failed');
    expect(fila.runs.youtube).toBe(youtubeAntes);
    expect(isActive(fila.runs.youtube as ServiceRun)).toBe(false);
  });
});
