/**
 * Repositório do Registro de Consumo Diário (`tp.v2.quota.{provider}`).
 *
 * O provedor **não expõe** quanto já foi consumido: o saldo é sempre inferido de
 * `orçamento padrão − consumo registrado aqui` (invariante O1, FR-029).
 *
 * Registro ausente **ou corrompido** vale zero (invariante O2). Tratar corrupção
 * como "consumo desconhecido" e bloquear seria pior do que otimista: o
 * esgotamento durante a execução (FR-031) já é a rede de proteção prevista, e um
 * registro ilegível não é motivo para impedir o usuário de tentar.
 */

import type { ProviderId } from '@/domain/providers';
import type { DailyConsumption } from '@/domain/types';

import {
  asFiniteNumber,
  asString,
  discard,
  readVersioned,
  STORAGE_KEYS,
  writeVersioned,
  type WriteOutcome,
} from './schema';

const PT_DATE = /^\d{4}-\d{2}-\d{2}$/u;

function validateFor(provider: ProviderId) {
  return (raw: Record<string, unknown>): DailyConsumption | null => {
    const ptDate = asString(raw['ptDate']);
    const units = asFiniteNumber(raw['units']);
    if (ptDate === null || !PT_DATE.test(ptDate) || units === null || units < 0) return null;
    return { provider, ptDate, units };
  };
}

/** `null` quando não há registro válido — que o domínio interpreta como zero. */
export function loadConsumption(provider: ProviderId): DailyConsumption | null {
  return readVersioned('local', STORAGE_KEYS.quota(provider), validateFor(provider));
}

export function saveConsumption(record: DailyConsumption): WriteOutcome {
  return writeVersioned('local', STORAGE_KEYS.quota(record.provider), {
    ptDate: record.ptDate,
    units: record.units,
  });
}

export function clearConsumption(provider: ProviderId): void {
  discard('local', STORAGE_KEYS.quota(provider));
}
