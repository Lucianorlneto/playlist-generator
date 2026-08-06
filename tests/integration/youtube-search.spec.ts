/**
 * Busca no catálogo de vídeos (FR-023, FR-024, contrato §3 e §4).
 *
 * Três obrigações do adaptador que não são óbvias e por isso têm teste próprio:
 *
 * - **entidades HTML**: `search.list` sempre devolve o título escapado, e
 *   pontuar `&amp;` contra `&` degradaria a correspondência sem motivo;
 * - **duração vem de outra chamada**: `search.list` não a traz, e sem ela não há
 *   nem exibição (FR-024) nem indício de duração destoante (FR-025);
 * - **fallback único**: zero resultados tenta o título isolado uma vez, e só.
 *   Cada busca custa 100 unidades — repetir sem limite queimaria a cota.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { makeLine } from '../fixtures/factories';
import {
  decodeHtmlEntities,
  searchVideo,
} from '@/services/providers/youtube/search';
import { enrichCandidates, isoDurationToMs } from '@/services/providers/youtube/videos';

import { requestsTo, setYouTubeCatalog } from '../msw/handlers';
import { useFastLimiters, wireYouTube } from './support/clients';

beforeEach(() => {
  useFastLimiters();
  wireYouTube();
});

describe('FR-023 — busca no catálogo de vídeos', () => {
  it('consulta por texto livre com título e artista', async () => {
    setYouTubeCatalog([
      { id: 'v1', title: 'Bohemian Rhapsody', channel: 'Queen Official', duration: 'PT5M55S' },
    ]);

    const found = await searchVideo(makeLine());

    expect(found).toHaveLength(1);
    expect(found[0]?.id).toBe('v1');
    const url = new URL(requestsTo('ytSearch')[0]!.url);
    expect(url.searchParams.get('q')).toBe('Bohemian Rhapsody Queen');
    expect(url.searchParams.get('type')).toBe('video');
    expect(url.searchParams.get('maxResults')).toBe('5');
  });

  it('devolve no máximo 5 candidatas (FR-023)', async () => {
    setYouTubeCatalog(
      Array.from({ length: 9 }, (_, index) => ({
        id: `v${index}`,
        title: 'Bohemian Rhapsody',
        channel: 'Queen Official',
        duration: 'PT5M55S',
      })),
    );

    const found = await searchVideo(makeLine());

    expect(found.length).toBeLessThanOrEqual(5);
  });

  it('cai para o título isolado **uma única vez** quando não acha nada', async () => {
    setYouTubeCatalog([
      { id: 'v1', title: 'Bohemian Rhapsody', channel: 'Outro Canal', duration: 'PT5M55S' },
    ]);

    // Artista que não casa: a primeira consulta não acha, a segunda sim.
    const found = await searchVideo(makeLine({ artist: 'Artista Inexistente' }));

    expect(found).toHaveLength(1);
    // Exatamente duas buscas — o custo de cota é 100 por chamada.
    expect(requestsTo('ytSearch')).toHaveLength(2);
  });

  it('não repete a busca quando o título sozinho já era a consulta', async () => {
    setYouTubeCatalog([]);

    await searchVideo(makeLine({ artist: '' }));

    expect(requestsTo('ytSearch')).toHaveLength(1);
  });

  it('decodifica as entidades HTML do título', async () => {
    setYouTubeCatalog([
      { id: 'v1', title: `Bohemian Rhapsody & "Live" it's`, channel: 'Queen', duration: 'PT5M' },
    ]);

    const found = await searchVideo(makeLine());

    expect(found[0]?.title).toBe(`Bohemian Rhapsody & "Live" it's`);
    expect(found[0]?.title).not.toContain('&amp;');
    expect(found[0]?.title).not.toContain('&#39;');
  });

  it('decodeHtmlEntities cobre as entidades que a API emite', () => {
    expect(decodeHtmlEntities('a &amp; b')).toBe('a & b');
    expect(decodeHtmlEntities('it&#39;s')).toBe("it's");
    expect(decodeHtmlEntities('&quot;x&quot;')).toBe('"x"');
    expect(decodeHtmlEntities('sem entidade')).toBe('sem entidade');
  });

  it('traz o canal no lugar do artista e nunca promete álbum (FR-024)', async () => {
    setYouTubeCatalog([
      { id: 'v1', title: 'Bohemian Rhapsody', channel: 'Queen Official', duration: 'PT5M55S' },
    ]);

    const found = await searchVideo(makeLine());

    expect(found[0]?.channel).toBe('Queen Official');
    expect(found[0]?.album).toBe('');
  });
});

describe('FR-024 — enriquecimento com duração e canal', () => {
  it('converte a duração ISO-8601 em milissegundos', () => {
    expect(isoDurationToMs('PT3M52S')).toBe(232_000);
    expect(isoDurationToMs('PT1H2M3S')).toBe(3_723_000);
    expect(isoDurationToMs('PT45S')).toBe(45_000);
    expect(isoDurationToMs('')).toBe(0);
    expect(isoDurationToMs('não é duração')).toBe(0);
  });

  it('agrupa os ids em lotes de até 50 (custo 1 por chamada)', async () => {
    const videos = Array.from({ length: 120 }, (_, index) => ({
      id: `v${index}`,
      title: `Faixa ${index}`,
      channel: 'Canal',
      duration: 'PT3M00S',
    }));
    setYouTubeCatalog(videos);

    const candidates = videos.map((video) => ({
      uri: video.id,
      id: video.id,
      title: video.title,
      artists: [video.channel],
      album: '',
      durationMs: 0,
      coverUrl: null,
      externalUrl: `https://www.youtube.com/watch?v=${video.id}`,
    }));

    const enriched = await enrichCandidates(candidates);

    // 120 ids em lotes de 50 = 3 chamadas.
    expect(requestsTo('ytVideos')).toHaveLength(3);
    expect(enriched.get('v0')?.durationMs).toBe(180_000);
    for (const request of requestsTo('ytVideos')) {
      const ids = new URL(request.url).searchParams.get('id')?.split(',') ?? [];
      expect(ids.length).toBeLessThanOrEqual(50);
    }
  });

  it('mantém a candidata original quando a resposta não traz o id', async () => {
    setYouTubeCatalog([]);

    const enriched = await enrichCandidates([
      {
        uri: 'v9',
        id: 'v9',
        title: 'Sem enriquecimento',
        artists: ['Canal'],
        album: '',
        durationMs: 0,
        coverUrl: null,
        externalUrl: 'https://www.youtube.com/watch?v=v9',
      },
    ]);

    // Perder a duração é degradação de exibição, não motivo para derrubar a lista.
    expect(enriched.has('v9')).toBe(false);
  });
});
