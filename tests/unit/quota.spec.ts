import { describe, expect, it } from 'vitest';

import { YOUTUBE_QUOTA } from '@/domain/providers';
import {
  addConsumption,
  consumptionToday,
  costWithMargin,
  estimateQuota,
  maxLinesThatFit,
  nominalCost,
  providerDay,
} from '@/domain/quota';

const MODEL = YOUTUBE_QUOTA;

/** 5 de agosto de 2026, 12:00 em Los Angeles (horário de verão, UTC−7). */
const MEIO_DIA_PT = Date.UTC(2026, 7, 5, 19, 0, 0);

function estimate(lineCount: number, selectedCount: number, used = 0) {
  return estimateQuota({
    provider: 'youtube',
    model: MODEL,
    lineCount,
    selectedCount,
    record: used === 0 ? null : { provider: 'youtube', ptDate: providerDay(MEIO_DIA_PT, MODEL.resetTimeZone), units: used },
    now: MEIO_DIA_PT,
  });
}

describe('research §3 — custo nominal', () => {
  /** `100·N + ceil(5N/50) + 1 + 50 + 50·S`, com N = S = 50 → 7 556. */
  it('reproduz o número registrado na spec para 50 linhas', () => {
    expect(nominalCost(MODEL, 50, 50)).toBe(7_556);
  });

  it('decompõe corretamente cada parcela', () => {
    // 1 linha: 100 (busca) + 1 (enriquecimento) + 1 (listar) + 50 (criar) + 50 (item)
    expect(nominalCost(MODEL, 1, 1)).toBe(202);
    // Sem itens confirmados, o custo de adição some.
    expect(nominalCost(MODEL, 1, 0)).toBe(152);
  });

  it('é monotônico em lineCount (FR-029)', () => {
    let anterior = -1;
    for (let n = 0; n <= 80; n += 1) {
      const atual = nominalCost(MODEL, n, n);
      expect(atual).toBeGreaterThan(anterior);
      anterior = atual;
    }
  });

  it('trata entrada negativa ou fracionária como zero/truncada', () => {
    expect(nominalCost(MODEL, -5, -5)).toBe(nominalCost(MODEL, 0, 0));
    expect(nominalCost(MODEL, 2.9, 2.9)).toBe(nominalCost(MODEL, 2, 2));
  });
});

describe('FR-029 — estimativa com margem e bloqueio', () => {
  it('aplica a margem de 10% sobre o custo nominal', () => {
    expect(costWithMargin(MODEL, 50, 50)).toBe(Math.ceil(7_556 * 1.1));
    expect(estimate(50, 50).estimatedUnits).toBe(Math.ceil(7_556 * 1.1));
  });

  it('50 linhas cabem no orçamento padrão de um dia limpo', () => {
    const resultado = estimate(50, 50);
    expect(resultado.availableUnits).toBe(10_000);
    expect(resultado.blocked).toBe(false);
  });

  it('blocked ⟺ estimatedUnits > availableUnits', () => {
    for (const linhas of [1, 10, 50, 60, 61, 100, 200]) {
      const resultado = estimate(linhas, linhas);
      expect(resultado.blocked).toBe(resultado.estimatedUnits > resultado.availableUnits);
    }
  });

  it('o saldo desconta o consumo já registrado hoje (invariante O1)', () => {
    expect(estimate(1, 1, 9_000).availableUnits).toBe(1_000);
    // 202 × 1,1 = 223 unidades para uma linha: cabe em 1 000, não cabe em 100.
    expect(estimate(1, 1, 9_000).blocked).toBe(false);
    expect(estimate(1, 1, 9_900).blocked).toBe(true);
  });

  it('a estimativa é monotônica em lineCount (FR-029)', () => {
    let anterior = -1;
    for (let n = 0; n <= 80; n += 1) {
      const atual = estimate(n, n).estimatedUnits;
      expect(atual).toBeGreaterThan(anterior);
      anterior = atual;
    }
  });
});

