/**
 * Pontuação de similaridade e classificação (research §6).
 *
 * `score = 0,6 × sim(título) + 0,4 × melhor sim(artista)`, com bônus por artista
 * secundário confirmado. `sim` combina duas medidas porque elas falham em
 * situações diferentes: Levenshtein perde quando as palavras vêm em outra ordem,
 * e Jaccard perde quando há erro de digitação dentro de uma palavra.
 */

import { coverage, normalizeText, tokenSet, tokenize } from '@/domain/normalize';
import type {
  AttentionReason,
  InputLine,
  ScoredStatus,
  TrackCandidateRaw,
  VersionHint,
} from '@/domain/types';

import {
  ARTIST_CLAIM_RATIO,
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

// ---------------------------------------------------------------------------
// Via da forma livre — cobertura combinada (003/research §3 e §4)
// ---------------------------------------------------------------------------

/** Termos da linha buscável: a linha inteira na forma livre, título + artista na explícita. */
function lineTokens(line: InputLine): string[] {
  return tokenSet(line.shape === 'free' ? line.title : `${line.title} ${line.artist}`);
}

/**
 * Comparação combinada por **cobertura assimétrica**, para a linha sem campos
 * declarados (`003/FR-013`, research §3).
 *
 * ```text
 * cL = |L ∩ (T ∪ A)| / |L|   quanto da linha a candidata explica
 * cT = |T ∩ L|       / |T|   quanto do título a linha reivindica
 *      2·cL·cT / (cL + cT)   média harmônica
 * ```
 *
 * As duas assimetrias são o ponto. `cL` não tem os termos do artista que a linha
 * não escreveu, então a ausência deles **não pesa contra ela** — que é FR-013
 * ao pé da letra. `cT` impede que `amor` case 1,0 com `Amor Perfeito`: a linha
 * não reivindicou metade do título.
 *
 * A média **harmônica**, e não a aritmética, porque ela zera quando qualquer
 * uma das coberturas zera. É o que descarta a linha que é só o nome do artista
 * (`cpm 22`: explica-se inteira, mas não reivindica nada do título) sem precisar
 * de regra especial para esse caso.
 */
export function scoreCombined(line: InputLine, track: TrackCandidateRaw): number {
  const lineSet = lineTokens(line);
  const titleSet = tokenSet(track.title);
  const artistSet = tokenSet(track.artists.join(' '));

  if (lineSet.length === 0 || titleSet.length === 0) return 0;

  const lineCoverage = coverage(lineSet, [...titleSet, ...artistSet]);
  const titleCoverage = coverage(titleSet, lineSet);

  if (lineCoverage === 0 || titleCoverage === 0) return 0;
  return (2 * lineCoverage * titleCoverage) / (lineCoverage + titleCoverage);
}

/**
 * A linha reivindicou o artista **desta** candidata? (`003/research §4`)
 *
 * Decidido a partir dos dados, e não declarado pelo usuário — que é a única
 * forma possível: sem separador não há como saber de antemão se o artista está
 * na linha. Quando a melhor candidata tem o artista reivindicado, a linha é
 * tratada como se o tivesse declarado, e a regra de margem não se aplica.
 *
 * É o que distingue os dois exemplos do pedido sem separador algum:
 * `nao sei viver sem ter voce cpm 22` confirma `CPM 22` e ganha o tratamento de
 * uma linha explícita; `Não sei viver sem ter voce` não confirma nada e entra na
 * regra de margem.
 */
export function artistClaimed(line: InputLine, track: Pick<TrackCandidateRaw, 'artists'>): boolean {
  const artistSet = tokenSet(track.artists.join(' '));
  if (artistSet.length === 0) return false;
  return coverage(artistSet, lineTokens(line)) >= ARTIST_CLAIM_RATIO;
}

/**
 * Pontuação final da candidata, escolhida pela **forma** da linha.
 *
 * - `explicit` mantém `0,6·título + 0,4·artista`, byte a byte como na 001. É o
 *   que SC-011 exige: zero mudanças de classe no formato explícito.
 * - `free` usa a cobertura combinada de §3.
 *
 * **Reparo de falso corte** (`003/research §7`): uma linha `explicit` cuja
 * pontuação fica **abaixo do piso** é reavaliada pela comparação combinada sobre
 * a linha inteira, e prevalece a maior das duas. `Marília Mendonça - Ao Vivo` é
 * cortada em título `Marília Mendonça` e artista `Ao Vivo`; pela via declarada a
 * candidata certa pontua mal, porque o "título" comparado é o nome da artista.
 *
 * O reparo é restrito à faixa abaixo do piso de propósito: aplicá-lo sempre
 * mudaria a pontuação de linhas hoje corretamente classificadas, e a exigência é
 * zero mudanças de classe. Restringindo-o, só linhas hoje **perdidas** podem
 * mudar de classe — e para melhor. Custo em rede: zero.
 */
export function scoreForShape(
  line: InputLine,
  track: TrackCandidateRaw,
  uncertainThreshold: number,
): number {
  if (line.shape === 'free') return scoreCombined(line, track);

  const declared = scoreCandidate(line, track);
  if (declared >= uncertainThreshold) return declared;
  return Math.max(declared, scoreCombined(line, track));
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

// ---------------------------------------------------------------------------
// Classificação da linha inteira, com margem (003/contracts/domain-api.md §3)
// ---------------------------------------------------------------------------

export interface SoloThresholds {
  confident: number;
  uncertain: number;
  soloMargin: number;
}

export interface LineClassification {
  status: ScoredStatus;
  attentionReason: AttentionReason | null;
}

/**
 * Precedência fixa de `003/data-model §3` (invariante M3).
 *
 * Sem ordem declarada, o motivo exibido dependeria da ordem de avaliação e o
 * teste seria frágil. A ordem também não é arbitrária: ela vai da causa que o
 * usuário menos consegue adivinhar para a que ele mais consegue.
 */
const REASON_PRECEDENCE: readonly AttentionReason[] = [
  'retry_skipped_quota',
  'not_found',
  'version_hint',
  'no_artist_ambiguous',
];

function highestPrecedence(reasons: readonly AttentionReason[]): AttentionReason | null {
  return REASON_PRECEDENCE.find((reason) => reasons.includes(reason)) ?? null;
}

/**
 * Classifica uma linha **inteira**, a partir das candidatas já ordenadas.
 *
 * Substitui `classifyFor` como ponto de entrada do runner por um motivo
 * estrutural: a regra de margem exige conhecer a **segunda** candidata, e uma
 * função de pontuação isolada só vê uma por vez.
 *
 * As seis regras do contrato, na ordem em que o código as aplica:
 *
 * 1. sem candidata → `not_found`;
 * 2. `hasDeclaredArtist` = explícita com artista **ou** livre cujo artista a
 *    melhor candidata teve reivindicado (§4);
 * 3. com artista declarado → comportamento idêntico ao de hoje;
 * 4. sem artista declarado → `confident` exige limiar **e** margem; candidata
 *    única vira `uncertain` (FR-014b), porque não há segunda contra a qual medir;
 * 5. **nos dois ramos**, qualquer indício de versão rebaixa `confident` para
 *    `uncertain` (invariante K2, FR-015). Um indício em linha sem artista
 *    declarado é, se algo, mais grave: não há artista para desempatar entre a
 *    gravação oficial e o cover;
 * 6. o motivo de atenção segue a precedência M3.
 *
 * `retryPending` diz que havia retentativa a fazer e a reserva de cota acabou.
 * O `status` continua sendo `not_found`, mas a **causa** muda o que o usuário
 * deve fazer: a linha pode estar certa e o app é que desistiu (research §10).
 */
export function classifyLine(
  line: InputLine,
  candidates: readonly { score: number; versionHints?: VersionHint[]; artists: string[] }[],
  thresholds: SoloThresholds,
  retryPending = false,
): LineClassification {
  const best = candidates[0];

  if (best === undefined) {
    return {
      status: 'not_found',
      attentionReason: retryPending ? 'retry_skipped_quota' : 'not_found',
    };
  }

  const hints = best.versionHints ?? [];
  const hasDeclaredArtist =
    line.shape === 'explicit'
      ? line.artist !== ''
      : artistClaimed(line, best);

  const meetsThreshold = best.score >= thresholds.confident;
  const second = candidates[1];

  // Regra 4: sem artista declarado, passar o limiar não basta — a melhor
  // precisa se destacar da segunda. Candidata única não tem de quê se destacar.
  const meetsMargin =
    hasDeclaredArtist ||
    (second !== undefined && best.score - second.score >= thresholds.soloMargin);

  let status: ScoredStatus;
  if (meetsThreshold && meetsMargin) status = 'confident';
  else if (best.score >= thresholds.uncertain) status = 'uncertain';
  else status = 'not_found';

  // Regra 5: o indício de versão rebaixa nos **dois** ramos.
  if (status === 'confident' && hints.length > 0) status = 'uncertain';

  if (status === 'confident') return { status, attentionReason: null };

  const reasons: AttentionReason[] = [];
  if (retryPending) reasons.push('retry_skipped_quota');
  if (status === 'not_found') reasons.push('not_found');
  if (hints.length > 0) reasons.push('version_hint');
  if (!hasDeclaredArtist) reasons.push('no_artist_ambiguous');

  return { status, attentionReason: highestPrecedence(reasons) };
}

export {
  SPOTIFY_CONFIDENT_THRESHOLD,
  YOUTUBE_CONFIDENT_THRESHOLD,
  UNCERTAIN_THRESHOLD,
} from './thresholds';
