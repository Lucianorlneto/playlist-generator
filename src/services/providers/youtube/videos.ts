/**
 * Enriquecimento das candidatas (contracts/youtube-api.md §4, research §4).
 *
 * `search.list` **não retorna duração**. Sem esta chamada não há como cumprir
 * FR-024 (exibir duração) nem detectar o indício de duração destoante de FR-025 —
 * e não existe outro modo de obtê-la.
 *
 * Lotes de até 50 ids por chamada, a **1 unidade cada**: 5 unidades para uma
 * lista de 50 linhas, irrelevante diante das 5 000 da busca. Uma chamada por
 * linha custaria a mesma cota com 10× mais requisições HTTP.
 */

import { ENRICH_BATCH_SIZE } from '@/domain/quota';
import type { TrackCandidateRaw } from '@/domain/types';
import { apiRequest } from '@/services/providers/http';

import { decodeHtmlEntities } from './search';

const PROVIDER = 'youtube' as const;

interface VideosResponse {
  items?: {
    id?: string;
    snippet?: { title?: string; channelTitle?: string };
    contentDetails?: { duration?: string };
  }[];
}

const ISO_DURATION =
  /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/u;

/** ISO-8601 (`PT3M52S`) → milissegundos. `0` quando o formato não é reconhecido. */
export function isoDurationToMs(duration: string): number {
  const match = ISO_DURATION.exec(duration.trim());
  if (match === null) return 0;

  const days = Number.parseInt(match[1] ?? '0', 10);
  const hours = Number.parseInt(match[2] ?? '0', 10);
  const minutes = Number.parseInt(match[3] ?? '0', 10);
  const seconds = Number.parseFloat(match[4] ?? '0');

  const total = days * 86_400 + hours * 3_600 + minutes * 60 + seconds;
  return Number.isFinite(total) ? Math.round(total * 1000) : 0;
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    result.push(items.slice(start, start + size));
  }
  return result;
}

/**
 * Completa duração e canal das candidatas. Devolve um índice por `id`; ids que a
 * resposta não trouxer ficam de fora e o chamador mantém a versão original —
 * perder a duração de um vídeo é degradação de exibição, não motivo para
 * derrubar a lista.
 */
export async function enrichCandidates(
  candidates: TrackCandidateRaw[],
  signal?: AbortSignal,
): Promise<Map<string, TrackCandidateRaw>> {
  const byId = new Map<string, TrackCandidateRaw>();
  for (const candidate of candidates) {
    if (!byId.has(candidate.id)) byId.set(candidate.id, candidate);
  }

  const enriched = new Map<string, TrackCandidateRaw>();
  const ids = [...byId.keys()];

  for (const batch of chunk(ids, ENRICH_BATCH_SIZE)) {
    const response = await apiRequest<VideosResponse>(PROVIDER, '/youtube/v3/videos', {
      params: { part: 'contentDetails,snippet', id: batch.join(',') },
      operation: 'enrich',
      ...(signal === undefined ? {} : { signal }),
    });

    for (const item of response.items ?? []) {
      const id = item.id;
      if (typeof id !== 'string') continue;
      const original = byId.get(id);
      if (original === undefined) continue;

      const title = item.snippet?.title;
      const channel = item.snippet?.channelTitle;

      enriched.set(id, {
        ...original,
        durationMs: isoDurationToMs(item.contentDetails?.duration ?? ''),
        ...(typeof title === 'string' && title !== ''
          ? { title: decodeHtmlEntities(title) }
          : {}),
        ...(typeof channel === 'string' && channel !== ''
          ? { channel: decodeHtmlEntities(channel) }
          : {}),
      });
    }
  }

  return enriched;
}
