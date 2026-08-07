/**
 * Estimativa e saldo de orçamento diário (FR-029, FR-030, research §3 e §5).
 *
 * Puro por construção: `now` é **parâmetro**, nunca `Date.now()`. Sem isso não
 * haveria como testar a virada do dia nos dois sentidos do horário de verão, que
 * é justamente onde um cálculo de fuso costuma errar.
 *
 * Duas decisões que este módulo materializa:
 *
 * 1. **O saldo nunca é consultado ao provedor** (invariante O1). A YouTube Data
 *    API não expõe o consumo já feito; o saldo é sempre
 *    `orçamento padrão − consumo registrado localmente`. Perguntar o orçamento
 *    ao usuário é proibido por FR-029.
 * 2. **O dia é o dia civil no fuso do provedor**, obtido do próprio `Intl` com
 *    `timeZone` fixo. Um deslocamento fixo de −8 h erraria por uma hora durante
 *    ~8 meses do ano e erraria o dia inteiro na janela crítica; uma biblioteca de
 *    fuso seria dependência nova sem ganho sobre o que a plataforma já resolve.
 */

import type { ProviderId, QuotaModel } from '@/domain/providers';
import type { DailyConsumption, QuotaEstimate } from '@/domain/types';

/** Candidatas pedidas por linha na busca — alimenta o custo do enriquecimento. */
export const CANDIDATES_PER_LINE = 5;
/** Ids por chamada de enriquecimento (contracts/youtube-api.md §4). */
export const ENRICH_BATCH_SIZE = 50;

/** Dia civil no fuso do provedor, `YYYY-MM-DD` (FR-030). */
export function providerDay(now: number, timeZone: string): string {
  // `en-CA` já formata em ISO (`2026-08-05`), sem montagem manual de partes.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(now));
}

/**
 * Consumo válido hoje. Registro de outro dia, ausente ou corrompido vale **zero**
 * (invariante O2) — o esgotamento durante a execução (FR-031) é a rede de
 * proteção prevista para essa folga.
 */
export function consumptionToday(
  record: DailyConsumption | null,
  now: number,
  timeZone: string,
): number {
  if (record === null) return 0;
  if (record.ptDate !== providerDay(now, timeZone)) return 0;
  return Number.isFinite(record.units) && record.units > 0 ? record.units : 0;
}

/**
 * Custo nominal em unidades, **sem** margem (`002/research §3`,
 * `003/research §8`):
 *
 * ```text
 * 100·N + 100·R + ceil(5·N / 50)·1 + 1 + 50 + 50·S
 * ```
 *
 * `N` são as linhas buscáveis, `S` os itens confirmados na revisão e `R` as
 * linhas **elegíveis a retentativa**.
 *
 * `R` é novo na 003 e fecha um buraco de passagem que existia desde a 001: o
 * fallback de busca era deliberadamente excluído da conta, e por isso o consumo
 * real podia ultrapassar o que a estimativa prometeu — em uma lista de 50
 * linhas, a margem de 10% cobria 7,5 buscas extras e a oitava já estourava.
 * `R` não é um chute de fração: é a contagem exata das linhas cuja consulta
 * alternativa difere de fato da primeira, conhecida antes de qualquer requisição
 * porque depende só do texto (invariante O5).
 *
 * Omitir `retryReserve`, ou passá-lo como `0`, reproduz **exatamente** a fórmula
 * anterior — é o que mantém os casos existentes de `quota.spec.ts` válidos.
 */
export function nominalCost(
  model: QuotaModel,
  lineCount: number,
  selectedCount: number,
  retryReserve = 0,
): number {
  const lines = Math.max(0, Math.trunc(lineCount));
  const selected = Math.max(0, Math.trunc(selectedCount));
  const retries = Math.max(0, Math.trunc(retryReserve));
  const enrichCalls = Math.ceil((lines * CANDIDATES_PER_LINE) / ENRICH_BATCH_SIZE);

  return (
    model.costs.search * (lines + retries) +
    model.costs.enrich * enrichCalls +
    model.costs.listPlaylists +
    model.costs.createPlaylist +
    model.costs.addItem * selected
  );
}

