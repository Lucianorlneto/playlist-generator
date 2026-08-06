/**
 * Playlists do YouTube — contracts/youtube-api.md §5, §6 e §7.
 *
 * Três regras que a plataforma impõe e que moldam o resto do desenho:
 *
 * 1. `playlists.list` **pagina por `nextPageToken`**, não por offset (FR-022);
 * 2. `privacyStatus: 'private'` é o padrão (FR-026); `unlisted` existe na API e
 *    está fora de escopo por decisão da spec — prometer o que não se entrega é o
 *    que o Princípio de honestidade proíbe;
 * 3. `playlistItems.insert` aceita **um vídeo por requisição** — não existe
 *    endpoint de lote. `snippet.position` é omitido deliberadamente: sem ela cada
 *    inserção vai para o fim, o que preserva a ordem e mantém a retomada
 *    idempotente (research §9).
 */

import { capabilitiesOf } from '@/domain/providers';
import { t } from '@/i18n/pt-BR';
import { AppError } from '@/services/providers/errors';
import { apiRequest } from '@/services/providers/http';

const PROVIDER = 'youtube' as const;

const BATCH_SIZE = capabilitiesOf(PROVIDER).batchSize;

export const PAGE_SIZE = 50;
/** Salvaguarda contra um `nextPageToken` que nunca termina. */
const MAX_PAGES = 40;

interface PlaylistPage {
  items?: { id?: string; snippet?: { title?: string } }[];
  nextPageToken?: string;
}

interface CreatedPlaylist {
  id?: string;
}

/**
 * Nomes das playlists do próprio usuário. Qualquer erro propaga: a criação é
 * bloqueada com opção de repetir, nunca feita às cegas (FR-022).
 */
export async function listPlaylistNames(signal?: AbortSignal): Promise<string[]> {
  const names: string[] = [];
  let pageToken: string | undefined;
  let pages = 0;

  for (;;) {
    const page = await apiRequest<PlaylistPage>(PROVIDER, '/youtube/v3/playlists', {
      params: {
        part: 'snippet',
        mine: 'true',
        maxResults: PAGE_SIZE,
        ...(pageToken === undefined ? {} : { pageToken }),
      },
      operation: 'listPlaylists',
      ...(signal === undefined ? {} : { signal }),
    });

    for (const item of page.items ?? []) {
      const title = item.snippet?.title;
      if (typeof title === 'string') names.push(title);
    }

    pageToken = page.nextPageToken;
    pages += 1;
    if (pageToken === undefined || pageToken === '' || pages >= MAX_PAGES) break;
  }

  return names;
}

export interface CreatePlaylistParams {
  name: string;
  description: string;
  isPublic: boolean;
  signal?: AbortSignal;
}

export async function createPlaylist(
  params: CreatePlaylistParams,
): Promise<{ id: string; url: string }> {
  const created = await apiRequest<CreatedPlaylist>(PROVIDER, '/youtube/v3/playlists', {
    method: 'POST',
    params: { part: 'snippet,status' },
    body: {
      snippet: { title: params.name.trim(), description: params.description },
      status: { privacyStatus: params.isPublic ? 'public' : 'private' },
    },
    operation: 'createPlaylist',
    ...(params.signal === undefined ? {} : { signal: params.signal }),
    onExhausted: (error) =>
      new AppError('create_playlist_failed', { provider: PROVIDER, cause: error }),
  });

  const id = created.id;
  if (typeof id !== 'string' || id === '') {
    throw new AppError('create_playlist_failed', { provider: PROVIDER });
  }

  // Link **exibido**, nunca destino de requisição (research §14).
  return { id, url: `https://www.youtube.com/playlist?list=${id}` };
}

/**
 * Adiciona um lote — que no YouTube tem sempre **um** vídeo. O tamanho vem de
 * `capabilities.batchSize`; receber mais que isso é erro de programação, não do
 * usuário, e falhar alto é melhor do que enviar só o primeiro em silêncio.
 */
export async function addItems(
  playlistId: string,
  videoIds: string[],
  signal?: AbortSignal,
): Promise<void> {
  if (videoIds.length === 0) return;
  if (videoIds.length > BATCH_SIZE) {
    throw new AppError('add_items_failed', {
      provider: PROVIDER,
      cause: new Error(`Lote de ${videoIds.length} vídeos excede o limite de ${BATCH_SIZE}`),
    });
  }

  for (const videoId of videoIds) {
    await apiRequest<unknown>(PROVIDER, '/youtube/v3/playlistItems', {
      method: 'POST',
      params: { part: 'snippet' },
      body: {
        snippet: {
          playlistId,
          resourceId: { kind: 'youtube#video', videoId },
        },
      },
      operation: 'addItem',
      ...(signal === undefined ? {} : { signal }),
      onExhausted: (error) => new AppError('add_items_failed', { provider: PROVIDER, cause: error }),
    });
  }
}

/** `Você / Playlists / {nome}` — o único caminho que o YouTube expõe (FR-027). */
export function effectivePath(_displayName: string, playlistName: string): string {
  return `${t.providers.youtube.libraryRoot} / ${playlistName}`;
}
