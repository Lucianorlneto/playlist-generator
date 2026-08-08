/**
 * Razão de contraste WCAG 2.x entre duas cores.
 *
 * Função pura: sem DOM, sem `getComputedStyle`, sem I/O (Princípio III). É o que
 * permite ao portão do FR-030 rodar em teste unitário, sem renderizar nada, e ao
 * guia de estilo (FR-027) citar números **produzidos pelo cálculo** em vez de
 * repetidos à mão.
 *
 * Deliberadamente limitado a hex de 3, 6 ou 8 dígitos. Os valores normativos de
 * `src/styles/tokens.css` são todos hex, e aceitar `rgb()`, `oklch()` ou
 * `color-mix()` significaria embutir aqui um analisador de cor CSS — superfície
 * grande para resolver um problema que ninguém tem. Entrada fora do formato é
 * erro, não caso a tratar em silêncio: um token digitado errado precisa
 * reprovar, não passar com 21:1.
 */

/** Componentes sRGB de 0 a 255, com alfa de 0 a 1. */
export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/iu;

/**
 * Converte hex em componentes sRGB.
 *
 * @throws se o valor não for hex de 3, 6 ou 8 dígitos.
 */
export function parseHex(value: string): Rgb {
  const hex = value.trim();
  if (!HEX.test(hex)) {
    throw new Error(`Valor de cor não reconhecido: ${value}. Esperado hex de 3, 6 ou 8 dígitos.`);
  }

  const digits = hex.slice(1);
  const expanded =
    digits.length === 3
      ? digits
          .split('')
          .map((d) => d + d)
          .join('')
      : digits;

  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
    a: expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1,
  };
}

/**
 * Linearização de um canal sRGB, conforme a definição de luminância relativa
 * da WCAG 2.x. O joelho em `0,03928` e o expoente `2,4` são da especificação.
 */
function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Luminância relativa (0 = preto, 1 = branco), conforme WCAG 2.x. */
export function relativeLuminance(color: Rgb): number {
  return (
    0.2126 * linearize(color.r) + 0.7152 * linearize(color.g) + 0.0722 * linearize(color.b)
  );
}

/**
 * Compõe uma cor com alfa sobre um fundo opaco.
 *
 * A WCAG define contraste entre duas cores **opacas**. Um token translúcido —
 * os `--state-*-edge` são a cor do estado a 30% — não tem contraste próprio: ele
 * tem o contraste do que resulta de pousá-lo sobre o fundo real. Compor antes de
 * medir é o que impede o portão de aprovar um filete que, na tela, é quase
 * invisível.
 */
export function flatten(foreground: Rgb, background: Rgb): Rgb {
  if (foreground.a >= 1) return foreground;
  return {
    r: foreground.r * foreground.a + background.r * (1 - foreground.a),
    g: foreground.g * foreground.a + background.g * (1 - foreground.a),
    b: foreground.b * foreground.a + background.b * (1 - foreground.a),
    a: 1,
  };
}

/**
 * Razão de contraste entre frente e fundo, de 1:1 a 21:1.
 *
 * A frente é composta sobre o fundo quando tem alfa; o fundo precisa ser opaco,
 * porque medir contra um fundo translúcido exigiria saber o que há atrás dele —
 * informação que não existe neste nível.
 */
export function contrastRatio(foreground: string, background: string): number {
  const bg = parseHex(background);
  if (bg.a < 1) {
    throw new Error(`O fundo precisa ser opaco para medir contraste: ${background}`);
  }

  const fg = flatten(parseHex(foreground), bg);
  const lighter = Math.max(relativeLuminance(fg), relativeLuminance(bg));
  const darker = Math.min(relativeLuminance(fg), relativeLuminance(bg));

  return (lighter + 0.05) / (darker + 0.05);
}

/** Mínimos da WCAG 2.x por categoria de uso (contracts/tokens.md §2). */
export const CONTRAST_MINIMUM = {
  text: 4.5,
  'large-text': 3,
  ui: 3,
} as const;

export type ContrastUsage = keyof typeof CONTRAST_MINIMUM;

/** Arredonda para uma casa, como o guia de estilo publica. */
export function roundRatio(ratio: number): number {
  return Math.round(ratio * 10) / 10;
}
