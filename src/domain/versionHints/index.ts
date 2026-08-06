/**
 * Indícios de que a candidata é **outra versão** da faixa (FR-025, research §8).
 *
 * O ponto é o que este módulo *não* faz: ele não decide por ninguém. FR-025 pede
 * que o indício esteja à vista na hora da decisão. O efeito colateral — rebaixar
 * `confident` para `uncertain` — existe porque a pontuação sozinha não distingue
 * "é a faixa" de "é outra versão da faixa": uma gravação ao vivo do artista certo
 * pontua alto justamente por ser do artista certo.
 *
 * Dois sinais independentes:
 *
 * - **léxico no título**, com fronteira de palavra e sem sensibilidade a acento
 *   ou caixa — "Livermore" não pode virar `live`;
 * - **duração destoante**, mais de 25% de desvio da mediana das candidatas
 *   daquela linha. Pega versão estendida, trecho e vídeo com introdução longa
 *   sem depender de palavra-chave.
 *
 * A mediana vem das **próprias candidatas** da linha. Usar a duração da faixa do
 * Spotify seria propagar escolha entre serviços, o que FR-014 proíbe.
 */

import type { VersionHint } from '@/domain/types';

/** Desvio a partir do qual a duração é considerada destoante. */
export const DURATION_OUTLIER_RATIO = 0.25;

/** Normaliza para comparação: sem acento, sem caixa, espaços colapsados. */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/gu, ' ')
    .trim();
}

/**
 * Padrões por indício, já normalizados. `\w*` marca prefixo produtivo
 * (`acustic` cobre "acústica" e "acoustic"; `remaster` cobre "remasterizado").
 */
const LEXICON: readonly { hint: VersionHint; pattern: RegExp }[] = [
  { hint: 'live', pattern: /\b(ao vivo|live|en vivo|no palco)\b/u },
  { hint: 'cover', pattern: /\b(cover|covered by|versao de)\b/u },
  { hint: 'remix', pattern: /\b(remix|remixed|rmx)\b/u },
  { hint: 'acoustic', pattern: /\b(acoustic\w*|acustic\w*|unplugged)\b/u },
  { hint: 'karaoke', pattern: /\b(karaoke|playback)\b/u },
  { hint: 'instrumental', pattern: /\b(instrumental|backing track)\b/u },
  { hint: 'sped_up', pattern: /\b(sped up|speed up|spedup|acelerad\w+)\b/u },
  { hint: 'slowed', pattern: /\b(slowed|reverb|desacelerad\w+)\b/u },
  { hint: 'nightcore', pattern: /\b(nightcore|8d)\b/u },
  { hint: 'mashup', pattern: /\b(mashup|mash up)\b/u },
  { hint: 'tribute', pattern: /\b(tributo|tribute)\b/u },
  { hint: 'remaster', pattern: /\b(remaster\w*)\b/u },
  { hint: 'excerpt', pattern: /\b(trecho|snippet|preview|teaser|part[e]? \d+)\b/u },
  { hint: 'reaction', pattern: /\b(reaction|reacao|reagindo|tutorial|analise)\b/u },
];

/**
 * Decorações **editoriais** removidas antes de pontuar (research §7).
 *
 * A lista é deliberadamente curta e específica: só sai o que não muda a
 * identidade da gravação. `(Live at Wembley)` e `(Karaoke Version)` **ficam** —
 * removê-los faria o karaokê pontuar igual à faixa certa, que é o erro caro do
 * catálogo de vídeo.
 */
const EDITORIAL_CONTENT =
  /^(the\s+)?(official\s+)?(music\s+)?(video|audio|visualizer|lyrics?|lyrics?\s+video|clipe\s+oficial|video\s+oficial|audio\s+oficial|videoclipe|mv|hd|hq|full\s+hd|4k|1080p|720p|official)$/u;

const TRAILING_TAG =
  /\s*\|\s*(official\s+)?(music\s+)?(video|audio|lyrics?( video)?|hd|hq|4k|1080p|720p)\s*$/giu;

/** Faixa de emojis e símbolos pictográficos. */
const EMOJI = /[\p{Extended_Pictographic}\p{Emoji_Presentation}]/gu;

function stripBracketed(title: string): string {
  // Um passo por vez, para que `(Official Video) (HD)` saia inteiro.
  return title.replace(/[([]([^()[\]]*)[)\]]/gu, (match, inner: string) =>
    EDITORIAL_CONTENT.test(normalize(inner)) ? ' ' : match,
  );
}

/**
 * Limpa decorações de título antes de pontuar. **Idempotente**: aplicar duas
 * vezes dá o mesmo resultado que aplicar uma.
 */
export function stripDecorations(title: string): string {
  return stripBracketed(title)
    .replace(TRAILING_TAG, ' ')
    .replace(EMOJI, ' ')
    .replace(/\s*[-–—]\s*$/u, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function lexicalHints(title: string): VersionHint[] {
  const normalized = normalize(title);
  const hints: VersionHint[] = [];
  for (const { hint, pattern } of LEXICON) {
    if (pattern.test(normalized)) hints.push(hint);
  }
  return hints;
}

export function median(values: number[]): number {
  const usable = values.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (usable.length === 0) return 0;
  const middle = Math.floor(usable.length / 2);
  if (usable.length % 2 === 1) return usable[middle] as number;
  return (((usable[middle - 1] as number) + (usable[middle] as number)) / 2);
}

/** `['duration_outlier']` quando o desvio passa de 25% da mediana. */
export function durationHint(durationMs: number, medianMs: number): VersionHint[] {
  if (medianMs <= 0 || !Number.isFinite(durationMs) || durationMs <= 0) return [];
  const deviation = Math.abs(durationMs - medianMs) / medianMs;
  return deviation > DURATION_OUTLIER_RATIO ? ['duration_outlier'] : [];
}

/** Todos os indícios de uma candidata, sem repetição e em ordem estável. */
export function versionHints(
  title: string,
  durationMs: number,
  candidateDurations: number[],
): VersionHint[] {
  const lexical = lexicalHints(title);
  const duration = durationHint(durationMs, median(candidateDurations));
  return [...new Set([...lexical, ...duration])];
}
