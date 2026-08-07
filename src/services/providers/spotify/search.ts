/**
 * Busca no catálogo do Spotify (`001/contrato §6`, research §5,
 * `003/contracts/search-queries.md §1`).
 *
 * A consulta depende da **forma da linha**:
 *
 * - `explicit` → por campos (`track:"…" artist:"…"`), que é o que o usuário
 *   ganha ao declarar onde termina o título;
 * - `free` → texto livre com a linha inteira, porque não há campo a preencher.
 *
 * A segunda tentativa deixou de ser um fallback interno e escondido. Ela agora é
 * **orquestrada pelo runner** (`003/FR-009`): o adaptador só declara qual seria a
 * consulta alternativa, e quem decide emiti-la é quem também conta o orçamento.
 * O fallback antigo gastava requisição sem aparecer em lugar nenhum da
 * estimativa — era o buraco de passagem que `003/research §8` documenta.
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

/** `track:"…" artist:"…"` — só faz sentido quando a linha declarou os campos. */
export function fieldedQuery(line: InputLine): string {
  const title = line.title.replace(/"/gu, ' ').trim();
  const artist = line.artist.replace(/"/gu, ' ').trim();
  return artist === '' ? `track:"${title}"` : `track:"${title}" artist:"${artist}"`;
}

/** Texto livre com o que a linha tem: a linha inteira na forma livre. */
export function freeTextQuery(line: InputLine): string {
  return line.shape === 'free' ? line.title.trim() : `${line.title} ${line.artist}`.trim();
}

/** Consulta primária desta linha, decidida pela forma (contrato §1). */
export function primaryQuery(line: InputLine): string {
  return line.shape === 'explicit' ? fieldedQuery(line) : freeTextQuery(line);
}

/**
 * Consulta alternativa: **a linha inteira**, como o usuário a escreveu. É o que
 * recupera grafia de artista divergente, que a consulta por campos rejeita.
 */
export function retryQuery(line: InputLine): string {
  return line.raw.trim();
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

/** Consulta **primária** da linha. Uma requisição, nunca duas (invariante O4). */
export async function searchTrack(
  line: InputLine,
  signal?: AbortSignal,
): Promise<TrackCandidateRaw[]> {
  const query = primaryQuery(line);
  if (query === '' || query === 'track:""') return [];
  return runSearch(query, signal);
}

/** Consulta **alternativa**, emitida só quando o runner decide (`003/FR-009`). */
export async function retryTrack(
  line: InputLine,
  signal?: AbortSignal,
): Promise<TrackCandidateRaw[]> {
  const query = retryQuery(line);
  if (query === '') return [];
  return runSearch(query, signal);
}
