/**
 * Análise do texto colado (FR-012 a FR-015).
 *
 * Determinística e **nunca lança**: uma linha irreconhecível vira
 * `parseStatus: 'unparsed'` e não interrompe o processamento das demais — o
 * usuário corrige aquela linha sem refazer o trabalho inteiro (FR-015, FR-016).
 */

import { removeNumberingPrefix, stripPromoSuffixes } from '@/domain/normalize';
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

export function parseLine(raw: string, index: number, id: string): InputLine {
  const working = removeNumberingPrefix(raw).trim();
  const separator = lastSeparator(working);

  if (separator === null) {
    return {
      id,
      index,
      raw,
      title: '',
      artist: '',
      featuredArtists: [],
      parseStatus: 'unparsed',
    };
  }

  const rawTitle = working.slice(0, separator.start).trim();
  const rawArtist = working.slice(separator.end).trim();

  if (rawTitle === '' || rawArtist === '') {
    return { id, index, raw, title: '', artist: '', featuredArtists: [], parseStatus: 'unparsed' };
  }

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
