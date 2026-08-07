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

/**
 * Prefixos de numeração: `1.`, `1)`, `-`, `–`, `•`, `*`.
 *
 * O marcador pode terminar em espaço **ou no fim da linha**. Sem a segunda
 * alternativa, `3.` sozinho — detrito de lista numerada, não música — sobraria
 * como o termo `3` e a linha seria considerada buscável (`003/data-model §1`).
 * A alternativa `$` só alcança linhas que são **apenas** o marcador.
 */
const NUMBERING_PREFIX = /^\s*(?:\d+\s*[.)\-–—]|[-–—•*])(?:\s+|$)/u;

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

// ---------------------------------------------------------------------------
// Comparação por conjunto de termos (003/research §3)
// ---------------------------------------------------------------------------

/** Termos normalizados e **sem repetição**, na ordem de primeira aparição. */
export function tokenSet(input: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const token of tokenize(input)) {
    if (seen.has(token)) continue;
    seen.add(token);
    result.push(token);
  }
  return result;
}

/** Limiar de igualdade tolerante entre dois termos (`003/contracts §2`). */
export const TOKEN_MATCH_RATIO = 0.85;

/**
 * Igualdade tolerante a erro de digitação.
 *
 * A comparação por conjunto sozinha perderia `bohemain` contra `bohemian` — o
 * tipo de erro que a medida de Levenshtein da 001 já absorvia. Reintroduzi-la
 * aqui é o que impede a forma livre de ser **mais** frágil que a explícita.
 */
export function tokensMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return true;
  // Termos muito curtos não toleram erro: `de` e `da` distam 1 e virariam o
  // mesmo termo, inflando a cobertura de qualquer linha em português.
  if (longest <= 3) return false;
  return distance(a, b) / longest <= 1 - TOKEN_MATCH_RATIO;
}

/** Levenshtein local — `scoring/` importaria `normalize/`, nunca o inverso. */
function distance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  let current = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        (current[j - 1] ?? 0) + 1,
        (previous[j] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
    }
    [previous, current] = [current, previous];
  }

  return previous[b.length] ?? 0;
}

/**
 * `|A ∩ B| / |A|` com igualdade tolerante — **assimétrica de propósito**.
 *
 * `coverage(L, T)` mede quanto de `L` está em `T`, e não o contrário. É essa
 * assimetria que permite a FR-013 valer literalmente: os termos do artista que a
 * linha não escreveu simplesmente não entram em `L`, então não podem pesar
 * contra ela. Uma medida simétrica (Jaccard) puniria a ausência.
 *
 * `0` quando `subject` é vazio: não há o que cobrir, e devolver `1` faria uma
 * linha sem termos casar com tudo.
 */
export function coverage(subject: readonly string[], against: readonly string[]): number {
  if (subject.length === 0) return 0;
  let hits = 0;
  for (const token of subject) {
    if (against.some((other) => tokensMatch(token, other))) hits += 1;
  }
  return hits / subject.length;
}
