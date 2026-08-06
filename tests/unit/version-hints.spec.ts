import { describe, expect, it } from 'vitest';

import {
  DURATION_OUTLIER_RATIO,
  durationHint,
  lexicalHints,
  median,
  stripDecorations,
  versionHints,
} from '@/domain/versionHints';

describe('FR-025 — léxico de indícios de versão', () => {
  it('reconhece os indícios em português e inglês', () => {
    expect(lexicalHints('Bohemian Rhapsody (Live at Wembley)')).toContain('live');
    expect(lexicalHints('Construção — Ao Vivo')).toContain('live');
    expect(lexicalHints('Imagine - Cover by Marina')).toContain('cover');
    expect(lexicalHints('Hey Jude (Karaoke Version)')).toContain('karaoke');
    expect(lexicalHints('Numb (Instrumental)')).toContain('instrumental');
    expect(lexicalHints('Creep — Acústico')).toContain('acoustic');
    expect(lexicalHints('Yellow (Remastered 2011)')).toContain('remaster');
    expect(lexicalHints('Africa (Sped Up)')).toContain('sped_up');
    expect(lexicalHints('Zombie (slowed + reverb)')).toContain('slowed');
    expect(lexicalHints('Purple Rain — Tributo')).toContain('tribute');
    expect(lexicalHints('Africa x Toto MASHUP')).toContain('mashup');
    expect(lexicalHints('Creep (Nightcore)')).toContain('nightcore');
    expect(lexicalHints('Reaction: Bohemian Rhapsody')).toContain('reaction');
    expect(lexicalHints('Hotel California — trecho')).toContain('excerpt');
  });

  /** A regressão que o requisito nomeia: fronteira de palavra, não substring. */
  it('respeita a fronteira de palavra — "Livermore" não é "live"', () => {
    expect(lexicalHints('Livermore Blues')).toEqual([]);
    expect(lexicalHints('Delivery')).toEqual([]);
    expect(lexicalHints('Coverage of the Storm')).toEqual([]);
    expect(lexicalHints('Remixture')).toEqual([]);
  });

  it('ignora acento e caixa', () => {
    expect(lexicalHints('AO VIVO')).toEqual(lexicalHints('ao vivo'));
    expect(lexicalHints('Acústico')).toEqual(lexicalHints('acustico'));
    expect(lexicalHints('TRIBUTO')).toContain('tribute');
  });

  it('não inventa indício em título limpo', () => {
    expect(lexicalHints('Bohemian Rhapsody')).toEqual([]);
    expect(lexicalHints('Águas de Março')).toEqual([]);
  });
});

describe('research §7 — stripDecorations', () => {
  it('remove decorações editoriais que não mudam a gravação', () => {
    expect(stripDecorations('Bohemian Rhapsody (Official Music Video)')).toBe('Bohemian Rhapsody');
    expect(stripDecorations('Imagine [Official Video]')).toBe('Imagine');
    expect(stripDecorations('Construção (Clipe Oficial)')).toBe('Construção');
    expect(stripDecorations('Yellow (Audio)')).toBe('Yellow');
    expect(stripDecorations('Creep (Lyric Video)')).toBe('Creep');
    expect(stripDecorations('Africa | HD')).toBe('Africa');
    expect(stripDecorations('Numb 🔥')).toBe('Numb');
  });

  /**
   * O ponto que separa "limpar ruído" de "apagar informação": remover
   * "(Karaoke Version)" faria o karaokê pontuar igual à faixa certa.
   */
  it('**não** remove marcadores que mudam a versão', () => {
    expect(stripDecorations('Hey Jude (Karaoke Version)')).toBe('Hey Jude (Karaoke Version)');
    expect(stripDecorations('Bohemian Rhapsody (Live at Wembley)')).toBe(
      'Bohemian Rhapsody (Live at Wembley)',
    );
    expect(stripDecorations('Creep (Acoustic)')).toBe('Creep (Acoustic)');
  });

  it('é idempotente', () => {
    const entradas = [
      'Bohemian Rhapsody (Official Music Video) [HD]',
      'Imagine (Official Video) | Audio',
      'Yellow',
      'Africa (Live at Wembley) (Official Video)',
    ];
    for (const entrada of entradas) {
      const uma = stripDecorations(entrada);
      expect(stripDecorations(uma)).toBe(uma);
    }
  });
});

describe('FR-025 — duração destoante', () => {
  it('marca desvio superior a 25% da mediana', () => {
    expect(durationHint(200_000, 200_000)).toEqual([]);
    expect(durationHint(240_000, 200_000)).toEqual([]);
    expect(durationHint(251_000, 200_000)).toEqual(['duration_outlier']);
    expect(durationHint(140_000, 200_000)).toEqual(['duration_outlier']);
  });

  it('exatamente 25% não marca — o limiar é estrito', () => {
    expect(DURATION_OUTLIER_RATIO).toBe(0.25);
    expect(durationHint(250_000, 200_000)).toEqual([]);
  });

  it('sem mediana utilizável não há indício', () => {
    expect(durationHint(200_000, 0)).toEqual([]);
    expect(durationHint(0, 200_000)).toEqual([]);
  });

  it('a mediana ignora durações ausentes', () => {
    expect(median([100, 200, 300])).toBe(200);
    expect(median([100, 0, 200, 300])).toBe(200);
    expect(median([])).toBe(0);
    expect(median([100, 200])).toBe(150);
  });
});

describe('FR-025 — versionHints combina os dois sinais', () => {
  it('junta léxico e duração sem repetir', () => {
    const hints = versionHints('Bohemian Rhapsody (Live at Wembley)', 500_000, [
      354_000,
      354_000,
      500_000,
    ]);
    expect(hints).toContain('live');
    expect(hints).toContain('duration_outlier');
    expect(new Set(hints).size).toBe(hints.length);
  });

  it('faixa oficial na duração da mediana não recebe indício algum', () => {
    expect(
      versionHints('Bohemian Rhapsody (Official Music Video)', 354_000, [354_000, 360_000, 350_000]),
    ).toEqual([]);
  });
});
