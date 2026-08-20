import { describe, expect, it } from 'vitest';

import { atrasoEscalonado, ESCALONAMENTO_MS } from '@/ui/motion/scale';

/**
 * O teto de defasagem — FR-013, SC-009 (`010/contracts/motion-scale.md` §1.2).
 *
 * **O teto é o requisito, não o passo.** O `stagger()` da biblioteca distribui
 * proporcionalmente e não tem teto: 120 linhas a 40ms fariam a última esperar
 * 4,8 segundos, e o SC-009 mede exatamente o contrário disso.
 */

/** O caso agudo é real: `search_done` despacha a lista inteira (research §R2). */
const LISTA_LONGA = 120;
const LISTA_CURTA = 8;

describe('FR-013, SC-009 · a defasagem tem teto', () => {
  it('a última de 120 espera o mesmo que a última de 8', () => {
    /*
      É a asserção que o SC-009 declara literalmente. Ela vale porque as duas
      listas saturam: 8 irmãos já passam do teto no sétimo, então a última de
      cada uma está no mesmo lugar da fórmula.
    */
    expect(atrasoEscalonado(LISTA_LONGA - 1)).toBe(atrasoEscalonado(LISTA_CURTA - 1));
  });

  it('e as duas valem 240ms', () => {
    const teto = ESCALONAMENTO_MS.teto / 1000;
    expect(atrasoEscalonado(LISTA_LONGA - 1)).toBeCloseTo(teto, 10);
    expect(atrasoEscalonado(LISTA_CURTA - 1)).toBeCloseTo(teto, 10);
    expect(ESCALONAMENTO_MS.teto).toBe(240);
  });

  it('abaixo do teto a defasagem é o passo vezes o índice', () => {
    // O primeiro irmão não espera; do segundo ao sexto o passo é linear.
    expect(atrasoEscalonado(0)).toBe(0);
    for (let i = 1; i <= 5; i += 1) {
      expect(atrasoEscalonado(i)).toBeCloseTo((i * ESCALONAMENTO_MS.passo) / 1000, 10);
    }
  });

  it('a saturação começa no sexto irmão, e não antes', () => {
    /*
      240 ÷ 40 = 6. O sexto índice é o primeiro a bater no teto, e daí em diante
      todos entram juntos — comportamento assumido e desejado: o papel do
      escalonamento é dar sequência à leitura das primeiras, não fazer alguém
      esperar a centésima vigésima (research §R7).
    */
    const primeiroSaturado = ESCALONAMENTO_MS.teto / ESCALONAMENTO_MS.passo;
    expect(atrasoEscalonado(primeiroSaturado - 1)).toBeLessThan(
      ESCALONAMENTO_MS.teto / 1000,
    );
    expect(atrasoEscalonado(primeiroSaturado)).toBeCloseTo(ESCALONAMENTO_MS.teto / 1000, 10);
  });

  it('um irmão só não espera nada — o papel degenera em entrada simples', () => {
    // É por isso que o aviso de recuperação de rascunho não custa entrada nova
    // no catálogo (FR-021b, contracts/motion-catalog.md §2.2).
    expect(atrasoEscalonado(0)).toBe(0);
  });
});
