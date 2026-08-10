/**
 * A lista fechada de pares de cor aprovados (FR-002, SC-002).
 *
 * **Combinação que não está aqui é proibida em qualquer componente**, no mesmo
 * espírito da tabela de hosts do Princípio II. É essa fechadura que torna a
 * verificação de contraste exaustiva: sem ela, o portão só cobriria os pares que
 * alguém lembrou de escrever, e a omissão passaria como aprovação.
 *
 * O módulo declara **nomes**, nunca valores. Os hex vivem uma única vez, em
 * `src/styles/tokens.css`; `tests/unit/contrast.spec.ts` os lê de lá e resolve os
 * nomes nos dois temas. Repetir os valores aqui criaria a segunda cópia que a
 * disciplina de token existe para impedir — e a cópia que diverge em silêncio é
 * exatamente a que o teste não pegaria, porque estaria medindo a si mesma.
 *
 * A lista cresceu de 15 (feature 005) para 27 combinações na 007, e para 29 na
 * 008. O crescimento não vem de cores novas: vem de **substratos** novos. Texto
 * e ícone sobre `--surface-zone` — a barra superior e a trilha de etapas — são
 * combinações que não existiam antes de a casca de três zonas existir; os dois
 * últimos são o glifo da marca sobre o substrato tingido da própria marca, que
 * é onde a intuição erra e por isso precisa ser medido (008/research §R4).
 */

import type { ContrastUsage } from './contrast';

/** Os 19 tokens de cor: os 18 de `contracts/tokens.md` §1 mais `--accent-tint-ink`. */
export type TokenName =
  | '--bg'
  | '--surface-zone'
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
  | '--accent-tint-ink'
  | '--state-confident'
  | '--state-uncertain'
  | '--state-missing'
  | '--state-live'
  | '--brand-spotify'
  | '--brand-youtube';

/**
 * Tokens **derivados** por `color-mix`, e não declarados por tema (008/FR-003).
 *
 * Ficam fora de `COLOR_TOKENS` de propósito: aquela lista existe para exigir que
 * todo token de cor esteja declarado nos **dois** temas, e um derivado é
 * declarado uma vez só, fora dos blocos de tema — a cor da marca e a quantidade
 * de tinta já chegam a ele com o valor do tema em vigor. Exigir a declaração
 * dupla de um derivado seria pedir a duplicação que derivar existe para evitar.
 *
 * Podem aparecer como **substrato** de um par aprovado. Nunca como tinta: uma
 * mistura translúcida da própria cor do glifo não é tinta de nada.
 * `tests/unit/contrast.spec.ts` resolve o valor reproduzindo a mistura em sRGB a
 * partir dos mesmos hex lidos de `tokens.css`.
 */
export type DerivedTokenName = '--accent-tint' | '--brand-tint-spotify' | '--brand-tint-youtube';

/** A receita de cada derivado, na forma que o teste de contraste consome. */
export interface DerivedTokenRecipe {
  /** Cor que entra na mistura. */
  readonly source: TokenName;
  /** Nome da propriedade que carrega a proporção, lida de `tokens.css`. */
  readonly amount: string;
  /** Substrato sobre o qual a mistura acontece. */
  readonly over: TokenName;
}

export const DERIVED_TOKENS: Readonly<Record<DerivedTokenName, DerivedTokenRecipe>> = {
  /**
   * O âmbar tingido. Entrou na lista na fidelidade de design da 008, e a entrada
   * corrige uma omissão: ele já era substrato de texto — o aviso do painel de
   * ordem de execução — **sem nunca ter sido medido**, que é precisamente o
   * buraco que uma lista fechada existe para não ter.
   *
   * Mistura sobre `--surface-zone`, e não sobre `--surface`, porque foi assim
   * que nasceu: o disco da etapa atual da trilha vive sobre o substrato da zona.
   */
  '--accent-tint': {
    source: '--accent',
    amount: '--state-tint-amount',
    over: '--surface-zone',
  },
  '--brand-tint-spotify': {
    source: '--brand-spotify',
    amount: '--brand-tint-amount',
    over: '--surface',
  },
  '--brand-tint-youtube': {
    source: '--brand-youtube',
    amount: '--brand-tint-amount',
    over: '--surface',
  },
};