/** Custo nominal acrescido da margem de segurança, arredondado para cima. */
export function costWithMargin(
  model: QuotaModel,
  lineCount: number,
  selectedCount: number,
  retryReserve = 0,
): number {
  return Math.ceil(
    nominalCost(model, lineCount, selectedCount, retryReserve) * (1 + model.safetyMargin),
  );
}

/**
 * Maior N que cabe no saldo — alimenta a saída "reduzir a lista" (FR-013).
 *
 * Usa a **mesma** medida do bloqueio, com margem. Se usasse o custo nominal, a
 * tela diria "cabem 66 linhas" e, ao reduzir para 66, o bloqueio apareceria de
 * novo — que é exatamente o laço que `002/FR-029` existe para evitar.
 *
 * `retryRatio` é a fração de linhas elegíveis a retentativa **na lista atual**.
 * A reserva encolhe junto com a lista, e ignorá-la aqui recriaria o mesmo laço
 * por outra porta: a tela diria "cabem 40" e, ao reduzir para 40, a reserva
 * proporcional voltaria a bloquear.
 *
 * O custo é monotônico em N, então a busca binária é exata.
 */
export function maxLinesThatFit(
  model: QuotaModel,
  availableUnits: number,
  retryRatio = 0,
): number {
  const ratio = Math.min(1, Math.max(0, retryRatio));
  const costOf = (n: number): number => costWithMargin(model, n, n, Math.ceil(n * ratio));

  if (availableUnits <= 0) return 0;
  if (costOf(1) > availableUnits) return 0;

  let low = 1;
  let high = Math.max(1, Math.ceil(availableUnits / Math.max(1, model.costs.search)));
  while (costOf(high) <= availableUnits) high *= 2;

  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (costOf(mid) <= availableUnits) low = mid;
    else high = mid - 1;
  }
  return low;
}

export interface EstimateInput {
  provider: ProviderId;
  model: QuotaModel;
  lineCount: number;
  selectedCount: number;
  record: DailyConsumption | null;
  now: number;
  /** Linhas elegíveis a retentativa. Omitido = `0` (`003/research §8`). */
  retryReserve?: number;
}

/**
 * Estimativa completa, já com margem, saldo e decisão de bloqueio (FR-029).
 *
 * `blocked === true` ⟺ `estimatedUnits > availableUnits`, e nenhuma requisição
 * de busca é emitida nesse caso (invariante O3, SC-008, SC-011).
 */
export function estimateQuota(input: EstimateInput): QuotaEstimate {
  const { provider, model, lineCount, selectedCount, record, now } = input;

  const lines = Math.max(0, Math.trunc(lineCount));
  const retryReserve = Math.min(lines, Math.max(0, Math.trunc(input.retryReserve ?? 0)));

  const used = consumptionToday(record, now, model.resetTimeZone);
  const availableUnits = Math.max(0, model.dailyBudget - used);
  const estimatedUnits = costWithMargin(model, lineCount, selectedCount, retryReserve);

  return {
    provider,
    lineCount: lines,
    selectedCount: Math.max(0, Math.trunc(selectedCount)),
    estimatedUnits,
    availableUnits,
    blocked: estimatedUnits > availableUnits,
    maxLinesThatFit: maxLinesThatFit(model, availableUnits, lines === 0 ? 0 : retryReserve / lines),
    retryReserve,
  };
}

/**
 * Soma o custo de uma operação ao registro, virando o dia quando preciso.
 *
 * Chamada **após cada resposta** do provedor, com ou sem erro de cota: se a
 * requisição chegou, ela foi contabilizada do outro lado (research §5).
 */
export function addConsumption(
  record: DailyConsumption | null,
  units: number,
  now: number,
  timeZone: string,
  provider: ProviderId,
): DailyConsumption {
  const today = providerDay(now, timeZone);
  const current = record !== null && record.ptDate === today ? record.units : 0;
  return { provider, ptDate: today, units: Math.max(0, current) + Math.max(0, units) };
}
