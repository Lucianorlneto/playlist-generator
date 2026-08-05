import { beforeEach, describe, expect, it } from 'vitest';

import { parseLine } from '@/domain/parser';
import { runMatching } from '@/features/input/matchRunner';
import { createRefresher } from '@/services/spotify/auth';
import { configureSpotifyClient } from '@/services/spotify/client';
import { searchTrack } from '@/services/spotify/search';
import { createLimiter } from '@/services/rate-limiter';

import { makeSession } from '../fixtures/factories';
import { program, requestLog, RESPONSES, setCatalog, type MockTrack } from '../msw/handlers';

const CLIENT_ID = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';

/** Limitador sem espera: as políticas de vazão têm testes próprios. */
const fastLimiter = () => createLimiter({ ratePerSecond: 1000, burst: 1000, concurrency: 4 });

function searchRequests() {
  return requestLog.filter((entry) => entry.endpoint === 'search');
}

function catalogTrack(overrides: Partial<MockTrack> = {}): MockTrack {
  return {
    id: 'bohemian',
    name: 'Bohemian Rhapsody',
    artists: ['Queen'],
    album: 'A Night at the Opera',
    durationMs: 354_320,
    ...overrides,
  };
}

beforeEach(() => {
  configureSpotifyClient({
    getSession: () => makeSession(),
    saveSession: () => undefined,
    clearSession: () => undefined,
    refresh: createRefresher(() => CLIENT_ID),
  });
});

describe('Busca por campos (contrato §6, FR-020)', () => {
  it('consulta com track: e artist:, limit 5 e sem market', async () => {
    setCatalog([catalogTrack()]);

    await searchTrack(parseLine('Bohemian Rhapsody - Queen', 0, 'l0'));

    const url = new URL(searchRequests()[0]?.url ?? '');
    expect(url.searchParams.get('q')).toBe('track:"Bohemian Rhapsody" artist:"Queen"');
    expect(url.searchParams.get('type')).toBe('track');
    expect(url.searchParams.get('limit')).toBe('5');
    // `from_token` exigiria `user-read-private`, escopo fora do conjunto mínimo.
    expect(url.searchParams.has('market')).toBe(false);
  });

  it('converte a resposta, usando a menor capa disponível', async () => {
    setCatalog([catalogTrack()]);

    const [candidate] = await searchTrack(parseLine('Bohemian Rhapsody - Queen', 0, 'l0'));

    expect(candidate?.uri).toBe('spotify:track:bohemian');
    expect(candidate?.title).toBe('Bohemian Rhapsody');
    expect(candidate?.artists).toEqual(['Queen']);
    expect(candidate?.album).toBe('A Night at the Opera');
    expect(candidate?.durationMs).toBe(354_320);
    expect(candidate?.coverUrl).toContain('i.scdn.co');
    expect(candidate?.externalUrl).toContain('open.spotify.com');
  });

  it('devolve capa nula quando o álbum não tem imagem', async () => {
    setCatalog([catalogTrack({ coverUrl: null })]);

    const [candidate] = await searchTrack(parseLine('Bohemian Rhapsody - Queen', 0, 'l0'));
    expect(candidate?.coverUrl).toBeNull();
  });

  it('cai para texto livre quando a busca por campos volta vazia (research §5)', async () => {
    // O artista escrito não casa com o catálogo; só o texto livre encontra.
    setCatalog([catalogTrack({ artists: ['Queen'] })]);

    const candidatos = await searchTrack(parseLine('Bohemian Rhapsody - Kwin', 0, 'l0'));

    expect(searchRequests()).toHaveLength(2);
    expect(new URL(searchRequests()[1]?.url ?? '').searchParams.get('q')).toBe(
      'Bohemian Rhapsody Kwin',
    );
    expect(candidatos).toHaveLength(1);
  });

  it('não repete a busca livre quando a busca por campos já achou', async () => {
    setCatalog([catalogTrack()]);
    await searchTrack(parseLine('Bohemian Rhapsody - Queen', 0, 'l0'));
    expect(searchRequests()).toHaveLength(1);
  });
});

describe('Políticas de falha do cliente HTTP (contrato §6)', () => {
  it('renova a sessão uma vez em 401 e repete a requisição', async () => {
    setCatalog([catalogTrack()]);
    program('search', RESPONSES.unauthorized());

    const candidatos = await searchTrack(parseLine('Bohemian Rhapsody - Queen', 0, 'l0'));

    expect(candidatos).toHaveLength(1);
    expect(searchRequests()).toHaveLength(2);
    expect(requestLog.filter((entry) => entry.endpoint === 'token')).toHaveLength(1);
  });

  it('espera e repete em 429, respeitando o Retry-After', async () => {
    setCatalog([catalogTrack()]);
    program('search', RESPONSES.rateLimited(0));

    const candidatos = await searchTrack(parseLine('Bohemian Rhapsody - Queen', 0, 'l0'));

    expect(candidatos).toHaveLength(1);
    expect(searchRequests()).toHaveLength(2);
  });

  // Backoff real: 2 s + 4 s entre as três tentativas (research §4).
  it('repete em 5xx e desiste depois do teto de tentativas', async () => {
    program('search', RESPONSES.serverError(), RESPONSES.serverError(), RESPONSES.serverError());

    await expect(
      searchTrack(parseLine('Bohemian Rhapsody - Queen', 0, 'l0')),
    ).rejects.toMatchObject({ kind: 'server_error' });
    expect(searchRequests()).toHaveLength(3);
  }, 20_000);
});

