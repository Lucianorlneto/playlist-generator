/**
 * Busca no catálogo de vídeos (contracts/youtube-api.md §3, research §7).
 *
 * Consulta de **texto livre**: a API de busca de vídeo não tem qualificadores de
 * campo, então a busca por campos que resolve o Spotify não é aplicável. Linha
 * `explicit` consulta `"{título} {artista}"`; linha `free` consulta a linha
 * inteira (`003/contracts/search-queries.md §1`).
 *
 * O fallback interno com o título isolado **saiu**. A segunda tentativa passou a
 * ser decisão do runner, e só é emitida quando a consulta alternativa difere de
 * fato da primeira (`003/research §6`) e há orçamento — cada busca custa 100
 * unidades, e repetir a mesma consulta não é retentativa.
 *
 * Duas traduções obrigatórias antes de qualquer pontuação:
 *
 * - **entidades HTML**: `snippet.title` chega com `&amp;` e `&#39;`. Pontuar sem
 *   decodificar penalizaria justamente os títulos com apóstrofo, que são comuns;
 * - **canal no lugar de artista**: `artists` recebe o nome do canal já sem os
 *   sufixos ` - Topic` e `VEVO`, enquanto `channel` guarda o nome original para
 *   exibição (FR-024). O bônus de canal canônico lê o original.
 */

import type { InputLine, TrackCandidateRaw } from '@/domain/types';
import { apiRequest } from '@/services/providers/http';

const PROVIDER = 'youtube' as const;

export const SEARCH_LIMIT = 5;

interface SearchResponse {
  items?: {
    id?: { videoId?: string };
    snippet?: {
      title?: string;
      channelTitle?: string;
      thumbnails?: { default?: { url?: string } };
    };
  }[];
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/** Decodifica as entidades que a API devolve. Puro: não usa DOM. */
export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/gu, (match, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (entity.startsWith('#')) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** Remove os sufixos de canal canônico para a comparação de artista. */
export function channelAsArtist(channelTitle: string): string {
  return channelTitle
    .replace(/\s*-\s*topic\s*$/iu, '')
    .replace(/vevo\s*$/iu, '')
    .trim();
}

export function toCandidate(item: NonNullable<SearchResponse['items']>[number]): TrackCandidateRaw | null {
  const videoId = item.id?.videoId;
  if (typeof videoId !== 'string' || videoId === '') return null;

  const title = decodeHtmlEntities(item.snippet?.title ?? '');
  const channel = decodeHtmlEntities(item.snippet?.channelTitle ?? '');

  return {
    // No YouTube a "URI" é o próprio `videoId` — é o que `playlistItems.insert`
    // recebe, e o que entra em `orderedUris`.
    uri: videoId,
    id: videoId,
    title,
    artists: channel === '' ? [] : [channelAsArtist(channel)],
    // Não há álbum no catálogo de vídeo, e a interface nunca o exibe quando
    // `showsAlbum` é falso (invariante K1).
    album: '',
    // Preenchida por `videos.list`: a busca não devolve duração (research §4).
    durationMs: 0,
    coverUrl: item.snippet?.thumbnails?.default?.url ?? null,
    externalUrl: `https://www.youtube.com/watch?v=${videoId}`,
    ...(channel === '' ? {} : { channel }),
  };
}

async function runSearch(query: string, signal?: AbortSignal): Promise<TrackCandidateRaw[]> {
  const response = await apiRequest<SearchResponse>(PROVIDER, '/youtube/v3/search', {
    params: { part: 'snippet', type: 'video', maxResults: SEARCH_LIMIT, q: query },
    operation: 'search',
    ...(signal === undefined ? {} : { signal }),
  });

  return (response.items ?? [])
    .map(toCandidate)
    .filter((candidate): candidate is TrackCandidateRaw => candidate !== null);
}

/** Consulta primária desta linha, decidida pela forma (contrato §1). */
export function primaryQuery(line: InputLine): string {
  return line.shape === 'explicit' ? `${line.title} ${line.artist}`.trim() : line.title.trim();
}

/**
 * Consulta alternativa: a linha inteira. Na maioria das linhas explícitas ela
 * normaliza para a **mesma** string da primária, e por isso `planQueries` a
 * descarta antes de custar unidade alguma (research §6).
 */
export function retryQuery(line: InputLine): string {
  return line.raw.trim();
}

/** Consulta **primária** da linha. Uma requisição, nunca duas (invariante O4). */
export async function searchVideo(
  line: InputLine,
  signal?: AbortSignal,
): Promise<TrackCandidateRaw[]> {
  const query = primaryQuery(line);
  if (query === '') return [];
  return runSearch(query, signal);
}

/** Consulta **alternativa**, emitida só quando o runner decide (`003/FR-009`). */
export async function retryVideo(
  line: InputLine,
  signal?: AbortSignal,
): Promise<TrackCandidateRaw[]> {
  const query = retryQuery(line);
  if (query === '') return [];
  return runSearch(query, signal);
}
