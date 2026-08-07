/**
 * V8 e A4 — `remainingLineIds`, a fonte **única** de "o que falta"
 * (`004/data-model §4`, `004/provider-contract §5`).
 *
 * Dois consumidores precisam concordar: o texto de custo do diálogo (FR-013) e a
 * lista efetivamente buscada na retomada (FR-013b). Uma função só é o que faz
 * SC-008 — desvio nulo entre o custo informado e o real — verdadeiro por
 * construção, e não por duas contas que alguém precisa lembrar de manter iguais.
 *
 * A distinção que a função depende: `pending` significa "ainda não busquei",
 * nunca "busquei e não achei" (invariante A3). É a mesma distinção que o
 * cancelamento já usava.
 */

import { describe, expect, it } from 'vitest';

import { remainingLineIds } from '@/domain/run/lines';
import { pendingItem } from '@/domain/types';

import { makeItem, makeLine, makeRun } from '../fixtures/factories';

function comLinhas(total: number) {
  return Array.from({ length: total }, (_, index) => makeLine({ id: `l${index}`, index }));
}

describe('V8/A4 — subconjunto ordenado das linhas do destino', () => {
  it('devolve só as linhas ainda pendentes', () => {
    const linhas = comLinhas(5);
    const run = makeRun('youtube', {
      lineIds: linhas.map((linha) => linha.id),
      items: [
        makeItem({ line: linhas[0]!, status: 'confident' }),
        makeItem({ line: linhas[1]!, status: 'uncertain' }),
        pendingItem(linhas[2]!),
        makeItem({ line: linhas[3]!, status: 'not_found', candidates: [], selectedUri: null }),
        pendingItem(linhas[4]!),
      ],
    });

    expect(remainingLineIds(run)).toEqual(['l2', 'l4']);
  });

  it('A4 — o resultado é subconjunto de lineIds e preserva a ordem', () => {
    const linhas = comLinhas(6);
    const run = makeRun('youtube', {
      lineIds: ['l0', 'l1', 'l2', 'l3', 'l4', 'l5'],
      // Deliberadamente fora de ordem: a ordem de saída é a de `lineIds`, não a
      // de `items` — a concorrência da busca não pode reordenar a retomada.
      items: [
        pendingItem(linhas[4]!),
        makeItem({ line: linhas[5]!, status: 'confident' }),
        pendingItem(linhas[1]!),
        makeItem({ line: linhas[0]!, status: 'confident' }),
        pendingItem(linhas[3]!),
        makeItem({ line: linhas[2]!, status: 'not_found', candidates: [], selectedUri: null }),
      ],
    });

    const restantes = remainingLineIds(run);
    expect(restantes).toEqual(['l1', 'l3', 'l4']);
    expect(restantes.every((id) => run.lineIds.includes(id))).toBe(true);
  });

  it('linha sem item algum conta como pendente', () => {
    // É o estado da execução que nunca chegou a buscar: `items` vazio.
    const run = makeRun('youtube', { lineIds: ['l0', 'l1', 'l2'], items: [] });
    expect(remainingLineIds(run)).toEqual(['l0', 'l1', 'l2']);
  });

  it('linha fora de lineIds não entra, mesmo pendente', () => {
    // A lista de um destino posterior é subconjunto da anterior (FR-013). Um
    // item remanescente de outro destino não pode reabrir uma linha que este
    // aqui nunca recebeu.
    const forasteira = makeLine({ id: 'outra', index: 9 });
    const run = makeRun('youtube', {
      lineIds: ['l0'],
      items: [pendingItem(makeLine({ id: 'l0', index: 0 })), pendingItem(forasteira)],
    });
    expect(remainingLineIds(run)).toEqual(['l0']);
    expect(remainingLineIds(run)).not.toContain('outra');
  });

  it('linha inválida não é buscada de novo — `unparsed` não é pendência', () => {
    // `pendingItem` de uma linha sem conteúdo alfanumérico sai `unparsed`, e
    // buscá-la violaria `003/FR-011` gastando cota com `---` e emoji.
    const invalida = makeLine({ id: 'l1', index: 1, raw: '---', parseStatus: 'unparsed' });
    const run = makeRun('youtube', {
      lineIds: ['l0', 'l1'],
      items: [pendingItem(makeLine({ id: 'l0', index: 0 })), pendingItem(invalida)],
    });
    expect(remainingLineIds(run)).toEqual(['l0']);
  });

  it('caso de borda: nenhuma linha resolvida degrada para a lista inteira', () => {
    const linhas = comLinhas(3);
    const run = makeRun('youtube', {
      lineIds: linhas.map((linha) => linha.id),
      items: linhas.map((linha) => pendingItem(linha)),
    });
    expect(remainingLineIds(run)).toEqual(['l0', 'l1', 'l2']);
  });

  it('caso de borda: todas resolvidas não deixa nada a retomar', () => {
    const linhas = comLinhas(3);
    const run = makeRun('youtube', {
      lineIds: linhas.map((linha) => linha.id),
      items: linhas.map((linha) => makeItem({ line: linha, status: 'confident' })),
    });
    expect(remainingLineIds(run)).toEqual([]);
  });

  it('item `searching` conta como pendente — a requisição não voltou', () => {
    const linha = makeLine({ id: 'l0', index: 0 });
    const run = makeRun('youtube', {
      lineIds: ['l0'],
      items: [{ ...pendingItem(linha), status: 'searching' }],
    });
    expect(remainingLineIds(run)).toEqual(['l0']);
  });

  it('item descartado na revisão não volta a ser buscado', () => {
    const linha = makeLine({ id: 'l0', index: 0 });
    const run = makeRun('youtube', {
      lineIds: ['l0'],
      items: [makeItem({ line: linha, status: 'discarded', previousStatus: 'confident' })],
    });
    expect(remainingLineIds(run)).toEqual([]);
  });
});
