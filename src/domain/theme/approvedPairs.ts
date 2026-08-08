/**
 * A lista fechada de pares de cor aprovados (FR-027, FR-030).
 *
 * **Combinação que não está aqui é proibida em qualquer componente**, no mesmo
 * espírito da tabela de hosts do Princípio II. É essa fechadura que torna a
 * verificação de contraste exaustiva: sem ela, o portão só cobriria os pares que
 * alguém lembrou de escrever, e a omissão passaria como aprovação.
 *
 * O módulo declara **nomes**, nunca valores. Os hex vivem uma única vez, em
 * `src/styles/tokens.css`; `tests/unit/contrast.spec.ts` os lê de lá e resolve os
 * nomes nos dois temas. Repetir os valores aqui criaria a segunda cópia que o
 * FR-036 existe para impedir — e a cópia que diverge em silêncio é exatamente a
 * que o teste não pegaria, porque estaria medindo a si mesma.
 */

import type { ContrastUsage } from './contrast';

/** Os 14 tokens de cor de `contracts/tokens.md` §1. */
export type TokenName =
  | '--bg'
  | '--surface'
  | '--surface-raised'
  | '--rule'
  | '--rule-strong'
  | '--ink'
  | '--ink-muted'
  | '--accent'
  | '--accent-deep'
  | '--accent-ink'
  | '--accent-text'
  | '--state-confident'
  | '--state-uncertain'
  | '--state-missing';

export interface ApprovedPair {
  /** Tinta. */
  readonly foreground: TokenName;
  /** Substrato. Precisa ser opaco. */
  readonly background: TokenName;
  /** Define o mínimo: `text` = 4,5:1 · `large-text` = 3:1 · `ui` = 3:1. */
  readonly usage: ContrastUsage;
  /** Onde a combinação aparece. Alimenta o guia de estilo (FR-027). */
  readonly where: string;
}

export const APPROVED_PAIRS: readonly ApprovedPair[] = [
  {
    foreground: '--ink',
    background: '--bg',
    usage: 'text',
    where: 'Texto corrido da página',
  },
  {
    foreground: '--ink',
    background: '--surface',
    usage: 'text',
    where: 'Texto dentro de cartão',
  },
  {
    foreground: '--ink-muted',
    background: '--bg',
    usage: 'text',
    where: 'Meta, legenda, texto de ajuda',
  },
  {
    foreground: '--ink-muted',
    background: '--surface',
    usage: 'text',
    where: 'Meta dentro de cartão',
  },
  {
    foreground: '--accent-ink',
    background: '--accent',
    usage: 'text',
    where: 'Rótulo do botão primário',
  },
  {
    foreground: '--accent-ink',
    background: '--accent-deep',
    usage: 'text',
    where: 'Botão primário em hover',
  },
  {
    foreground: '--accent-text',
    background: '--bg',
    usage: 'text',
    where: 'Link e numeral da goteira',
  },
  {
    foreground: '--accent-text',
    background: '--surface',
    usage: 'text',
    where: 'Link dentro de cartão',
  },
  {
    foreground: '--accent-text',
    background: '--bg',
    usage: 'ui',
    where: 'Anel de foco',
  },
  {
    foreground: '--state-confident',
    background: '--surface',
    usage: 'text',
    where: 'Selo "confiante"',
  },
  {
    foreground: '--state-uncertain',
    background: '--surface',
    usage: 'text',
    where: 'Selo "incerta"',
  },
  {
    foreground: '--state-missing',
    background: '--surface',
    usage: 'text',
    where: 'Selo "não encontrada" e mensagem de erro',
  },
  // As três superfícies em que um controle pode pousar. Declaradas
  // separadamente porque a mais exigente não é a mesma nos dois temas: no claro
  // é `--surface-raised` (o fundo mais escuro sob uma borda escura), no escuro é
  // `--surface-raised` de novo, mas agora por ser o mais claro sob uma borda
  // clara. Declarar só o par contra `--bg` deixaria de fora justamente o caso
  // estreito — campo em foco, que troca o fundo para `--surface-raised`.
  {
    foreground: '--rule-strong',
    background: '--bg',
    usage: 'ui',
    where: 'Borda de controle e contorno de capa de álbum, sobre a página',
  },
  {
    foreground: '--rule-strong',
    background: '--surface',
    usage: 'ui',
    where: 'Borda de controle dentro de cartão',
  },
  {
    foreground: '--rule-strong',
    background: '--surface-raised',
    usage: 'ui',
    where: 'Borda de campo em foco e de linha alternada',
  },
] as const;

/**
 * Quantidade declarada em `contracts/tokens.md` §2.
 *
 * Existe para que apagar uma linha da lista seja uma falha de teste e não um
 * silêncio. Uma lista fechada que encolhe sem aviso não é fechada.
 */
export const APPROVED_PAIR_COUNT = 15;

/** Os dois temas em que todo par é verificado (FR-031). */
export const THEMES = ['light', 'dark'] as const;

export type ThemeName = (typeof THEMES)[number];