export interface ApprovedPair {
  /** Tinta. Sempre um token declarado — derivado nunca é tinta. */
  readonly foreground: TokenName;
  /** Substrato. Precisa ser opaco. */
  readonly background: TokenName | DerivedTokenName;
  /** Define o mínimo: `text` = 4,5:1 · `large-text` = 3:1 · `ui` = 3:1. */
  readonly usage: ContrastUsage;
  /** Onde a combinação aparece. Alimenta o guia de estilo (FR-043). */
  readonly where: string;
}

export const APPROVED_PAIRS: readonly ApprovedPair[] = [
  // --- Tinta principal sobre os quatro substratos -------------------------
  {
    foreground: '--ink',
    background: '--bg',
    usage: 'text',
    where: 'Texto corrido da área principal',
  },
  {
    foreground: '--ink',
    background: '--surface-zone',
    usage: 'text',
    where: 'Marca, título da trilha, nome de etapa',
  },
  {
    foreground: '--ink',
    background: '--surface',
    usage: 'text',
    where: 'Texto dentro de cartão',
  },
  {
    foreground: '--ink',
    background: '--surface-raised',
    usage: 'text',
    where: 'Texto em linha destacada',
  },

  // --- Tinta secundária sobre os quatro substratos -------------------------
  {
    foreground: '--ink-muted',
    background: '--bg',
    usage: 'text',
    where: 'Meta, legenda, texto de ajuda',
  },
  {
    foreground: '--ink-muted',
    background: '--surface-zone',
    usage: 'text',
    where: 'Linha de apoio da trilha, nome da etapa pendente',
  },
  {
    foreground: '--ink-muted',
    background: '--surface',
    usage: 'text',
    where: 'Meta dentro de cartão',
  },
  {
    foreground: '--ink-muted',
    background: '--surface-raised',
    usage: 'text',
    where: 'Meta em linha destacada',
  },

  // --- Âmbar de texto ------------------------------------------------------
  // `--accent` só existe como preenchimento (FR-022): 1,73:1 como texto sobre
  // qualquer substrato claro. Quem precisa de âmbar legível usa `--accent-text`.
  {
    foreground: '--accent-text',
    background: '--bg',
    usage: 'text',
    where: 'Link e texto de acento na área principal',
  },
  {
    foreground: '--accent-text',
    background: '--surface-zone',
    usage: 'text',
    where: 'Numeral da etapa atual, no disco tingido da trilha',
  },
  {
    foreground: '--accent-text',
    background: '--surface',
    usage: 'text',
    where: 'Link dentro de cartão',
  },

  // --- Âmbar de preenchimento ----------------------------------------------
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
    where: 'Rótulo do botão primário em hover e ativo',
  },

  // --- Aviso sobre âmbar tingido -------------------------------------------
  // O par que faltava. `--ink-muted` sobre `--accent-tint` passava no limiar e
  // ainda assim estava errado: o arquivo de design escreve o aviso numa tinta
  // **quente**, da família do substrato, e o cinza-azulado lia como texto caído
  // ali por engano. O ícone é `ui` porque é glifo, não palavra.
  {
    foreground: '--accent-tint-ink',
    background: '--accent-tint',
    usage: 'text',
    where: 'Aviso de execução em série, no painel de ordem de execução',
  },
  {
    foreground: '--accent-text',
    background: '--accent-tint',
    usage: 'ui',
    where: 'Glifo do aviso e numeral da etapa atual, sobre o disco tingido',
  },

  // --- Selos de estado, dentro e fora de cartão ----------------------------
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
    where: 'Selo "não encontrada" e mensagem de erro em cartão',
  },
  {
    foreground: '--state-confident',
    background: '--bg',
    usage: 'text',
    where: 'Selo "confiante" fora de cartão',
  },
  {
    foreground: '--state-uncertain',
    background: '--bg',
    usage: 'text',
    where: 'Selo "incerta" fora de cartão',
  },
  {
    foreground: '--state-missing',
    background: '--bg',
    usage: 'text',
    where: 'Mensagem de erro na página',
  },

  // --- Estado e marca no chip de conexão -----------------------------------
  // Todos `ui`: são ponto, ícone e filete, nunca texto. `--brand-*` como texto é
  // proibido por FR-023, e a proibição tem base medida — `#ff3b30` sobre
  // `--surface-raised` dá 4,29:1 e reprovaria.
  {
    foreground: '--state-live',
    background: '--surface-zone',
    usage: 'ui',
    where: 'Ponto de sessão viva no chip de conexão',
  },
  {
    foreground: '--brand-spotify',
    background: '--surface-zone',
    usage: 'ui',
    where: 'Ícone do provedor no chip da barra superior',
  },
  {
    foreground: '--brand-youtube',
    background: '--surface-zone',
    usage: 'ui',
    where: 'Ícone do provedor no chip da barra superior',
  },
  {
    foreground: '--brand-spotify',
    background: '--surface',
    usage: 'ui',
    where: 'Ícone do provedor no cartão de destino',
  },
  {
    foreground: '--brand-youtube',
    background: '--surface',
    usage: 'ui',
    where: 'Ícone do provedor no cartão de destino',
  },

  // --- Glifo da marca sobre o substrato de identidade (008/FR-003) ----------
  // Os dois pares que a intuição erraria: o tingimento aproxima o fundo da
  // própria cor do glifo, e é justamente o caso em que "12% não muda nada"
  // deixa de ser verdade. Os `--state-*-tint` nunca precisaram desta medição
  // porque ali o par medido é texto-sobre-`--surface`; aqui o glifo inteiro
  // fica sobre a mistura (008/research §R4).
  {
    foreground: '--brand-spotify',
    background: '--brand-tint-spotify',
    usage: 'ui',
    where: 'Glifo do provedor no distintivo do cartão de destino',
  },
  {
    foreground: '--brand-youtube',
    background: '--brand-tint-youtube',
    usage: 'ui',
    where: 'Glifo do provedor no distintivo do cartão de destino',
  },

  // --- Contorno significante -----------------------------------------------
  // `--rule` não entra: `#252d3a` sobre `--bg` dá 1,37:1. É filete decorativo.
  // Tudo que carregue significado — contorno de controle, borda de imagem de
  // terceiro, divisor de zona — usa `--rule-strong`.
  {
    foreground: '--rule-strong',
    background: '--bg',
    usage: 'ui',
    where: 'Contorno de controle sobre a área principal',
  },
  {
    foreground: '--rule-strong',
    background: '--surface',
    usage: 'ui',
    where: 'Contorno de campo e borda de capa de álbum, dentro de cartão',
  },
  {
    foreground: '--rule-strong',
    background: '--surface-zone',
    usage: 'ui',
    where: 'Divisor significante da barra superior e contorno do disco pendente',
  },
] as const;

