/**
 * Busca no catálogo de vídeos (contracts/youtube-api.md §3, research §7).
 *
 * Consulta de **texto livre** `"{título} {artista}"`: a API de busca de vídeo
 * não tem qualificadores de campo, então a busca por campos que resolve o
 * Spotify não é aplicável. Zero resultados dispara **um** fallback com o título
 * isolado — e nada além disso, porque cada busca custa 100 unidades.
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

export async function searchVideo(
  line: InputLine,
  signal?: AbortSignal,
): Promise<TrackCandidateRaw[]> {
  const full = `${line.title} ${line.artist}`.trim();
  if (full !== '') {
    const found = await runSearch(full, signal);
    if (found.length > 0) return found;
  }

  const titleOnly = line.title.trim();
  if (titleOnly === '' || titleOnly === full) return [];
  return runSearch(titleOnly, signal);
}
