/**
 * Playlists do Spotify — 001/contrato §5, §7 e §8.
 *
 * Três operações e uma regra cada:
 * - `listMyPlaylistNames` pagina até `next === null` e filtra por `owner.id`:
 *   bloquear por causa de uma playlist de terceiros apenas seguida pelo usuário
 *   seria surpreendente e não é o que FR-022 descreve;
 * - `createPlaylist` é chamada **uma única vez** por criação; a retomada
 *   reutiliza `CreationProgress.playlistId`;
 * - `addTracks` respeita o teto de 100 URIs por requisição.
 */

import { capabilitiesOf } from '@/domain/providers';
import { AppError } from '@/services/providers/errors';
import { apiRequest } from '@/services/providers/http';

const PROVIDER = 'spotify' as const;

const BATCH_SIZE = capabilitiesOf(PROVIDER).batchSize;

interface PlaylistPage {
  items?: { id: string; name: string; owner?: { id?: string } }[];
  next?: string | null;
}

interface CreatedPlaylist {
  id: string;
  external_urls?: { spotify?: string };
}

export const PAGE_SIZE = 50;

/**
 * Nomes das playlists do próprio usuário. Qualquer erro propaga: a criação é
 * bloqueada com opção de repetir, nunca feita às cegas (FR-022).
 */
export async function listMyPlaylistNames(userId: string, signal?: AbortSignal): Promise<string[]> {
  const names: string[] = [];
  let offset = 0;

  for (;;) {
    const page = await apiRequest<PlaylistPage>(PROVIDER, '/v1/me/playlists', {
      params: { limit: PAGE_SIZE, offset },
      ...(signal === undefined ? {} : { signal }),
    });

    for (const item of page.items ?? []) {
      if (item.owner?.id === userId) names.push(item.name);
    }

    if (page.next === null || page.next === undefined) break;
    offset += PAGE_SIZE;

    // Salvaguarda contra um `next` que nunca termina: sem isto, um contrato
    // quebrado do lado do serviço travaria a interface para sempre.
    if (offset > 10_000) break;
  }

  return names;
}

export interface CreatePlaylistParams {
  userId: string;
  name: string;
  description: string;
  isPublic: boolean;
  signal?: AbortSignal;
}

export async function createPlaylist(
  params: CreatePlaylistParams,
): Promise<{ id: string; url: string }> {
  const created = await apiRequest<CreatedPlaylist>(
    PROVIDER,
    `/v1/users/${encodeURIComponent(params.userId)}/playlists`,
    {
      method: 'POST',
      body: {
        name: params.name.trim(),
        description: params.description,
        public: params.isPublic,
      },
      ...(params.signal === undefined ? {} : { signal: params.signal }),
      onExhausted: (error) =>
        new AppError('create_playlist_failed', { provider: PROVIDER, cause: error }),
    },
  );

  return {
    id: created.id,
    url: created.external_urls?.spotify ?? `https://open.spotify.com/playlist/${created.id}`,
  };
}

export async function addTracks(
  playlistId: string,
  uris: string[],
  signal?: AbortSignal,
): Promise<void> {
  if (uris.length === 0) return;
  if (uris.length > BATCH_SIZE) {
    throw new AppError('add_items_failed', {
      provider: PROVIDER,
      cause: new Error(`Lote de ${uris.length} URIs excede o limite de ${BATCH_SIZE}`),
    });
  }

  await apiRequest<unknown>(PROVIDER, `/v1/playlists/${encodeURIComponent(playlistId)}/tracks`, {
    method: 'POST',
    body: { uris },
    ...(signal === undefined ? {} : { signal }),
    onExhausted: (error) => new AppError('add_items_failed', { provider: PROVIDER, cause: error }),
  });
}
