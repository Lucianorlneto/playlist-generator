import { describe, expect, it } from 'vitest';

import { segundosRestantes } from '@/domain/retry/countdown';

/**
 * A contagem regressiva da espera por limitação de taxa — 009/FR-018a.
 *
 * O teste existe porque a função é a única regra que a feature acrescenta ao
 * domínio, e porque as três decisões que ela carrega — piso, arredondamento e o
 * instante exato do vencimento — são invisíveis no tipo. `agora` como parâmetro
 * é o que torna este arquivo possível sem congelar o relógio do processo.
 */

describe('FR-018a · segundos restantes até a espera vencer', () => {
  it('arredonda para cima: 1200ms restantes são 2 segundos', () => {
    // Arredondar para baixo mostraria o número menor durante quase um segundo
    // inteiro, e um contador que fica parado lê como travamento.
    expect(segundosRestantes(11_200, 10_000)).toBe(2);
  });

  it('200ms restantes ainda são 1 segundo, não 0', () => {
    expect(segundosRestantes(10_200, 10_000)).toBe(1);
  });

  it('um múltiplo exato não é inflado', () => {
    expect(segundosRestantes(13_000, 10_000)).toBe(3);
  });

  it('no instante exato do vencimento a contagem é zero', () => {
    expect(segundosRestantes(10_000, 10_000)).toBe(0);
  });

  it('espera vencida tem piso em zero, nunca negativo', () => {
    // O relógio do cliente pode estar adiantado em relação ao instante que o
    // serviço devolveu; um "-3" na tela seria a consequência visível disso.
    expect(segundosRestantes(10_000, 15_000)).toBe(0);
    expect(segundosRestantes(0, 999_999)).toBe(0);
  });

  it('é pura: o mesmo par de entradas devolve sempre o mesmo número', () => {
    // A ausência de `Date.now()` dentro da função é o que esta asserção protege.
    // Sem ela, duas chamadas idênticas divergiriam com o passar do tempo.
    const primeira = segundosRestantes(20_000, 10_000);
    const segunda = segundosRestantes(20_000, 10_000);
    expect(primeira).toBe(segunda);
    expect(primeira).toBe(10);
  });
});
