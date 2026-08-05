import { describe, expect, it } from 'vitest';

import { parseLine } from '@/domain/parser';
import { classify, scoreCandidate } from '@/domain/scoring';
import type { TrackCandidateRaw } from '@/domain/types';

import reference from '../fixtures/reference-50.json';

interface ReferenceEntry {
  line: string;
  title: string;
  artists: string[];
  album: string;
  durationMs: number;
  /** Outra faixa do mesmo artista — a concorrente mais difícil de descartar. */
  otherTitle: string;
}

const entries = reference.entries as ReferenceEntry[];

function candidate(title: string, artists: string[], album: string, id: string): TrackCandidateRaw {
  return {
    uri: `spotify:track:${id}`,
    id,
    title,
    artists,
    album,
    durationMs: 200_000,
    coverUrl: null,
    externalUrl: `https://open.spotify.com/track/${id}`,
  };
}

/**
 * Concorrentes realistas para cada entrada: a faixa certa, uma versão de
 * karaokê, uma de tributo e outra faixa do mesmo artista. É o conjunto que o
 * `limit=5` da busca costuma devolver para uma consulta bem formatada.
 */
function candidatesFor(entry: ReferenceEntry): TrackCandidateRaw[] {
  return [
    candidate(entry.title, entry.artists, entry.album, 'correta'),
    candidate(`${entry.title} (Karaoke Version)`, ['Karaoke Universe'], 'Karaoke Hits', 'karaoke'),
    candidate(entry.title, ['The Tribute Players'], 'Tribute Collection', 'tributo'),
    candidate(entry.otherTitle, entry.artists, entry.album, 'outra'),
  ];
}

describe('SC-002 — dataset de referência de 50 faixas', () => {
  it('o dataset tem exatamente 50 entradas bem formatadas', () => {
    expect(entries).toHaveLength(50);
    for (const entry of entries) {
      expect(entry.line).toMatch(/\s-\s/u);
      expect(entry.title.length).toBeGreaterThan(0);
      expect(entry.artists.length).toBeGreaterThan(0);
    }
  });

  it('ao menos 90% recebem correspondência Confiante correta sem intervenção', () => {
    const falhas: string[] = [];

    for (const entry of entries) {
      const line = parseLine(entry.line, 0, 'l0');
      const scored = candidatesFor(entry)
        .map((track) => ({ track, score: scoreCandidate(line, track) }))
        .sort((a, b) => b.score - a.score);

      const best = scored[0];
      const acertou = best?.track.id === 'correta' && classify(best.score) === 'confident';
      if (!acertou) {
        falhas.push(
          `${entry.line} → ${best?.track.title ?? 'nenhuma'} (${best?.score.toFixed(3) ?? '-'})`,
        );
      }
    }

    const taxa = (entries.length - falhas.length) / entries.length;
    // A mensagem lista as falhas: é o que torna a calibração de T098 possível.
    expect(taxa, `Falhas:\n${falhas.join('\n')}`).toBeGreaterThanOrEqual(0.9);
  });

  it('nenhuma versão de karaokê é classificada como Confiante', () => {
    for (const entry of entries) {
      const line = parseLine(entry.line, 0, 'l0');
      const karaoke = candidatesFor(entry).find((track) => track.id === 'karaoke');
      expect(karaoke).toBeDefined();
      const score = scoreCandidate(line, karaoke as TrackCandidateRaw);
      expect(classify(score), `${entry.line} aceitou karaokê`).not.toBe('confident');
    }
  });
});
