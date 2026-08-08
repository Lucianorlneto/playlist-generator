/**
 * V1 — há trabalho a descartar? (`006/FR-021`).
 *
 * Fonte única de uma pergunta que era feita em dois lugares com fronteiras
 * diferentes: a restauração do rascunho e a visibilidade do botão de recomeço.
 * Duas definições que discordassem em silêncio produziriam um botão oferecido
 * onde não há nada a descartar, ou escondido onde há (`006/data-model §2`).
 */

import { describe, expect, it } from 'vitest';

import { hasWork } from '@/domain/work';

import { makeCreation, makeItem, makeLine, makeQueue, makeRun } from '../fixtures/factories';

const vazio = {
  rawText: '',
  lines: [],
  queue: makeQueue([], { currentIndex: -1 }),
};

describe('hasWork — tabela de flow-contract §2', () => {
  it('tudo vazio e fila vazia → false nos dois modos', () => {
    expect(hasWork(vazio)).toBe(false);
    expect(hasWork(vazio, { queueCounts: true })).toBe(false);
  });

  /**
   * A única linha em que os dois modos discordam, e a razão de o parâmetro
   * existir. Um rascunho gravado com fila montada e nada mais não vale
   * restaurar — não há o que devolver ao usuário. Mas quem escolheu destinos e
   * avançou **tem** o que descartar.
   */
  it('fila montada e nada mais → false sem queueCounts, true com', () => {
    const work = { ...vazio, queue: makeQueue(['spotify']) };
    expect(hasWork(work)).toBe(false);
    expect(hasWork(work, { queueCounts: true })).toBe(true);
  });

  it('texto colado → true nos dois modos', () => {
    const work = { ...vazio, rawText: 'Bohemian Rhapsody - Queen' };
    expect(hasWork(work)).toBe(true);
    expect(hasWork(work, { queueCounts: true })).toBe(true);
  });

  it('texto só de espaços não conta', () => {
    expect(hasWork({ ...vazio, rawText: '   \n  ' })).toBe(false);
  });

  it('linhas analisadas → true nos dois modos', () => {
    const work = { ...vazio, lines: [makeLine({ index: 0 })] };
    expect(hasWork(work)).toBe(true);
    expect(hasWork(work, { queueCounts: true })).toBe(true);
  });

  it('execução com itens → true nos dois modos', () => {
    const linha = makeLine({ index: 0 });
    const work = {
      ...vazio,
      queue: makeQueue(['spotify'], {
        runs: { spotify: makeRun('spotify', { items: [makeItem({ line: linha })] }) },
      }),
    };
    expect(hasWork(work)).toBe(true);
    expect(hasWork(work, { queueCounts: true })).toBe(true);
  });

  it('execução com criação em andamento → true nos dois modos', () => {
    const work = {
      ...vazio,
      queue: makeQueue(['spotify'], {
        runs: { spotify: makeRun('spotify', { creation: makeCreation() }) },
      }),
    };
    expect(hasWork(work)).toBe(true);
    expect(hasWork(work, { queueCounts: true })).toBe(true);
  });
});
