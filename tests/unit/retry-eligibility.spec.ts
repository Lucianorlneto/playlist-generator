import { describe, expect, it } from 'vitest';

import { normalizeText } from '@/domain/normalize';
import { parseLine } from '@/domain/parser';
import { planQueries, retryReserveFor } from '@/domain/retry';
import type { InputLine } from '@/domain/types';

/**
 * Elegibilidade de retentativa (`003/FR-009`, research §6,
 * `contracts/search-queries.md §2`).
 *
 * As consultas são reproduzidas aqui na mesma forma que os adaptadores as
 * montam. Reimplementá-las seria testar o teste; o que estas funções fazem é
 * declarar o contrato que `spotify/search.ts` e `youtube/search.ts` devem
 * cumprir — e `search-free-shape.spec.ts` verifica que eles o cumprem de fato.
 */
function youtubePrimary(line: InputLine): string {
  return line.shape === 'explicit' ? `${line.title} ${line.artist}`.trim() : line.title.trim();
}

function spotifyPrimary(line: InputLine): string {
  return line.shape === 'explicit'
    ? `track:"${line.title}" artist:"${line.artist}"`
    : line.title.trim();
}

/** A alternativa é sempre a mesma nos dois catálogos: a linha inteira. */
function wholeLine(line: InputLine): string {
  return line.raw;
}

function lineOf(raw: string): InputLine {
  return parseLine(raw, 0, 'l0');
}

function youtubeEligible(raw: string): boolean {
  return planQueries(lineOf(raw), youtubePrimary, wholeLine, false).retry !== null;
}

function spotifyEligible(raw: string): boolean {
  return planQueries(lineOf(raw), spotifyPrimary, wholeLine, true).retry !== null;
}

describe('§6 — no catálogo de vídeo, retenta só quando a consulta é outra', () => {
  const tabela: { linha: string; primaria: string; retentativa: string; elegivel: boolean }[] = [
    {
      linha: 'Zoio de Lula - Charlie Brown Jr',
      primaria: 'zoio de lula charlie brown jr',
      retentativa: 'zoio de lula charlie brown jr',
      elegivel: false,
    },
    {
      linha: 'Song (Official Video) - Artist',
      primaria: 'song artist',
      retentativa: 'song artist',
      elegivel: false,
    },
    {
      linha: 'Song feat. X - Artist A & B',
      primaria: 'song artist a',
      retentativa: 'song feat x artist a b',
      elegivel: true,
    },
    {
      linha: 'Marília Mendonça - Ao Vivo',
      primaria: 'marilia mendonca ao vivo',
      retentativa: 'marilia mendonca ao vivo',
      elegivel: false,
    },
  ];

  it.each(tabela)('$linha → elegível: $elegivel', ({ linha, primaria, retentativa, elegivel }) => {
    const line = lineOf(linha);
    // As duas normalizadas da tabela do contrato, verificadas uma a uma: se
    // elas mudarem, a conclusão sobre elegibilidade muda junto e em silêncio.
    expect(normalizeText(youtubePrimary(line))).toBe(primaria);
    expect(normalizeText(wholeLine(line))).toBe(retentativa);
    expect(youtubeEligible(linha)).toBe(elegivel);
  });

  /**
   * O caso que mais importa dos dois exemplos do pedido: a linha explícita cuja
   * retentativa seria a **mesma** requisição. Emiti-la custaria 100 unidades
   * para receber a mesma resposta.
   */
  it('Zoio de Lula - Charlie Brown Jr NÃO é elegível no YouTube', () => {
    expect(youtubeEligible('Zoio de Lula - Charlie Brown Jr')).toBe(false);
  });

  it('Song feat. X - Artist A & B É elegível: o feat. sai da primária e volta na alternativa', () => {
    expect(youtubeEligible('Song feat. X - Artist A & B')).toBe(true);
  });

  it('linha livre nunca retenta: a primeira consulta já é a linha inteira', () => {
    for (const linha of [
      'nao sei viver sem ter voce cpm 22',
      'Não sei viver sem ter voce',
      'zoio de lula charlie brown jr',
    ]) {
      expect(youtubeEligible(linha), linha).toBe(false);
    }
  });

  it('linha sem conteúdo alfanumérico não entra na conta', () => {
    expect(youtubeEligible('---')).toBe(false);
    expect(spotifyEligible('🎵')).toBe(false);
  });
});

describe('§6 — no Spotify a primária por campos é sempre outra consulta', () => {
  it('linha explícita é sempre elegível, mesmo quando as strings colapsariam', () => {
    expect(spotifyEligible('Zoio de Lula - Charlie Brown Jr')).toBe(true);
    expect(spotifyEligible('Marília Mendonça - Ao Vivo')).toBe(true);
  });

  /**
   * A ressalva que mantém a conta honesta: na forma livre nem o Spotify emite
   * consulta por campos, então a alternativa repetiria a primeira.
   */
  it('linha livre não é elegível nem no Spotify', () => {
    expect(spotifyEligible('nao sei viver sem ter voce cpm 22')).toBe(false);
    expect(spotifyEligible('Não sei viver sem ter voce')).toBe(false);
  });
});

describe('O5 — retryReserveFor é contagem exata e determinística', () => {
  const lista = [
    'Zoio de Lula - Charlie Brown Jr',
    'Song feat. X - Artist A & B',
    'Não sei viver sem ter voce',
    'Sunflower ft. Swae Lee - Post Malone',
    '---',
  ].map((raw, index) => parseLine(raw, index, `l${index}`));

  it('conta apenas as linhas cuja alternativa difere (YouTube)', () => {
    // As duas com `feat.`/`ft.`: o artista secundário sai da consulta primária
    // e reaparece na linha inteira.
    expect(retryReserveFor(lista, youtubePrimary, wholeLine, false)).toBe(2);
  });

  it('conta todas as explícitas no Spotify, e nenhuma livre', () => {
    expect(retryReserveFor(lista, spotifyPrimary, wholeLine, true)).toBe(3);
  });

  it('recalcular sobre as mesmas linhas dá o mesmo número', () => {
    const primeira = retryReserveFor(lista, youtubePrimary, wholeLine, false);
    const segunda = retryReserveFor(lista, youtubePrimary, wholeLine, false);
    expect(segunda).toBe(primeira);
  });

  it('lista vazia reserva zero', () => {
    expect(retryReserveFor([], youtubePrimary, wholeLine, false)).toBe(0);
  });
});