describe('FR-013 — maxLinesThatFit alimenta "reduzir a lista"', () => {
  /**
   * A propriedade que importa: reduzir para `maxLinesThatFit` **desbloqueia**.
   * Se a função usasse o custo nominal e o bloqueio usasse a margem, a tela
   * ofereceria uma redução que voltaria a ser bloqueada.
   */
  it('a lista reduzida ao valor sugerido deixa de ser bloqueada', () => {
    for (const usado of [0, 3_000, 7_000, 9_500, 9_990]) {
      const inicial = estimate(200, 200, usado);
      const cabem = inicial.maxLinesThatFit;
      if (cabem === 0) {
        expect(estimate(1, 1, usado).blocked).toBe(true);
        continue;
      }
      expect(estimate(cabem, cabem, usado).blocked).toBe(false);
      expect(estimate(cabem + 1, cabem + 1, usado).blocked).toBe(true);
    }
  });

  it('saldo zerado não comporta nenhuma linha', () => {
    expect(maxLinesThatFit(MODEL, 0)).toBe(0);
    expect(maxLinesThatFit(MODEL, -100)).toBe(0);
    expect(maxLinesThatFit(MODEL, 10)).toBe(0);
  });

  it('o teto prático de um dia limpo fica na casa das dezenas', () => {
    const cabem = maxLinesThatFit(MODEL, MODEL.dailyBudget);
    expect(cabem).toBeGreaterThan(40);
    expect(cabem).toBeLessThan(70);
  });
});

describe('FR-030 — virada do dia no fuso do provedor', () => {
  it('providerDay devolve o dia civil em Pacific Time, não em UTC', () => {
    // 6 de agosto de 2026, 02:00 UTC → ainda dia 5 em Los Angeles (UTC−7).
    expect(providerDay(Date.UTC(2026, 7, 6, 2, 0, 0), MODEL.resetTimeZone)).toBe('2026-08-05');
    // 6 de agosto, 08:00 UTC → já é dia 6 lá.
    expect(providerDay(Date.UTC(2026, 7, 6, 8, 0, 0), MODEL.resetTimeZone)).toBe('2026-08-06');
  });

  /**
   * A janela crítica do horário de verão: um deslocamento fixo de −8 h erraria
   * o dia inteiro em uma das duas pontas.
   */
  it('atravessa o horário de verão nos dois sentidos', () => {
    // Verão (UTC−7): 8 de julho, 06:30 UTC ainda é dia 7 em Los Angeles.
    expect(providerDay(Date.UTC(2026, 6, 8, 6, 30, 0), MODEL.resetTimeZone)).toBe('2026-07-07');
    expect(providerDay(Date.UTC(2026, 6, 8, 7, 30, 0), MODEL.resetTimeZone)).toBe('2026-07-08');

    // Inverno (UTC−8): 8 de janeiro, 07:30 UTC ainda é dia 7 lá.
    expect(providerDay(Date.UTC(2026, 0, 8, 7, 30, 0), MODEL.resetTimeZone)).toBe('2026-01-07');
    expect(providerDay(Date.UTC(2026, 0, 8, 8, 30, 0), MODEL.resetTimeZone)).toBe('2026-01-08');
  });

  it('registro de outro dia vale zero (invariante O2)', () => {
    const ontem = { provider: 'youtube' as const, ptDate: '2026-08-04', units: 9_999 };
    expect(consumptionToday(ontem, MEIO_DIA_PT, MODEL.resetTimeZone)).toBe(0);
  });

  it('registro ausente ou corrompido vale zero (invariante O2)', () => {
    expect(consumptionToday(null, MEIO_DIA_PT, MODEL.resetTimeZone)).toBe(0);
    const hoje = providerDay(MEIO_DIA_PT, MODEL.resetTimeZone);
    expect(
      consumptionToday(
        { provider: 'youtube', ptDate: hoje, units: Number.NaN },
        MEIO_DIA_PT,
        MODEL.resetTimeZone,
      ),
    ).toBe(0);
    expect(
      consumptionToday(
        { provider: 'youtube', ptDate: hoje, units: -50 },
        MEIO_DIA_PT,
        MODEL.resetTimeZone,
      ),
    ).toBe(0);
  });

  it('addConsumption acumula no mesmo dia e zera na virada', () => {
    const primeiro = addConsumption(null, 100, MEIO_DIA_PT, MODEL.resetTimeZone, 'youtube');
    expect(primeiro).toEqual({ provider: 'youtube', ptDate: '2026-08-05', units: 100 });

    const segundo = addConsumption(primeiro, 50, MEIO_DIA_PT, MODEL.resetTimeZone, 'youtube');
    expect(segundo.units).toBe(150);

    // Dia seguinte: o registro antigo não contamina o novo.
    const amanha = addConsumption(
      segundo,
      1,
      Date.UTC(2026, 7, 6, 19, 0, 0),
      MODEL.resetTimeZone,
      'youtube',
    );
    expect(amanha).toEqual({ provider: 'youtube', ptDate: '2026-08-06', units: 1 });
  });
});