describe('Falha de uma linha não aborta as demais (contrato §6)', () => {
  it('marca só a linha que falhou, mantendo o resto do lote', async () => {
    setCatalog([
      catalogTrack(),
      catalogTrack({
        id: 'imagine',
        name: 'Imagine',
        artists: ['John Lennon'],
        album: 'Imagine',
      }),
    ]);
    // Três falhas seguidas esgotam as tentativas da primeira linha buscada.
    program('search', RESPONSES.serverError(), RESPONSES.serverError(), RESPONSES.serverError());

    const lines = [
      parseLine('Bohemian Rhapsody - Queen', 0, 'l0'),
      parseLine('Imagine - John Lennon', 1, 'l1'),
    ];

    const items = await runMatching(lines, {
      signal: new AbortController().signal,
      limiter: createLimiter({ ratePerSecond: 1000, burst: 1000, concurrency: 1 }),
    });

    expect(items).toHaveLength(2);
    expect(items[0]?.error).not.toBeNull();
    expect(items[0]?.status).toBe('not_found');
    expect(items[1]?.error).toBeNull();
    expect(items[1]?.status).toBe('confident');
  }, 20_000);

  it('mantém a ordem original mesmo com concorrência', async () => {
    setCatalog([
      catalogTrack(),
      catalogTrack({ id: 'imagine', name: 'Imagine', artists: ['John Lennon'], album: 'Imagine' }),
      catalogTrack({ id: 'jude', name: 'Hey Jude', artists: ['The Beatles'], album: '1' }),
    ]);

    const lines = [
      parseLine('Bohemian Rhapsody - Queen', 0, 'l0'),
      parseLine('Imagine - John Lennon', 1, 'l1'),
      parseLine('Hey Jude by The Beatles', 2, 'l2'),
    ];

    const items = await runMatching(lines, {
      signal: new AbortController().signal,
      limiter: fastLimiter(),
    });

    expect(items.map((item) => item.line.id)).toEqual(['l0', 'l1', 'l2']);
    expect(items.map((item) => item.status)).toEqual(['confident', 'confident', 'confident']);
  });

  it('linha sem separador nem chega a consultar o catálogo', async () => {
    setCatalog([catalogTrack()]);

    const items = await runMatching([parseLine('linha sem separador', 0, 'l0')], {
      signal: new AbortController().signal,
      limiter: fastLimiter(),
    });

    expect(items[0]?.status).toBe('unparsed');
    expect(searchRequests()).toHaveLength(0);
  });

  it('zero resultados nas duas tentativas resulta em não encontrada', async () => {
    setCatalog([]);

    const items = await runMatching([parseLine('Faixa Inexistente - Ninguém', 0, 'l0')], {
      signal: new AbortController().signal,
      limiter: fastLimiter(),
    });

    expect(items[0]?.status).toBe('not_found');
    expect(items[0]?.included).toBe(false);
    expect(searchRequests()).toHaveLength(2);
  });

  it('Confiantes entram marcadas e Incertas não (FR-025)', async () => {
    // O catálogo só tem a versão do Queen. A segunda linha pede outro artista:
    // o título casa, o artista não — exatamente o caso que precisa de olho humano.
    setCatalog([catalogTrack()]);

    const items = await runMatching(
      [
        parseLine('Bohemian Rhapsody - Queen', 0, 'l0'),
        parseLine('Bohemian Rhapsody - Panic At The Disco', 1, 'l1'),
      ],
      { signal: new AbortController().signal, limiter: fastLimiter() },
    );

    expect(items[0]?.status).toBe('confident');
    expect(items[0]?.included).toBe(true);
    expect(items[1]?.status).toBe('uncertain');
    expect(items[1]?.included).toBe(false);
  });

  it('cancelar interrompe e preserva o que já foi encontrado', async () => {
    setCatalog([catalogTrack()]);
    const controller = new AbortController();
    controller.abort();

    const items = await runMatching([parseLine('Bohemian Rhapsody - Queen', 0, 'l0')], {
      signal: controller.signal,
      limiter: fastLimiter(),
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.status).toBe('pending');
    expect(searchRequests()).toHaveLength(0);
  });
});
