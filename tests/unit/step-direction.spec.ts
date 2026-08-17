import { describe, expect, it } from 'vitest';

import { stepDirection } from '@/domain/rail/stepDirection';
import { WIZARD_STEPS } from '@/domain/types';

/**
 * A direção da troca de etapa — FR-022, FR-024 (`010/data-model.md` §3).
 *
 * Derivação **pura**: sem DOM, sem relógio, sem estado (Princípio III). É o que
 * permite cobrir **todo par** de etapas em vez de amostrar três casos numa tela
 * montada.
 *
 * A ordem canônica é `WIZARD_STEPS`, e a função não a duplica — este teste
 * também não. Acrescentar uma etapa ao fluxo estende a cobertura sozinho.
 */

describe('FR-022 · a direção vem da posição na ordem canônica', () => {
  it('a ordem canônica tem as cinco etapas do fluxo', () => {
    // O contrapeso da varredura abaixo: com uma lista vazia, todo `it.each`
    // sumiria e o arquivo passaria sem afirmar nada.
    expect(WIZARD_STEPS).toEqual(['credential', 'destinations', 'input', 'service', 'summary']);
  });

  const pares = WIZARD_STEPS.flatMap((from, i) =>
    WIZARD_STEPS.map((to, j) => ({ from, to, i, j })),
  );

  it.each(pares.map((p) => [p.from, p.to, p] as const))(
    '%s → %s devolve a direção esperada',
    (_de, _para, { from, to, i, j }) => {
      const esperado = i < j ? 1 : i > j ? -1 : 0;
      expect(stepDirection(from, to)).toBe(esperado);
    },
  );

  it('avanço é sempre 1, retorno sempre -1, em todo par distinto', () => {
    for (const { from, to, i, j } of pares) {
      if (i === j) continue;
      expect(stepDirection(from, to)).toBe(-stepDirection(to, from));
    }
  });
});

describe('FR-024 · sem etapa anterior não há troca, e sem troca não há movimento', () => {
  it.each(WIZARD_STEPS)('`from` nulo em %s devolve 0', (to) => {
    /*
      Recarregar a página, voltar do retorno de autorização ou restaurar um
      rascunho **não é uma troca**. `0` é o que faz `initial={false}` valer na
      prática — é o precedente que `CrossFade` já estabeleceu
      (contracts/surfaces.md §1.6).
    */
    expect(stepDirection(null, to)).toBe(0);
  });

  it.each(WIZARD_STEPS)('a mesma etapa dos dois lados devolve 0 em %s', (etapa) => {
    expect(stepDirection(etapa, etapa)).toBe(0);
  });
});
