import { describe, expect, it } from 'vitest';

import { parseInput, parseLine } from '@/domain/parser';

describe('Análise de linhas (FR-012 a FR-015)', () => {
  it('reconhece os quatro separadores', () => {
    const lines = parseInput(
      [
        'Bohemian Rhapsody - Queen',
        'Imagine – John Lennon',
        'Smells Like Teen Spirit — Nirvana',
        'Hey Jude by The Beatles',
      ].join('\n'),
    );

    expect(lines.map((line) => line.title)).toEqual([
      'Bohemian Rhapsody',
      'Imagine',
      'Smells Like Teen Spirit',
      'Hey Jude',
    ]);
    expect(lines.map((line) => line.artist)).toEqual([
      'Queen',
      'John Lennon',
      'Nirvana',
      'The Beatles',
    ]);
    expect(lines.every((line) => line.parseStatus === 'parsed')).toBe(true);
  });

  it('remove prefixos de numeração antes de dividir', () => {
    const [numbered, dashed] = parseInput('1. Bohemian Rhapsody - Queen\n- Imagine - John Lennon');

    expect(numbered?.title).toBe('Bohemian Rhapsody');
    expect(numbered?.artist).toBe('Queen');
    expect(dashed?.title).toBe('Imagine');
    expect(dashed?.artist).toBe('John Lennon');
  });

  it('usa o ÚLTIMO separador para delimitar o artista', () => {
    const [line] = parseInput('Song - Remix - Artist');

    expect(line?.title).toBe('Song - Remix');
    expect(line?.artist).toBe('Artist');
  });

  it('não parte nomes com hífen sem espaço', () => {
    const [line] = parseInput('99 Problems - Jay-Z');

    expect(line?.title).toBe('99 Problems');
    expect(line?.artist).toBe('Jay-Z');
  });

  it('extrai feat. e ft. como artistas secundários', () => {
    const [comFeat] = parseInput('Stay (feat. Justin Bieber) - The Kid LAROI');
    expect(comFeat?.title).toBe('Stay');
    expect(comFeat?.artist).toBe('The Kid LAROI');
    expect(comFeat?.featuredArtists).toEqual(['Justin Bieber']);

    const [comFt] = parseInput('Sunflower ft. Swae Lee - Post Malone');
    expect(comFt?.title).toBe('Sunflower');
    expect(comFt?.featuredArtists).toEqual(['Swae Lee']);
  });

  it('trata múltiplos artistas: o primeiro é o principal, os demais reforçam', () => {
    const [comE] = parseInput('Música - A & B');
    expect(comE?.artist).toBe('A');
    expect(comE?.featuredArtists).toEqual(['B']);

    const [comVirgula] = parseInput('Música - A, B, C');
    expect(comVirgula?.artist).toBe('A');
    expect(comVirgula?.featuredArtists).toEqual(['B', 'C']);
  });

  it('remove sufixos promocionais do título', () => {
    const [line] = parseInput('Águas de Março (Official Video) - Elis Regina');
    expect(line?.title).toBe('Águas de Março');
  });

  it('descarta linhas vazias sem ocupar índice (FR-014)', () => {
    const lines = parseInput('Bohemian Rhapsody - Queen\n\n   \n\nImagine - John Lennon\n');

    expect(lines).toHaveLength(2);
    expect(lines.map((line) => line.index)).toEqual([0, 1]);
  });

  it('marca linha sem separador como unparsed sem interromper as demais (FR-015)', () => {
    const lines = parseInput(
      'Bohemian Rhapsody - Queen\nlinha sem separador nenhum\nImagine - John Lennon',
    );

    expect(lines).toHaveLength(3);
    expect(lines[1]?.parseStatus).toBe('unparsed');
    expect(lines[1]?.title).toBe('');
    expect(lines[1]?.raw).toBe('linha sem separador nenhum');
    expect(lines[0]?.parseStatus).toBe('parsed');
    expect(lines[2]?.parseStatus).toBe('parsed');
  });

  it('preserva o texto original em raw, sem alterações', () => {
    const [line] = parseInput('  1. Águas de Março (Official Video) - Elis Regina  ');
    expect(line?.raw).toBe('  1. Águas de Março (Official Video) - Elis Regina  ');
  });

  it('marca como unparsed quando falta título ou artista', () => {
    expect(parseLine('- Queen', 0, 'l0').parseStatus).toBe('unparsed');
    expect(parseLine('Bohemian Rhapsody - ', 0, 'l0').parseStatus).toBe('unparsed');
  });

  it('parseLine preserva o id da linha na re-análise (FR-017)', () => {
    const original = parseLine('linha ruim', 3, 'estavel-1');
    const corrigida = parseLine('Wonderwall - Oasis', original.index, original.id);

    expect(corrigida.id).toBe('estavel-1');
    expect(corrigida.index).toBe(3);
    expect(corrigida.parseStatus).toBe('parsed');
  });

  it('nunca lança, qualquer que seja a entrada', () => {
    expect(() => parseInput('')).not.toThrow();
    expect(() => parseInput('---')).not.toThrow();
    expect(() => parseInput('()[]{}')).not.toThrow();
    expect(parseInput('')).toEqual([]);
  });
});
