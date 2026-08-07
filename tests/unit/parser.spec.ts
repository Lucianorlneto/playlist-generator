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

  /**
   * `003/FR-001`: a linha sem separador deixou de ser reprovada. Ela vira
   * `shape: 'free'` e continua **válida** — antes desta feature ela nem chegava
   * a ser buscada.
   */
  it('linha sem separador é válida na forma livre, sem interromper as demais', () => {
    const lines = parseInput(
      'Bohemian Rhapsody - Queen\nlinha sem separador nenhum\nImagine - John Lennon',
    );

    expect(lines).toHaveLength(3);
    expect(lines[1]?.parseStatus).toBe('parsed');
    expect(lines[1]?.shape).toBe('free');
    expect(lines[1]?.title).toBe('linha sem separador nenhum');
    expect(lines[1]?.raw).toBe('linha sem separador nenhum');
    expect(lines[0]?.parseStatus).toBe('parsed');
    expect(lines[2]?.parseStatus).toBe('parsed');
  });

  it('preserva o texto original em raw, sem alterações', () => {
    const [line] = parseInput('  1. Águas de Março (Official Video) - Elis Regina  ');
    expect(line?.raw).toBe('  1. Águas de Março (Official Video) - Elis Regina  ');
  });

  it('corte com um lado vazio cai na forma livre, não em inválida', () => {
    const semTitulo = parseLine('- Queen', 0, 'l0');
    expect(semTitulo.parseStatus).toBe('parsed');
    expect(semTitulo.shape).toBe('free');
    // `- ` é prefixo de numeração e sai antes do corte.
    expect(semTitulo.title).toBe('Queen');

    const semArtista = parseLine('Bohemian Rhapsody - ', 0, 'l0');
    expect(semArtista.parseStatus).toBe('parsed');
    expect(semArtista.shape).toBe('free');
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

/**
 * A tabela de derivação de `003/data-model §1`, caso a caso. É o contrato do
 * parser depois de o separador deixar de ser portão de admissão.
 */
describe('003/§1 — forma declarada e invalidez (FR-001 a FR-004)', () => {
  const casos: {
    entrada: string;
    shape: 'explicit' | 'free';
    title: string;
    artist: string;
    parseStatus: 'parsed' | 'unparsed';
  }[] = [
    {
      entrada: 'Zoio de Lula - Charlie Brown Jr',
      shape: 'explicit',
      title: 'Zoio de Lula',
      artist: 'Charlie Brown Jr',
      parseStatus: 'parsed',
    },
    {
      entrada: 'nao sei viver sem ter voce cpm 22',
      shape: 'free',
      title: 'nao sei viver sem ter voce cpm 22',
      artist: '',
      parseStatus: 'parsed',
    },
    {
      entrada: 'Não sei viver sem ter voce',
      shape: 'free',
      title: 'Não sei viver sem ter voce',
      artist: '',
      parseStatus: 'parsed',
    },
    { entrada: '- Artista', shape: 'free', title: 'Artista', artist: '', parseStatus: 'parsed' },
    { entrada: '---', shape: 'free', title: '', artist: '', parseStatus: 'unparsed' },
    { entrada: '3.', shape: 'free', title: '', artist: '', parseStatus: 'unparsed' },
    { entrada: '🎵', shape: 'free', title: '', artist: '', parseStatus: 'unparsed' },
  ];

  it.each(casos)('$entrada → $shape / $parseStatus', ({ entrada, ...esperado }) => {
    const line = parseLine(entrada, 0, 'l0');
    expect(line.shape).toBe(esperado.shape);
    expect(line.title).toBe(esperado.title);
    expect(line.artist).toBe(esperado.artist);
    expect(line.parseStatus).toBe(esperado.parseStatus);
  });

  /**
   * `003/FR-003`, US3/AC2. O hífen **dentro** do nome do artista não é
   * separador — exigir espaços em volta é o que impede `Jay-Z` de virar
   * `Jay` + `Z`, e continua valendo com o portão removido.
   */
  it('hífen sem espaços dentro do nome do artista não corta a linha', () => {
    const line = parseLine('99 Problems - Jay-Z', 0, 'l0');
    expect(line.shape).toBe('explicit');
    expect(line.title).toBe('99 Problems');
    expect(line.artist).toBe('Jay-Z');
  });

  /** Invariante L1: a forma livre não extrai artista nem _featured_. */
  it('L1 — forma livre nunca declara artista nem artista secundário', () => {
    const line = parseLine('song feat. Fulano de Tal e mais alguem', 0, 'l0');
    expect(line.shape).toBe('free');
    expect(line.artist).toBe('');
    expect(line.featuredArtists).toEqual([]);
  });

  /**
   * Invariante L2 nos dois sentidos. O caso `--- - ---` é o que quebraria se a
   * decisão de corte viesse antes da checagem de conteúdo: há separador e dois
   * lados não vazios, mas nenhuma música.
   */
  it('L2 — unparsed ⟺ nenhum caractere alfanumérico', () => {
    for (const lixo of ['---', '   -   ', '••', '()[]{}', '--- - ---', '🎵🎶']) {
      expect(parseLine(lixo, 0, 'l0').parseStatus, lixo).toBe('unparsed');
    }
    for (const valida of ['3. Imagine', 'a', 'Zoio de Lula - Charlie Brown Jr', '99']) {
      expect(parseLine(valida, 0, 'l0').parseStatus, valida).toBe('parsed');
    }
  });

  it('uma frase inteira colada por engano continua buscável, não inválida', () => {
    const frase =
      'coloquei aqui a lista toda de musicas que eu queria ouvir hoje de manha no caminho do trabalho';
    const line = parseLine(frase, 0, 'l0');
    expect(line.parseStatus).toBe('parsed');
    expect(line.shape).toBe('free');
    expect(line.title).toBe(frase);
  });

  /** Invariante L3: `raw` é byte a byte o original, em todas as formas. */
  it('L3 — raw preservado nas três formas', () => {
    for (const entrada of ['  1. Águas de Março (Official Video) - Elis Regina  ', '  🎵  ', ' só título ']) {
      expect(parseLine(entrada, 0, 'l0').raw).toBe(entrada);
    }
  });
});