/**
 * Quantidade declarada em `contracts/tokens.md` §2.
 *
 * Existe para que apagar uma linha da lista seja uma falha de teste e não um
 * silêncio. Uma lista fechada que encolhe sem aviso não é fechada.
 */
export const APPROVED_PAIR_COUNT = 31;

/**
 * Todo token de cor declarado em `contracts/tokens.md` §1.
 *
 * A lista de pares não cobre sozinha o SC-005: um token pode existir sem par
 * aprovado — `--rule` é filete decorativo e nunca é frente nem substrato de
 * combinação medida — e ainda assim precisa existir nos **dois** temas. Sem esta
 * segunda lista, um token declarado só no claro passaria despercebido.
 */
export const COLOR_TOKENS: readonly TokenName[] = [
  '--bg',
  '--surface-zone',
  '--surface',
  '--surface-raised',
  '--rule',
  '--rule-strong',
  '--ink',
  '--ink-muted',
  '--accent',
  '--accent-deep',
  '--accent-ink',
  '--accent-text',
  '--accent-tint-ink',
  '--state-confident',
  '--state-uncertain',
  '--state-missing',
  '--state-live',
  '--brand-spotify',
  '--brand-youtube',
] as const;

/** Os dois temas em que todo par é verificado (SC-002). */
export const THEMES = ['light', 'dark'] as const;

export type ThemeName = (typeof THEMES)[number];
