/**
 * Busca no catálogo do Spotify (001/contrato §6, research §5).
 *
 * Busca **por campos** (`track:"…" artist:"…"`). Zero resultados dispara **um**
 * fallback de texto livre — o suficiente para recuperar grafia de artista
 * divergente sem dobrar o custo do caminho feliz.
 *
 * `limit=5` alimenta diretamente as cinco candidatas de FR-023, sem requisição
 * extra.
 */

import type { InputLine, TrackCandidateRaw } from '@/domain/types';
import { apiRequest } from '@/services/providers/http';

const PROVIDER = 'spotify' as const;

export const SEARCH_LIMIT = 5;

interface SearchResponse {
  tracks?: {
    items?: SpotifyTrackObject[];
  };
}

interface SpotifyTrackObject {
  uri: string;
  id: string;
  name: string;
  artists?: { name: string }[];
  album?: { name?: string; images?: { url: string; width?: number; height?: number }[] };
  duration_ms?: number;
  external_urls?: { spotify?: string };
}

/** Menor imagem disponível: a revisão exibe miniaturas, não capas em tamanho real. */
function smallestCover(images: { url: string; width?: number; height?: number }[]): string | null {
  if (images.length === 0) return null;
  const sorted = [...images].sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  return sorted[0]?.url ?? null;
}

export function toCandidate(track: SpotifyTrackObject): TrackCandidateRaw {
  return {
    uri: track.uri,
    id: track.id,
    title: track.name,
    artists: (track.artists ?? []).map((artist) => artist.name),
    album: track.album?.name ?? '',
    durationMs: track.duration_ms ?? 0,
    coverUrl: smallestCover(track.album?.images ?? []),
    externalUrl: track.external_urls?.spotify ?? '',
  };
}

function fieldedQuery(line: InputLine): string {
  const title = line.title.replace(/"/gu, ' ').trim();
  const artist = line.artist.replace(/"/gu, ' ').trim();
  return artist === '' ? `track:"${title}"` : `track:"${title}" artist:"${artist}"`;
}

function freeTextQuery(line: InputLine): string {
  return `${line.title} ${line.artist}`.trim();
}

async function runSearch(query: string, signal?: AbortSignal): Promise<TrackCandidateRaw[]> {
  const response = await apiRequest<SearchResponse>(PROVIDER, '/v1/search', {
    params: {
      q: query,
      type: 'track',
      limit: SEARCH_LIMIT,
      // Sem `market`: `from_token` exigiria o escopo `user-read-private` (403
      // "Insufficient client scope"), e omitir o parâmetro já faz a API usar o
      // país da conta do próprio token de usuário.
    },
    ...(signal === undefined ? {} : { signal }),
  });

  return (response.tracks?.items ?? []).map(toCandidate);
}

export async function searchTrack(
  line: InputLine,
  signal?: AbortSignal,
): Promise<TrackCandidateRaw[]> {
  const byField = await runSearch(fieldedQuery(line), signal);
  if (byField.length > 0) return byField;

  const free = freeTextQuery(line);
  if (free === '') return [];
  return runSearch(free, signal);
}
