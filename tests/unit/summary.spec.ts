import { describe, expect, it } from 'vitest';

import type { ProviderId } from '@/domain/providers';
import { buildSummary } from '@/domain/run/summary';
import type { ExecutionQueue, ServiceRun } from '@/domain/types';

import { makeLine, makeResult, makeRun, makeSession } from '../fixtures/factories';

const LINHAS = [makeLine({ index: 0 }), makeLine({ index: 1 }), makeLine({ index: 2 })];

const SESSOES = {
  spotify: makeSession('spotify'),
  youtube: makeSession('youtube'),
};

function queue(runs: Partial<Record<ProviderId, ServiceRun>>): ExecutionQueue {
  const order = (['spotify', 'youtube'] as ProviderId[]).filter(
    (provider) => runs[provider] !== undefined,
  );
  return { order, currentIndex: order.length, runs: runs as Record<ProviderId, ServiceRun> };
}

function summarize(runs: Partial<Record<ProviderId, ServiceRun>>) {
  return buildSummary(queue(runs), { lines: LINHAS, sessions: SESSOES });
}

describe('FR-040 — resumo consolidado', () => {
  it('uma entrada por serviço, na ordem fixa', () => {
    const resumo = summarize({
      spotify: makeRun('spotify', {
        outcome: 'completed',
        lineIds: ['l0', 'l1', 'l2'],
        result: makeResult({ addedCount: 3 }),
      }),
      youtube: makeRun('youtube', {
        outcome: 'skipped',
        lineIds: ['l0', 'l1', 'l2'],
      }),
    });

    expect(resumo.entries.map((entry) => entry.provider)).toEqual(['spotify', 'youtube']);
    expect(resumo.entries[0]?.outcome).toBe('completed');
    expect(resumo.entries[1]?.outcome).toBe('skipped');
  });

  it('informa em qual conta cada playlist foi criada (FR-036)', () => {
    const resumo = summarize({
      spotify: makeRun('spotify', { outcome: 'completed', result: makeResult() }),
      youtube: makeRun('youtube', {
        outcome: 'completed',
        result: makeResult({ provider: 'youtube' }),
      }),
    });

    expect(resumo.entries[0]?.accountLabel).toBe('Fulano de Teste');
    expect(resumo.entries[1]?.accountLabel).toBe('Canal de Teste');
  });

  it('propaga contagens e linhas não encontradas por serviço (FR-041)', () => {
    const resumo = summarize({
      spotify: makeRun('spotify', {
        outcome: 'partial',
        lineIds: ['l0', 'l1'],
        result: makeResult({ addedCount: 1, skippedCount: 1, failedLines: ['Linha X'] }),
      }),
    });

    const entrada = resumo.entries[0];
    expect(entrada?.addedCount).toBe(1);
    expect(entrada?.skippedCount).toBe(1);
    expect(entrada?.failedLines).toEqual(['Linha X']);
    expect(entrada?.lineCount).toBe(2);
  });

  it('sinaliza playlist incompleta por cota (FR-032)', () => {
    const resumo = summarize({
      youtube: makeRun('youtube', {
        outcome: 'partial',
        result: makeResult({ provider: 'youtube', incompleteByQuota: true }),
      }),
    });
    expect(resumo.entries[0]?.incompleteByQuota).toBe(true);
  });

  it('é derivado só da fila — nenhum estado próprio (invariante U1)', () => {
    const fila = queue({
      spotify: makeRun('spotify', { outcome: 'completed', result: makeResult() }),
    });
    const um = buildSummary(fila, { lines: LINHAS, sessions: SESSOES });
    const dois = buildSummary(fila, { lines: LINHAS, sessions: SESSOES });
    expect(um).toEqual(dois);
  });
});

describe('SC-018 — divergência de listas', () => {
  it('listsDiverged é falso quando os dois serviços receberam a mesma lista', () => {
    const resumo = summarize({
      spotify: makeRun('spotify', { outcome: 'completed', lineIds: ['l0', 'l1', 'l2'] }),
      youtube: makeRun('youtube', { outcome: 'completed', lineIds: ['l0', 'l1', 'l2'] }),
    });
    expect(resumo.listsDiverged).toBe(false);
    expect(resumo.removedForLater).toEqual([]);
  });

  it('listsDiverged é verdadeiro quando os tamanhos divergem', () => {
    const resumo = summarize({
      spotify: makeRun('spotify', { outcome: 'completed', lineIds: ['l0', 'l1', 'l2'] }),
      youtube: makeRun('youtube', { outcome: 'completed', lineIds: ['l0'] }),
    });
    expect(resumo.listsDiverged).toBe(true);
  });

  it('lista as linhas removidas para os destinos posteriores, pelo raw original', () => {
    const resumo = summarize({
      spotify: makeRun('spotify', { outcome: 'completed', lineIds: ['l0', 'l1', 'l2'] }),
      youtube: makeRun('youtube', { outcome: 'completed', lineIds: ['l0'] }),
    });
    expect(resumo.removedForLater).toHaveLength(2);
    expect(resumo.removedForLater.every((raw) => raw === 'Bohemian Rhapsody - Queen')).toBe(true);
  });

  it('um único destino nunca diverge', () => {
    const resumo = summarize({
      spotify: makeRun('spotify', { outcome: 'completed', lineIds: ['l0'] }),
    });
    expect(resumo.listsDiverged).toBe(false);
    expect(resumo.removedForLater).toEqual([]);
  });

  it('destino pulado antes de receber lista não conta como divergência', () => {
    const resumo = summarize({
      spotify: makeRun('spotify', { outcome: 'completed', lineIds: ['l0', 'l1'] }),
      youtube: makeRun('youtube', { outcome: 'skipped', lineIds: [] }),
    });
    expect(resumo.listsDiverged).toBe(false);
  });
});
