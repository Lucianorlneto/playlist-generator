/**
 * Registro de consumo diário do YouTube (FR-029, FR-030, research §5).
 *
 * O consumo é gravado **de forma síncrona, após cada resposta** — mesmo
 * tratamento que o índice de itens confirmados recebe. Um registro perdido por
 * gravação adiada faria a estimativa do dia seguinte partir de um saldo maior do
 * que o real, e o bloqueio prévio de FR-029 deixaria passar uma lista que não
 * cabe.
 *
 * Erro de rede antes de a requisição chegar ao provedor **não** incrementa: o
 * lado de lá não contabilizou nada.
 */

import { addConsumption, estimateQuota } from '@/domain/quota';
import { capabilitiesOf, type QuotaModel, type QuotaOperation } from '@/domain/providers';
import type { QuotaEstimate } from '@/domain/types';
import { loadConsumption, saveConsumption } from '@/services/storage/quotaRepo';

const PROVIDER = 'youtube' as const;

function model(): QuotaModel {
  const quota = capabilitiesOf(PROVIDER).quota;
  if (quota === null) {
    // Inalcançável por construção: o YouTube declara orçamento. Existe para que
    // a mudança dessa capacidade quebre aqui, e não em silêncio.
    throw new Error('O YouTube precisa declarar um QuotaModel');
  }
  return quota;
}

/** Soma o custo de uma operação ao registro do dia corrente. */
export function recordConsumption(operation: QuotaOperation, count = 1): void {
  const quota = model();
  const units = quota.costs[operation] * Math.max(0, count);
  if (units === 0) return;

  const next = addConsumption(
    loadConsumption(PROVIDER),
    units,
    Date.now(),
    quota.resetTimeZone,
    PROVIDER,
  );
  saveConsumption(next);
}

/** Unidades já consumidas hoje, no fuso do provedor. */
export function unitsUsedToday(now: number = Date.now()): number {
  const quota = model();
  const record = loadConsumption(PROVIDER);
  if (record === null) return 0;
  const estimate = estimateQuota({
    provider: PROVIDER,
    model: quota,
    lineCount: 0,
    selectedCount: 0,
    record,
    now,
  });
  return quota.dailyBudget - estimate.availableUnits;
}

/** Estimativa completa para a lista atual, já com margem e saldo (FR-029). */
export function estimate(
  lineCount: number,
  selectedCount: number,
  now: number = Date.now(),
): QuotaEstimate {
  return estimateQuota({
    provider: PROVIDER,
    model: model(),
    lineCount,
    selectedCount,
    record: loadConsumption(PROVIDER),
    now,
  });
}
