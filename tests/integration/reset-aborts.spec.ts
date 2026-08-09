/**
 * V12 — descartar o trabalho **cancela** o que estava em voo (`006/FR-022`).
 *
 * O defeito que este arquivo prende foi medido na Fase 0: `blankWork()` zerava
 * `searchAbort` **sem abortar**, e o controlador ia embora sem que ninguém mais
 * pudesse pará-lo. A busca seguia até o fim, gastando cota de um trabalho que o
 * usuário acabara de jogar fora (`006/research §6`).
 *
 * Antes desta feature isso era raro: `discardDraft` só era alcançável pela faixa
 * de rascunho, que aparece na recuperação, na migração e no esgotamento de cota
 * — situações em que raramente há busca em voo. O botão global de recomeço torna
 * o caminho comum, alcançável de dentro da própria tela de busca.
 *
 * Também cobre V6/FR-019 e SC-003: nenhum caminho de descarte emite requisição a
 * provedor algum, e uma playlist já criada não é removida.
 */

import { describe, expect, it } from 'vitest';

import { useAppStore } from '@/store';

import {
  makeCredentials,
  makeLine,
  makeQueueWithOutcomes,
  makeSession,
  makeSessions,
} from '../fixtures/factories';
import { createdPlaylist, requestLog, seedCreatedPlaylist } from '../msw/handlers';

function semearTrabalho() {
  const linha = makeLine({ id: 'l0', index: 0 });
  useAppStore.setState({
    step: 'service',
    rawText: 'Bohemian Rhapsody - Queen',
    lines: [linha],
    credentials: makeCredentials({ spotify: 'abc' }),
    sessions: makeSessions({ spotify: makeSession('spotify') }),
    destinations: { selected: ['spotify'], locked: true },
    queue: makeQueueWithOutcomes(['spotify'], { spotify: null }),
  });
  return linha;
}

describe('V12 — descartar cancela a busca em voo (FR-022)', () => {
  it('resetWork aborta o controlador registrado', () => {
    semearTrabalho();
    const controller = new AbortController();
    useAppStore.getState().startSearch(1, controller);

    useAppStore.getState().resetWork();

    expect(controller.signal.aborted).toBe(true);
    expect(useAppStore.getState().searchAbort).toBeNull();
  });

  it('discardDraft aborta o controlador registrado', () => {
    semearTrabalho();
    const controller = new AbortController();
    useAppStore.getState().startSearch(1, controller);

    useAppStore.getState().discardDraft();

    expect(controller.signal.aborted).toBe(true);
    expect(useAppStore.getState().searchAbort).toBeNull();
  });

  it('descartar sem busca em voo não quebra', () => {
    semearTrabalho();
    expect(() => {
      useAppStore.getState().resetWork();
    }).not.toThrow();
    expect(useAppStore.getState().step).toBe('destinations');
  });

  /**
   * FR-019 e SC-003. A contagem é sobre o registro **inteiro** de requisições,
   * não sobre um endpoint escolhido a dedo: o requisito é "nenhuma requisição",
   * e verificar só os endpoints que lembramos de listar deixaria de fora
   * justamente o que ninguém previu.
   */
  it('recomeçar não emite nenhuma requisição a nenhum provedor (FR-019, SC-003)', () => {
    semearTrabalho();
    seedCreatedPlaylist('pl-1', 'Clássicos', ['spotify:track:1']);
    const antes = requestLog.length;

    useAppStore.getState().resetWork();

    expect(requestLog.length).toBe(antes);
  });

  it('recomeçar preserva credenciais e sessões (FR-018, SC-006)', () => {
    semearTrabalho();
    const credenciaisAntes = useAppStore.getState().credentials;
    const sessoesAntes = useAppStore.getState().sessions;

    useAppStore.getState().resetWork();

    const depois = useAppStore.getState();
    expect(depois.credentials).toEqual(credenciaisAntes);
    expect(depois.sessions).toEqual(sessoesAntes);
    expect(depois.rawText).toBe('');
    expect(depois.lines).toHaveLength(0);
    expect(depois.queue.order).toHaveLength(0);
  });
});

/**
 * V11b/SC-003 — o descarte não alcança a conta do usuário.
 *
 * "Descartar" é uma palavra que assusta com razão, e o requisito é que ela seja
 * literalmente verdadeira sobre o trabalho local e literalmente falsa sobre a
 * biblioteca de quem usa o app: uma playlist já criada permanece, e nenhuma
 * remoção é tentada.
 */
describe('V11b — recomeçar não remove nem altera nada na conta (SC-003)', () => {
  it('nenhuma requisição de escrita, remoção ou alteração é emitida', () => {
    semearTrabalho();
    seedCreatedPlaylist('pl-1', 'Clássicos', ['spotify:track:1', 'spotify:track:2']);

    useAppStore.getState().resetWork();

    const escritas = requestLog.filter((entry) => entry.method !== 'GET');
    expect(escritas).toEqual([]);
  });

  it('a playlist criada continua com as faixas que tinha', () => {
    semearTrabalho();
    seedCreatedPlaylist('pl-1', 'Clássicos', ['spotify:track:1', 'spotify:track:2']);

    useAppStore.getState().resetWork();

    expect(createdPlaylist('pl-1')?.uris).toEqual(['spotify:track:1', 'spotify:track:2']);
  });
});
