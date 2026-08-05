import { beforeEach, describe, expect, it } from 'vitest';

import { createRefresher } from '@/services/spotify/auth';
import { configureSpotifyClient } from '@/services/spotify/client';
import { addTracks, createPlaylist, listMyPlaylistNames } from '@/services/spotify/playlists';

import { makeSession } from '../fixtures/factories';
import { createdPlaylist, requestLog, setPlaylists } from '../msw/handlers';

const CLIENT_ID = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
const USER_ID = 'usuario_teste';

beforeEach(() => {
  configureSpotifyClient({
    getSession: () => makeSession(),
    saveSession: () => undefined,
    clearSession: () => undefined,
    refresh: createRefresher(() => CLIENT_ID),
  });
});

function playlistRequests() {
  return requestLog.filter((entry) => entry.endpoint === 'myPlaylists');
}

describe('Listagem de playlists (contrato §5, FR-029)', () => {
  it('pagina até next === null', () => {
    const total = 120;
    setPlaylists(
      Array.from({ length: total }, (_, index) => ({
        id: `p${index}`,
        name: `Playlist ${index}`,
        ownerId: USER_ID,
      })),
    );

    return listMyPlaylistNames(USER_ID).then((names) => {
      expect(names).toHaveLength(total);
      expect(playlistRequests()).toHaveLength(3);
      expect(names[0]).toBe('Playlist 0');
      expect(names.at(-1)).toBe('Playlist 119');
    });
  });

  it('filtra por owner.id — playlist de terceiro não bloqueia o nome', async () => {
    setPlaylists([
      { id: 'p1', name: 'Minha', ownerId: USER_ID },
      { id: 'p2', name: 'De outra pessoa', ownerId: 'outro_usuario' },
    ]);

    const names = await listMyPlaylistNames(USER_ID);

    expect(names).toEqual(['Minha']);
  });

  it('devolve lista vazia quando a conta não tem playlists', async () => {
    setPlaylists([]);
    expect(await listMyPlaylistNames(USER_ID)).toEqual([]);
  });
});

describe('Criação e adição (contrato §7 e §8)', () => {
  it('cria a playlist com nome, descrição e visibilidade', async () => {
    const created = await createPlaylist({
      userId: USER_ID,
      name: '  Clássicos  ',
      description: 'Minhas favoritas',
      isPublic: false,
    });

    expect(created.id).toBeTruthy();
    expect(created.url).toContain('open.spotify.com/playlist/');

    const request = requestLog.find((entry) => entry.endpoint === 'createPlaylist');
    const body = JSON.parse(request?.body ?? '{}') as Record<string, unknown>;
    expect(body['name']).toBe('Clássicos');
    expect(body['description']).toBe('Minhas favoritas');
    expect(body['public']).toBe(false);
  });

  it('respeita a visibilidade pública quando o usuário alterna', async () => {
    await createPlaylist({
      userId: USER_ID,
      name: 'Pública',
      description: '',
      isPublic: true,
    });

    const request = requestLog.find((entry) => entry.endpoint === 'createPlaylist');
    expect(JSON.parse(request?.body ?? '{}')['public']).toBe(true);
  });

  it('adiciona faixas em lotes, preservando a ordem', async () => {
    const created = await createPlaylist({
      userId: USER_ID,
      name: 'Com faixas',
      description: '',
      isPublic: false,
    });

    const uris = Array.from({ length: 250 }, (_, index) => `spotify:track:${index}`);
    for (let start = 0; start < uris.length; start += 100) {
      await addTracks(created.id, uris.slice(start, start + 100));
    }

    expect(createdPlaylist(created.id)?.uris).toEqual(uris);
    expect(requestLog.filter((entry) => entry.endpoint === 'addTracks')).toHaveLength(3);
  });

  it('recusa um lote acima do limite da plataforma antes de sair da máquina', async () => {
    const created = await createPlaylist({
      userId: USER_ID,
      name: 'Lote grande',
      description: '',
      isPublic: false,
    });

    const uris = Array.from({ length: 101 }, (_, index) => `spotify:track:${index}`);

    await expect(addTracks(created.id, uris)).rejects.toMatchObject({ kind: 'add_tracks_failed' });
    expect(requestLog.filter((entry) => entry.endpoint === 'addTracks')).toHaveLength(0);
  });

  it('não faz requisição para um lote vazio', async () => {
    await addTracks('playlist-1', []);
    expect(requestLog.filter((entry) => entry.endpoint === 'addTracks')).toHaveLength(0);
  });
});
