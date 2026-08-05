/**
 * Normalização de texto para comparação (research §6).
 *
 * O pipeline é aplicado dos dois lados — ao que o usuário escreveu e ao que o
 * catálogo devolveu — antes de qualquer comparação.
 *
 * A decisão que mais importa aqui é a do que **não** é ruído: `remix`, `live` /
 * `ao vivo`, `acoustic` e `remaster` são variantes de gravação e mudam a faixa.
 * Removê-los faria o app escolher a versão errada em silêncio, que é o pior erro
 * possível neste produto.
 */

/** Prefixos de numeração: `1.`, `1)`, `-`, `–`, `•`, `*`. */
const NUMBERING_PREFIX = /^\s*(?:\d+\s*[.)\-–—]|[-–—•*])\s+/u;

/**
 * Conteúdo entre parênteses ou colchetes que é ruído promocional. Cada padrão
 * casa o grupo **inteiro** — `(Remix)` e `(Ao Vivo)` não casam nenhum deles.
 */
const NOISE_GROUPS: readonly RegExp[] = [
  /^official\s+(?:music\s+)?video$/u,
  /^official\s+audio$/u,
  /^video\s+oficial$/u,
  /^clipe\s+oficial$/u,
  /^lyrics?$/u,
  /^lyrics?\s+video$/u,
  /^letra$/u,
  /^audio$/u,
  /^hd$/u,
  /^hq$/u,
  /^4k$/u,
  /^full\s+hd$/u,
];

/** Ruído solto no fim do título, sem parênteses: `... HD`, `... 4K`. */
const TRAILING_NOISE = /\s+(?:hd|hq|4k)\s*$/iu;

function isNoise(content: string): boolean {
  const probe = content.trim().toLowerCase();
  return NOISE_GROUPS.some((pattern) => pattern.test(probe));
}

/**
 * Remove grupos promocionais entre parênteses ou colchetes, preservando os que
 * carregam informação sobre a gravação.
 */
export function stripPromoSuffixes(title: string): string {
  const withoutGroups = title.replace(/[([]([^()[\]]*)[)\]]/gu, (match, content: string) =>
    isNoise(content) ? ' ' : match,
  );
  return withoutGroups
    .replace(TRAILING_NOISE, '')
    .replace(/\s{2,}/gu, ' ')
    .trim();
}

export function removeNumberingPrefix(line: string): string {
  return line.replace(NUMBERING_PREFIX, '');
}

export function removeDiacritics(input: string): string {
  return input.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

/**
 * Pipeline completo: sem acento, sem caixa, sem prefixo de numeração, sem ruído
 * promocional, sem pontuação e sem espaços múltiplos.
 */
export function normalizeText(input: string): string {
  const withoutPrefix = removeNumberingPrefix(input);
  const withoutPromo = stripPromoSuffixes(withoutPrefix);
  return removeDiacritics(withoutPromo)
    .toLocaleLowerCase('pt-BR')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s{2,}/gu, ' ')
    .trim();
}

export function tokenize(input: string): string[] {
  const normalized = normalizeText(input);
  return normalized === '' ? [] : normalized.split(' ');
}
