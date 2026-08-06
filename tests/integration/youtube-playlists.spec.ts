/**
 * Playlists do YouTube (FR-022, FR-026, FR-027, contrato §5 a §7).
 *
 * O detalhe que governa o custo e a retomada: **não existe endpoint de lote**.
 * Cada vídeo é uma requisição de 50 unidades, enviada em série, e `position` é
 * omitida de propósito — sem ela cada inserção vai para o fim, o que preserva a
 * ordem e mantém a retomada idempotente (research §9).
 */

import { beforeEach, describe, expect, it } from 'vitest';

import {
  addItems,
  createPlaylist,
  effectivePath,
  listPlaylistNames,
} from '@/services/providers/youtube/playlists';
import { t } from '@/i18n/pt-BR';

import { createdYouTubePlaylist, requestsTo, setYouTubePlaylists } from '../msw/handlers';
import { useFastLimiters, wireYouTube } from './support/clients';

beforeEach(() => {
  useFastLimiters();
  wireYouTube();
});

describe('FR-026 — criação com visibilidade privada por padrão', () => {
  it('envia privacyStatus private quando a playlist não é pública', async () => {
    const created = await createPlaylist({
      name: 'Clássicos',
      description: 'minha lista',
      isPublic: false,
    });

    expect(createdYouTubePlaylist(created.id)?.privacy).toBe('private');
    expect(createdYouTubePlaylist(created.id)?.title).toBe('Clássicos');

    const body = JSON.parse(requestsTo('ytCreatePlaylist')[0]?.body ?? '{}');
    expect(body.status.privacyStatus).toBe('private');
    expect(body.snippet.title).toBe('Clássicos');
  });

  it('envia privacyStatus public quando o usuário escolhe pública', async () => {
    const created = await createPlaylist({ name: 'Pública', description: '', isPublic: true });

    expect(createdYouTubePlaylist(created.id)?.privacy).toBe('public');
  });

  it('nunca usa "unlisted", que está fora de escopo', async () => {
    await createPlaylist({ name: 'A', description: '', isPublic: false });
    await createPlaylist({ name: 'B', description: '', isPublic: true });

    for (const request of requestsTo('ytCreatePlaylist')) {
      expect(request.body).not.toContain('unlisted');
    }
  });

  it('devolve o link de exibição da playlist, não um destino de requisição', async () => {
    const created = await createPlaylist({ name: 'Link', description: '', isPublic: false });

    expect(created.url).toBe(`https://www.youtube.com/playlist?list=${created.id}`);
  });
});

describe('FR-022 — listagem paginada para a checagem de nome duplicado', () => {
  it('pagina por nextPageToken até o fim', async () => {
    setYouTubePlaylists(
      Array.from({ length: 120 }, (_, index) => ({ id: `PL${index}`, title: `Lista ${index}` })),
      50,
    );

    const names = await listPlaylistNames();

    expect(names).toHaveLength(120);
    expect(names[0]).toBe('Lista 0');
    expect(names[119]).toBe('Lista 119');
    // 120 itens em páginas de 50 = 3 requisições.
    expect(requestsTo('ytPlaylists')).toHaveLength(3);
  });

  it('devolve lista vazia quando a conta não tem playlists', async () => {
    setYouTubePlaylists([]);

    expect(await listPlaylistNames()).toEqual([]);
  });
});

describe('contrato §7 — uma requisição por vídeo', () => {
  it('envia um playlistItems.insert para cada vídeo, na ordem', async () => {
    const created = await createPlaylist({ name: 'Ordem', description: '', isPublic: false });

    await addItems(created.id, ['v1']);
    await addItems(created.id, ['v2']);
    await addItems(created.id, ['v3']);

    expect(requestsTo('ytPlaylistItems')).toHaveLength(3);
    expect(createdYouTubePlaylist(created.id)?.videoIds).toEqual(['v1', 'v2', 'v3']);
  });

  it('omite snippet.position, mantendo a retomada idempotente', async () => {
    const created = await createPlaylist({ name: 'Posição', description: '', isPublic: false });
    await addItems(created.id, ['v1']);

    const body = JSON.parse(requestsTo('ytPlaylistItems')[0]?.body ?? '{}');
    expect(body.snippet.position).toBeUndefined();
    expect(body.snippet.resourceId).toEqual({ kind: 'youtube#video', videoId: 'v1' });
  });

  it('recusa um lote maior que o batchSize do provedor', async () => {
    const created = await createPlaylist({ name: 'Lote', description: '', isPublic: false });

    await expect(addItems(created.id, ['v1', 'v2'])).rejects.toMatchObject({
      kind: 'add_items_failed',
      provider: 'youtube',
    });
    // Falha alto, sem enviar só o primeiro em silêncio.
    expect(requestsTo('ytPlaylistItems')).toHaveLength(0);
  });

  it('lote vazio não emite requisição', async () => {
    await addItems('PL_x', []);

    expect(requestsTo('ytPlaylistItems')).toHaveLength(0);
  });
});

describe('FR-027 — caminho efetivo do YouTube', () => {
  it('usa a raiz declarada pelo provedor, sem inventar pasta', () => {
    expect(effectivePath('Canal de Teste', 'Clássicos')).toBe(
      `${t.providers.youtube.libraryRoot} / Clássicos`,
    );
  });
});
