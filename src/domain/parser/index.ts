/**
 * Análise do texto colado (`001/FR-012` a `001/FR-015`, `003/FR-001` a
 * `003/FR-004`).
 *
 * Determinística e **nunca lança**.
 *
 * **O separador deixou de ser portão de admissão** (`003/research §1`). Ele
 * continua sendo o melhor sinal disponível — quem o escreve declara onde termina
 * o título e ganha a via de pontuação por campos —, mas a sua ausência não
 * reprova mais nada. A linha sem corte vira `shape: 'free'` e é consultada
 * inteira.
 *
 * Sobra um único gatilho de invalidez (invariante L2): `normalizeText(raw) === ''`,
 * isto é, a linha não tem caractere alfanumérico algum. `---`, `3.` e `🎵` não
 * são música e não podem custar uma requisição (`003/FR-011`).
 */

import { normalizeText, removeNumberingPrefix, stripPromoSuffixes } from '@/domain/normalize';
import type { InputLine } from '@/domain/types';

/**
 * Separadores reconhecidos (FR-013). O hífen e os travessões exigem espaço em
 * volta: sem essa exigência, "Jay-Z" e "Sun-El Musician" seriam partidos ao meio.
 */
const SEPARATORS = /\s+[-–—]\s+|\s+by\s+/giu;

/** `feat.`, `ft.` e — apenas entre parênteses/colchetes — `com`. */
const FEATURED_PARENTHESIZED = /[([]\s*(?:feat\.?|ft\.?|com|with)\s+([^)\]]+)[)\]]/giu;
const FEATURED_INLINE = /\s+(?:feat\.?|ft\.?)\s+([^([\-–—]+)/giu;

/** Divide uma lista de artistas: `A & B`, `A, B`, `A e B`, `A + B`. */
const ARTIST_SPLIT = /\s*(?:,|&|\+|\se\s|\sand\s)\s*/giu;

function splitArtists(value: string): string[] {
  return value
    .split(ARTIST_SPLIT)
    .map((part) => part.trim())
    .filter((part) => part !== '');
}

interface Extracted {
  text: string;
  featured: string[];
}

function extractFeatured(value: string): Extracted {
  const featured: string[] = [];

  let text = value.replace(FEATURED_PARENTHESIZED, (_match, names: string) => {
    featured.push(...splitArtists(names));
    return ' ';
  });

  text = text.replace(FEATURED_INLINE, (_match, names: string) => {
    featured.push(...splitArtists(names));
    return ' ';
  });

  return { text: text.replace(/\s{2,}/gu, ' ').trim(), featured };
}

/** Posição do **último** separador da linha (edge case `Song - Remix - Artist`). */
function lastSeparator(line: string): { start: number; end: number } | null {
  SEPARATORS.lastIndex = 0;
  let found: { start: number; end: number } | null = null;
  let match: RegExpExecArray | null;
  while ((match = SEPARATORS.exec(line)) !== null) {
    found = { start: match.index, end: match.index + match[0].length };
  }
  return found;
}

/**
 * Forma livre: a linha inteira vira o título, sem artista e sem _featured_.
 *
 * Não se extrai nada aqui de propósito (invariante L1). Extrair exigiria
 * adivinhar o corte que §1 recusa a adivinhar — e errar sistematicamente em
 * `Charlie Brown Jr`, `CPM 22` e `Nossa Senhora Aparecida`.
 */
function freeLine(raw: string, index: number, id: string, working: string): InputLine {
  const empty = normalizeText(raw) === '';
  return {
    id,
    index,
    raw,
    title: empty ? '' : working,
    artist: '',
    featuredArtists: [],
    shape: 'free',
    parseStatus: empty ? 'unparsed' : 'parsed',
  };
}

export function parseLine(raw: string, index: number, id: string): InputLine {
  const working = removeNumberingPrefix(raw).trim();

  // L2 primeiro, e sem exceção: `--- - ---` tem separador e dois lados não
  // vazios, mas não tem conteúdo. Deixar o corte decidir antes daria a essa
  // linha um `shape: 'explicit'` e uma consulta paga.
  if (normalizeText(raw) === '') return freeLine(raw, index, id, working);

  const separator = lastSeparator(working);

  if (separator === null) return freeLine(raw, index, id, working);

  const rawTitle = working.slice(0, separator.start).trim();
  const rawArtist = working.slice(separator.end).trim();

  // Corte com um lado vazio não declarou nada: `- Artista` é uma linha livre
  // cujo prefixo de numeração já foi removido, não uma linha inválida.
  if (rawTitle === '' || rawArtist === '') return freeLine(raw, index, id, working);

  const titleExtract = extractFeatured(rawTitle);
  const artistExtract = extractFeatured(rawArtist);

  // O artista principal é o primeiro da lista; os demais reforçam a pontuação,
  // nunca substituem o principal na busca (research §6).
  const artists = splitArtists(artistExtract.text);
  const [mainArtist = artistExtract.text, ...secondaryArtists] = artists;

  const featuredArtists = [
    ...titleExtract.featured,
    ...artistExtract.featured,
    ...secondaryArtists,
  ].filter((name, position, all) => all.indexOf(name) === position);

  return {
    id,
    index,
    raw,
    title: stripPromoSuffixes(titleExtract.text),
    artist: mainArtist,
    featuredArtists,
    shape: 'explicit',
    parseStatus: 'parsed',
  };
}

/**
 * Analisa o texto inteiro. Linhas vazias ou só com espaços são descartadas
 * **antes** da indexação, portanto não ocupam posição (FR-014).
 */
export function parseInput(rawText: string): InputLine[] {
  const lines = rawText.split(/\r?\n/u);
  const result: InputLine[] = [];

  for (const raw of lines) {
    if (raw.trim() === '') continue;
    const index = result.length;
    result.push(parseLine(raw, index, `l${index}`));
  }

  return result;
}
