import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { CURVA, DURACAO, DURACAO_MS, ESCALONAMENTO_MS } from '@/ui/motion/scale';

/**
 * A escala de movimento é finita, e as duas camadas concordam — FR-006, FR-007,
 * SC-003 (`010/contracts/motion-scale.md` §4).
 *
 * ## O molde é o de `no-secrets.spec.ts`
 *
 * Aquele teste confere a tabela de hosts contra o código e falha **tanto por
 * ausência quanto por excesso**. Aqui é a mesma disciplina aplicada ao tempo: a
 * duplicação entre `src/ui/motion/scale.ts` e o `@theme` de
 * `src/styles/index.css` é aceita **porque é verificada**, e o modo de falha que
 * interessa é o token que existe em só uma das camadas — o degrau que alguém
 * acrescentou ao TypeScript e esqueceu no CSS não quebra build nenhum, e o
 * `transition-colors` correspondente simplesmente herda outro tempo.
 *
 * ## Por que a origem é importada e o espelho é lido como texto
 *
 * A origem é importada porque é assim que as primitivas a consomem: se
 * `DURACAO.base` for derivado errado de `DURACAO_MS.base`, é o valor importado
 * que anima, e é ele que precisa ser conferido. O espelho é lido como texto
 * porque é assim que o navegador o consome — e porque o ESLint não lê `.css`,
 * de modo que esta é a única verificação que alcança aquela camada.
 */

const CSS = readFileSync(join(process.cwd(), 'src/styles/index.css'), 'utf8')
  // Comentários fora do caminho: o bloco da escala explica em prosa por que o
  // `--ease-out` do Tailwind foi descartado, e a prosa não é declaração.
  .replace(/\/\*[\s\S]*?\*\//gu, '');

/**
 * A escala de `contracts/motion-scale.md` §1, transcrita.
 *
 * Ela aparece aqui **em números literais** de propósito: um teste que derivasse
 * os valores esperados do próprio `scale.ts` confirmaria apenas que o arquivo é
 * igual a si mesmo. Alterar um degrau custa editar o contrato, o código, o CSS
 * e esta tabela — que é a revisão que se quer forçar.
 */
const ESCALA_CONTRATADA = {
  duracoes: { quick: 120, base: 200, settle: 320, theme: 400, spin: 1000, pulse: 1200 },
  curvas: {
    standard: 'cubic-bezier(0, 0, 0.58, 1)',
    through: 'cubic-bezier(0.42, 0, 0.58, 1)',
    linear: 'linear',
  },
  escalonamento: { passo: 40, teto: 240 },
} as const;

/** Extrai os pares `nome → valor` de um espaço de nome do `@theme`. */
function tokensDoCss(prefixo: string): Record<string, string> {
  const encontrados: Record<string, string> = {};
  const padrao = new RegExp(`--${prefixo}-([a-z][a-z-]*)\\s*:\\s*([^;]+);`, 'gu');
  for (const [, nome, valor] of CSS.matchAll(padrao)) {
    if (nome === undefined || valor === undefined) continue;
    encontrados[nome] = valor.trim().replace(/\s+/gu, ' ');
  }
  return encontrados;
}

/** A curva da origem, na forma em que o CSS a escreve. */
function comoCss(curva: (typeof CURVA)[keyof typeof CURVA]): string {
  if (typeof curva === 'string') return curva;
  return `cubic-bezier(${curva.join(', ')})`;
}

describe('FR-006 · a escala tem exatamente os degraus do contrato', () => {
  it('as durações da origem são as contratadas, nem uma a mais', () => {
    expect(DURACAO_MS).toEqual(ESCALA_CONTRATADA.duracoes);
  });

  it('as curvas da origem são as três contratadas, nem uma a mais', () => {
    const emCss = Object.fromEntries(
      Object.entries(CURVA).map(([nome, valor]) => [nome, comoCss(valor)]),
    );
    expect(emCss).toEqual(ESCALA_CONTRATADA.curvas);
  });

  it('o escalonamento é o contratado', () => {
    expect(ESCALONAMENTO_MS).toEqual(ESCALA_CONTRATADA.escalonamento);
  });

  it('as durações em segundos são derivadas das em milissegundos', () => {
    /*
      A biblioteca consome segundos; o contrato e o CSS falam em milissegundos.
      A conversão é o único lugar em que os dois números da mesma duração
      convivem, e um erro aqui produziria um movimento mil vezes mais lento sem
      quebrar tipo nenhum.
    */
    for (const [nome, ms] of Object.entries(DURACAO_MS)) {
      expect(DURACAO[nome as keyof typeof DURACAO]).toBeCloseTo(ms / 1000, 10);
    }
    expect(Object.keys(DURACAO).sort()).toEqual(Object.keys(DURACAO_MS).sort());
  });
});

describe('FR-007 · `base` continua valendo 200ms', () => {
  it('o orçamento herdado não mudou', () => {
    /*
      Não é um degrau escolhido nesta feature: é o orçamento que
      `docs/style-guide.md` já fixava para o conector da trilha antes da 009, e
      que a fusão cruzada reaproveitou. Mudá-lo é mudar o tempo do sistema
      inteiro, e este teste é o que faz essa mudança ser deliberada.
    */
    expect(DURACAO_MS.base).toBe(200);
  });
});

describe('FR-006, SC-003 · TypeScript e CSS concordam, valor a valor', () => {
  const DURACOES_CSS = tokensDoCss('transition-duration');
  const CURVAS_CSS = tokensDoCss('ease');

  it('nenhuma duração existe em só uma das camadas', () => {
    expect(Object.keys(DURACOES_CSS).sort()).toEqual(Object.keys(DURACAO_MS).sort());
  });

  it('nenhuma curva existe em só uma das camadas', () => {
    expect(Object.keys(CURVAS_CSS).sort()).toEqual(Object.keys(CURVA).sort());
  });

  it('cada duração vale o mesmo nas duas camadas', () => {
    const esperado = Object.fromEntries(
      Object.entries(DURACAO_MS).map(([nome, ms]) => [nome, `${String(ms)}ms`]),
    );
    expect(DURACOES_CSS).toEqual(esperado);
  });

  it('cada curva vale o mesmo nas duas camadas', () => {
    const esperado = Object.fromEntries(
      Object.entries(CURVA).map(([nome, valor]) => [nome, comoCss(valor)]),
    );
    expect(CURVAS_CSS).toEqual(esperado);
  });

  it('a duração padrão de transição é `base`, e não os 150ms do Tailwind', () => {
    /*
      `transition-colors` de `Button`, `Toggle` e `ConnectionChip` herda daqui.
      Até esta feature herdava um valor que o sistema nunca escolheu e que não
      aparecia em documento nenhum (contracts/motion-scale.md §2).
    */
    const padrao = /--default-transition-duration\s*:\s*([^;]+);/u.exec(CSS);
    expect(padrao?.[1]?.trim()).toBe(`${String(DURACAO_MS.base)}ms`);
  });
});
