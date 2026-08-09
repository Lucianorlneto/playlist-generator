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
 * A lista cresceu de 15 (feature 005) para 27 combinações. O crescimento não vem
 * de cores novas: vem de **substratos** novos. Texto e ícone sobre
 * `--surface-zone` — a barra superior e a trilha de etapas — são combinações que
 * não existiam antes de a casca de três zonas existir.
 */

import type { ContrastUsage } from './contrast';

/** Os 18 tokens de cor de `contracts/tokens.md` §1. */
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
  | '--state-confident'
  | '--state-uncertain'
  | '--state-missing'
  | '--state-live'
  | '--brand-spotify'
  | '--brand-youtube';

export interface ApprovedPair {
  /** Tinta. */
  readonly foreground: TokenName;
  /** Substrato. Precisa ser opaco. */
  readonly background: TokenName;
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
export const APPROVED_PAIR_COUNT = 27;

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
