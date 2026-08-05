/**
 * Limiares de confiança (research §6).
 *
 * Arquivo próprio e deliberadamente minúsculo: os valores são **calibrados**
 * contra `tests/fixtures/reference-50.json` até satisfazerem SC-002, e a
 * calibração não deve exigir tocar na lógica de pontuação.
 *
 * - `0,82` tolera pontuação divergente, acento e um sufixo residual, mas rejeita
 *   título parecido de artista diferente — que é o erro caro.
 * - `0,55` marca o piso abaixo do qual o resultado é ruído: apresentá-lo como
 *   candidato só geraria trabalho de revisão.
 */

export const CONFIDENT_THRESHOLD = 0.82;
export const UNCERTAIN_THRESHOLD = 0.55;

/** Peso do título contra o do artista na pontuação combinada. */
export const TITLE_WEIGHT = 0.6;
export const ARTIST_WEIGHT = 0.4;

/** Bônus por artista secundário declarado com `feat.` confirmado na faixa. */
export const FEATURED_BONUS = 0.05;
