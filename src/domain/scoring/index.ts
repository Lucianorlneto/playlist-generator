/**
 * Pontuação de similaridade e classificação (research §6).
 *
 * `score = 0,6 × sim(título) + 0,4 × melhor sim(artista)`, com bônus por artista
 * secundário confirmado. `sim` combina duas medidas porque elas falham em
 * situações diferentes: Levenshtein perde quando as palavras vêm em outra ordem,
 * e Jaccard perde quando há erro de digitação dentro de uma palavra.
 */

import { normalizeText, tokenize } from '@/domain/normalize';
import type { InputLine, ScoredStatus, TrackCandidateRaw, VersionHint } from '@/domain/types';

import {
  ARTIST_WEIGHT,
  CHANNEL_TOPIC_BONUS,
  CHANNEL_VEVO_BONUS,
  FEATURED_BONUS,
  SPOTIFY_CONFIDENT_THRESHOLD,
  TITLE_WEIGHT,
  UNCERTAIN_THRESHOLD,
} from './thresholds';

export function levenshtein(a: string, b: string): number {
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

/** Razão de Levenshtein normalizada pelo comprimento do maior texto. */
export function levenshteinRatio(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 1;
  return 1 - levenshtein(a, b) / longest;
}

export function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const left = new Set(a);
  const right = new Set(b);
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  const union = left.size + right.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Similaridade entre dois textos livres, já normalizados internamente. */
export function similarity(a: string, b: string): number {
  const normalizedA = normalizeText(a);
  const normalizedB = normalizeText(b);
  if (normalizedA === '' || normalizedB === '') return 0;
  return Math.max(levenshteinRatio(normalizedA, normalizedB), jaccard(tokenize(a), tokenize(b)));
}

/** Melhor similaridade entre o artista escrito e qualquer artista da faixa. */
export function bestArtistSimilarity(artist: string, trackArtists: string[]): number {
  if (trackArtists.length === 0) return 0;
  return Math.max(...trackArtists.map((candidate) => similarity(artist, candidate)));
}

export function scoreCandidate(line: InputLine, track: TrackCandidateRaw): number {
  const titleScore = similarity(line.title, track.title);
  const artistScore = bestArtistSimilarity(line.artist, track.artists);

  let score = TITLE_WEIGHT * titleScore + ARTIST_WEIGHT * artistScore;

  const featuredConfirmed = line.featuredArtists.some((featured) =>
    track.artists.some((candidate) => similarity(featured, candidate) >= 0.85),
  );
  if (featuredConfirmed) score += FEATURED_BONUS;

  return Math.min(1, Math.max(0, score));
}

/**
 * Bônus de canal canônico (research §7).
 *
 * A comparação ignora caixa e espaços de borda: canais escrevem ` - Topic` e
 * `VEVO` de forma razoavelmente consistente, mas não perfeitamente.
 */
export function channelBonus(channelTitle: string): number {
  const normalized = channelTitle.trim().toLowerCase();
  if (normalized.endsWith('- topic') || normalized.endsWith('-topic')) return CHANNEL_TOPIC_BONUS;
  if (normalized.endsWith('vevo')) return CHANNEL_VEVO_BONUS;
  return 0;
}

/**
 * Classificação com os limiares do provedor.
 *
 * **Invariante K2**: qualquer indício de versão diferente rebaixa `confident`
 * para `uncertain`, independentemente da pontuação (FR-025). Uma gravação ao
 * vivo do artista certo pontua alto justamente porque é do artista certo — a
 * pontuação sozinha não distingue "é a faixa" de "é outra versão da faixa".
 */
export function classifyFor(
  score: number,
  thresholds: { confident: number; uncertain: number },
  hints: readonly VersionHint[] = [],
): ScoredStatus {
  if (score >= thresholds.confident) return hints.length > 0 ? 'uncertain' : 'confident';
  if (score >= thresholds.uncertain) return 'uncertain';
  return 'not_found';
}

/** Classificação com os limiares do Spotify — mantida para os testes da 001. */
export function classify(score: number): ScoredStatus {
  return classifyFor(score, {
    confident: SPOTIFY_CONFIDENT_THRESHOLD,
    uncertain: UNCERTAIN_THRESHOLD,
  });
}

export {
  SPOTIFY_CONFIDENT_THRESHOLD,
  YOUTUBE_CONFIDENT_THRESHOLD,
  UNCERTAIN_THRESHOLD,
} from './thresholds';
