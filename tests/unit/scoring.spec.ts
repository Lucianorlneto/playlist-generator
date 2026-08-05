import { describe, expect, it } from 'vitest';

import { parseLine } from '@/domain/parser';
import { classify, scoreCandidate, similarity } from '@/domain/scoring';
import { CONFIDENT_THRESHOLD, UNCERTAIN_THRESHOLD } from '@/domain/scoring/thresholds';
import type { TrackCandidateRaw } from '@/domain/types';

function track(overrides: Partial<TrackCandidateRaw> = {}): TrackCandidateRaw {
  return {
    uri: 'spotify:track:x',
    id: 'x',
    title: 'Bohemian Rhapsody',
    artists: ['Queen'],
    album: 'A Night at the Opera',
    durationMs: 354_320,
    coverUrl: null,
    externalUrl: '',
    ...overrides,
  };
}

const line = (raw: string) => parseLine(raw, 0, 'l0');

describe('classify — fronteiras dos limiares (research §6)', () => {
  it('respeita os três intervalos', () => {
    expect(classify(1)).toBe('confident');
    expect(classify(CONFIDENT_THRESHOLD)).toBe('confident');
    expect(classify(CONFIDENT_THRESHOLD - 0.0001)).toBe('uncertain');
    expect(classify(UNCERTAIN_THRESHOLD)).toBe('uncertain');
    expect(classify(UNCERTAIN_THRESHOLD - 0.0001)).toBe('not_found');
    expect(classify(0)).toBe('not_found');
  });
});

describe('scoreCandidate', () => {
  it('dá pontuação máxima para correspondência exata', () => {
    expect(scoreCandidate(line('Bohemian Rhapsody - Queen'), track())).toBe(1);
  });

  it('ignora acento e caixa', () => {
    const score = scoreCandidate(
      line('AGUAS DE MARCO - elis regina'),
      track({ title: 'Águas de Março', artists: ['Elis Regina'] }),
    );
    expect(score).toBe(1);
    expect(classify(score)).toBe('confident');
  });

  it('ignora sufixo promocional no texto do usuário', () => {
    const score = scoreCandidate(
      line('Águas de Março (Official Video) - Elis Regina'),
      track({ title: 'Águas de Março', artists: ['Elis Regina'] }),
    );
    expect(classify(score)).toBe('confident');
  });

  it('título idêntico com artista errado fica abaixo de Confiante', () => {
    const score = scoreCandidate(
      line('Bohemian Rhapsody - Panic! At The Disco'),
      track({ title: 'Bohemian Rhapsody', artists: ['Queen'] }),
    );

    expect(score).toBeLessThan(CONFIDENT_THRESHOLD);
    expect(classify(score)).not.toBe('confident');
  });

  it('artista certo com título completamente diferente não é Confiante', () => {
    const score = scoreCandidate(
      line('Under Pressure - Queen'),
      track({ title: 'Bohemian Rhapsody', artists: ['Queen'] }),
    );
    expect(score).toBeLessThan(CONFIDENT_THRESHOLD);
  });

  it('tolera erro de digitação pequeno', () => {
    const score = scoreCandidate(line('Bohemian Rapsody - Queen'), track());
    expect(classify(score)).toBe('confident');
  });

  it('tolera ordem de palavras diferente pela medida de tokens', () => {
    expect(similarity('Teen Spirit Smells Like', 'Smells Like Teen Spirit')).toBe(1);
  });

  it('aplica bônus quando o artista secundário aparece na faixa', () => {
    // Título com erro de digitação de propósito: com correspondência perfeita a
    // pontuação já bate no teto de 1 e o bônus não teria como aparecer.
    const comFeat = line('Stey (feat. Justin Bieber) - The Kid LAROI');
    const semBonus = scoreCandidate(comFeat, track({ title: 'Stay', artists: ['The Kid LAROI'] }));
    const comBonus = scoreCandidate(
      comFeat,
      track({ title: 'Stay', artists: ['The Kid LAROI', 'Justin Bieber'] }),
    );

    expect(comBonus).toBeGreaterThan(semBonus);
    expect(comBonus - semBonus).toBeCloseTo(0.05, 5);
  });

  it('nunca passa de 1 nem cai abaixo de 0', () => {
    const score = scoreCandidate(
      line('Stay (feat. Justin Bieber) - The Kid LAROI'),
      track({ title: 'Stay', artists: ['The Kid LAROI', 'Justin Bieber'] }),
    );
    expect(score).toBeLessThanOrEqual(1);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('faixa sem artistas pontua apenas pelo título', () => {
    const score = scoreCandidate(line('Bohemian Rhapsody - Queen'), track({ artists: [] }));
    expect(score).toBeCloseTo(0.6, 5);
    expect(classify(score)).toBe('uncertain');
  });

  it('a versão de karaokê do mesmo título perde para a original', () => {
    const consulta = line('Bohemian Rhapsody - Queen');
    const original = scoreCandidate(consulta, track());
    const karaoke = scoreCandidate(
      consulta,
      track({ title: 'Bohemian Rhapsody', artists: ['Karaoke Band'] }),
    );

    expect(original).toBeGreaterThan(karaoke);
    expect(classify(karaoke)).not.toBe('confident');
  });
});
