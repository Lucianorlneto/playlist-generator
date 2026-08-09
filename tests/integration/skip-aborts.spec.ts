/**
 * V6 e V7 — pular cancela o que está em voo e não escreve nada
 * (`006/FR-009`, FR-011, garantia G1 de `contracts/flow-contract §3`).
 *
 * O botão de pular é oferecido durante a busca (`ReviewScreen` é renderizada nas
 * fases `search` e `review`). Até a `006`, pular ali não abortava nada: o
 * controlador ficava no store até `finishSearch`, e as requisições seguiam
 * saindo depois de o usuário ter desistido do destino (`006/research §5`).
 *
 * O resultado tardio sempre foi inofensivo — `reduceRun` é identidade sobre
 * execução encerrada (invariante R2) —, mas a rede não sabia disso.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { useAppStore } from '@/store';

import {
  makeCredentials,
  makeLine,
  makeQueueWithOutcomes,
  makeRun,
  makeSession,
  makeSessions,
} from '../fixtures/factories';
import { requestLog, seedCreatedPlaylist, setCatalog } from '../msw/handlers';

import { useFastLimiters, wireSpotify } from './support/clients';

const linhas = [
  makeLine({ id: 'l0', index: 0 }),
  makeLine({ id: 'l1', index: 1, raw: 'Under Pressure - Queen', title: 'Under Pressure' }),
];

function semear(order: ('spotify' | 'youtube')[] = ['spotify', 'youtube']) {
  useAppStore.setState({
    step: 'service',
    rawText: linhas.map((l) => l.raw).join('\n'),
    lines: linhas,
    credentials: makeCredentials({ spotify: 'abc', youtube: 'x.apps.googleusercontent.com' }),
    sessions: makeSessions({ spotify: makeSession('spotify') }),
    destinations: { selected: order, locked: true },
    queue: {
      ...makeQueueWithOutcomes(order, {}),
      runs: Object.fromEntries(
        order.map((provider) => [
          provider,
          makeRun(provider, {
            phase: provider === order[0] ? 'search' : 'pending',
            lineIds: linhas.map((l) => l.id),
          }),
        ]),
      ) as ReturnType<typeof makeQueueWithOutcomes>['runs'],
    },
  });
}

beforeEach(() => {
  wireSpotify();
  useFastLimiters();
  setCatalog([]);
});

describe('V6 — pular aborta a busca em voo (FR-011)', () => {
  it('o controlador registrado é abortado', () => {
    semear();
    const controller = new AbortController();
    useAppStore.getState().startSearch(2, controller);

    useAppStore.getState().skipService('spotify');

    expect(controller.signal.aborted).toBe(true);
  });

  it('o aborto acontece antes do encerramento da execução (invariante S1)', () => {
    semear();
    const controller = new AbortController();
    const ordem: string[] = [];
    controller.signal.addEventListener('abort', () => {
      ordem.push(`abort:${useAppStore.getState().queue.runs.spotify?.outcome ?? 'null'}`);
    });
    useAppStore.getState().startSearch(2, controller);

    useAppStore.getState().skipService('spotify');

    // No instante do aborto a execução ainda não tinha desfecho: cancelar é a
    // primeira coisa, e não uma limpeza posterior.
    expect(ordem).toEqual(['abort:null']);
  });

  it('pular sem busca em voo não quebra', () => {
    semear();
    expect(() => {
      useAppStore.getState().skipService('spotify');
    }).not.toThrow();
    expect(useAppStore.getState().queue.runs.spotify?.outcome).toBe('skipped');
  });
});

describe('V7 — pular não escreve nada (FR-009, garantia G1)', () => {
  it('nenhuma requisição é emitida a nenhum provedor', () => {
    semear();
    const antes = requestLog.length;

    useAppStore.getState().skipService('spotify');

    expect(requestLog.length).toBe(antes);
  });

  it('uma playlist já existente não é tocada', () => {
    semear();
    seedCreatedPlaylist('pl-1', 'Clássicos', ['spotify:track:1']);
    const antes = requestLog.length;

    useAppStore.getState().skipService('spotify');
    useAppStore.getState().skipService('youtube');

    expect(requestLog.length).toBe(antes);
  });
});

describe('skipService — a sequência contratada (flow-contract §3)', () => {
  it('encerra como pulado e avança a fila num ato só', () => {
    semear();

    useAppStore.getState().skipService('spotify');

    const estado = useAppStore.getState();
    expect(estado.queue.runs.spotify?.outcome).toBe('skipped');
    expect(estado.queue.currentIndex).toBe(1);
    expect(estado.step).toBe('service');
  });

  it('pular duas vezes o mesmo destino não avança a fila duas vezes (G2)', () => {
    semear();

    useAppStore.getState().skipService('spotify');
    useAppStore.getState().skipService('spotify');

    expect(useAppStore.getState().queue.currentIndex).toBe(1);
  });

  /**
   * FR-010 e garantia G3. A asserção é sobre **desfecho, resultado e lista** —
   * não sobre o objeto inteiro.
   *
   * `frozenLines` sair de `null` ao avançar não é alteração de relato: é o
   * congelamento que `advanceQueue` faz justamente para que uma redução de lista
   * posterior não reescreva retroativamente quem já terminou (SC-018). Uma lista
   * **já congelada**, essa sim, não pode ser tocada — é o que o segundo caso
   * verifica.
   */
  it('não altera desfecho nem resultado de um destino já encerrado (G3, FR-010)', () => {
    semear();
    useAppStore.setState({
      queue: makeQueueWithOutcomes(['spotify', 'youtube'], { spotify: 'completed' }),
    });
    const antes = useAppStore.getState().queue.runs.spotify;

    useAppStore.getState().skipService('youtube');

    const depois = useAppStore.getState().queue.runs.spotify;
    expect(depois?.outcome).toBe(antes?.outcome);
    expect(depois?.result).toEqual(antes?.result);
    expect(depois?.lineIds).toEqual(antes?.lineIds);
  });

  it('não reescreve uma lista já congelada (SC-018)', () => {
    semear();
    const congeladas = [linhas[0]!];
    useAppStore.setState({
      queue: {
        ...makeQueueWithOutcomes(['spotify', 'youtube'], { spotify: 'completed' }),
        runs: {
          spotify: makeRun('spotify', {
            outcome: 'completed',
            phase: 'done',
            lineIds: [linhas[0]!.id],
            frozenLines: congeladas,
          }),
          youtube: makeRun('youtube', { phase: 'connect', lineIds: linhas.map((l) => l.id) }),
        },
      },
    });

    useAppStore.getState().skipService('youtube');

    expect(useAppStore.getState().queue.runs.spotify?.frozenLines).toEqual(congeladas);
  });
});
