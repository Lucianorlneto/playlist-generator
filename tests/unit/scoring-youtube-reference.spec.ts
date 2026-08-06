import { describe, expect, it } from 'vitest';

import { parseLine } from '@/domain/parser';
import { capabilitiesOf } from '@/domain/providers';
import { channelBonus, classifyFor, scoreCandidate } from '@/domain/scoring';
import type { TrackCandidateRaw } from '@/domain/types';
import { stripDecorations, versionHints } from '@/domain/versionHints';
import { channelAsArtist, decodeHtmlEntities } from '@/services/providers/youtube/search';
import { isoDurationToMs } from '@/services/providers/youtube/videos';

import reference from '../fixtures/reference-50-youtube.json';

interface FixtureCandidate {
  videoId: string;
  /** Como `search.list` devolve: com entidades HTML por decodificar. */
  title: string;
  channel: string;
  /** ISO-8601, como `contentDetails.duration`. */
  duration: string;
}

interface ReferenceEntry {
  line: string;
  expectedVideoId: string;
  candidates: FixtureCandidate[];
}

const entries = reference.entries as ReferenceEntry[];
const THRESHOLDS = capabilitiesOf('youtube').thresholds;

/**
 * Reproduz exatamente o caminho do adaptador: decodifica entidades, usa o canal
 * sem sufixo como artista, pontua contra o título limpo e soma o bônus de canal
 * canônico (research §7).
 */
function toCandidate(raw: FixtureCandidate): TrackCandidateRaw {
  const title = decodeHtmlEntities(raw.title);
  const channel = decodeHtmlEntities(raw.channel);
  return {
    uri: raw.videoId,
    id: raw.videoId,
    title,
    artists: [channelAsArtist(channel)],
    album: '',
    durationMs: isoDurationToMs(raw.duration),
    coverUrl: null,
    externalUrl: '',
    channel,
  };
}

function scoreOf(line: ReturnType<typeof parseLine>, candidate: TrackCandidateRaw): number {
  const base = scoreCandidate(line, { ...candidate, title: stripDecorations(candidate.title) });
  const bonus = candidate.channel === undefined ? 0 : channelBonus(candidate.channel);
  return Math.min(1, base + bonus);
}

function rank(entry: ReferenceEntry) {
  const line = parseLine(entry.line, 0, 'l0');
  const candidates = entry.candidates.map(toCandidate);
  const durations = candidates.map((candidate) => candidate.durationMs);

  return candidates
    .map((candidate) => {
      const hints = versionHints(candidate.title, candidate.durationMs, durations);
      const score = scoreOf(line, candidate);
      return { candidate, score, hints, status: classifyFor(score, THRESHOLDS, hints) };
    })
    .sort((a, b) => b.score - a.score);
}

describe('SC-006 — dataset de referência do catálogo de vídeo', () => {
  it('o dataset tem 50 entradas, cada uma com até 5 candidatas', () => {
    expect(entries).toHaveLength(50);
    for (const entry of entries) {
      expect(entry.candidates.length).toBeGreaterThan(0);
      expect(entry.candidates.length).toBeLessThanOrEqual(5);
      expect(entry.candidates.some((c) => c.videoId === entry.expectedVideoId)).toBe(true);
    }
  });

  it('as durações vêm em ISO-8601 e convertem para milissegundos', () => {
    for (const entry of entries) {
      for (const candidate of entry.candidates) {
        expect(candidate.duration).toMatch(/^PT/u);
        expect(isoDurationToMs(candidate.duration)).toBeGreaterThan(0);
      }
    }
  });

  /** O critério de SC-006. */
  it('ao menos 75% recebem correspondência Confiante correta sem intervenção', () => {
    const falhas: string[] = [];

    for (const entry of entries) {
      const ranked = rank(entry);
      const melhor = ranked[0];
      const acertou =
        melhor?.candidate.id === entry.expectedVideoId && melhor.status === 'confident';
      if (!acertou) {
        falhas.push(
          `${entry.line} → ${melhor?.candidate.title ?? 'nenhuma'} ` +
            `(${melhor?.score.toFixed(3) ?? '-'} / ${melhor?.status ?? '-'})`,
        );
      }
    }

    const taxa = (entries.length - falhas.length) / entries.length;
    // A mensagem lista as falhas: é o que torna a calibração possível sem tocar
    // na lógica de pontuação.
    expect(taxa, `Falhas:\n${falhas.join('\n')}`).toBeGreaterThanOrEqual(0.75);
  });

  /**
   * O erro caro do catálogo de vídeo, nomeado em research §7: aceitar o cover.
   * Nenhuma dessas variações pode passar como Confiante.
   */
  it('nenhuma versão de karaokê, cover ou ao vivo é classificada como Confiante', () => {
    const ofensores: string[] = [];

    for (const entry of entries) {
      for (const avaliada of rank(entry)) {
        if (avaliada.candidate.id === entry.expectedVideoId) continue;
        if (avaliada.status === 'confident') {
          ofensores.push(`${entry.line} aceitou "${avaliada.candidate.title}"`);
        }
      }
    }

    expect(ofensores).toEqual([]);
  });

  /** Invariante K2: indício de versão rebaixa, seja qual for a pontuação. */
  it('toda candidata com indício de versão é rebaixada de Confiante', () => {
    for (const entry of entries) {
      for (const avaliada of rank(entry)) {
        if (avaliada.hints.length > 0) {
          expect(avaliada.status, `${avaliada.candidate.title}`).not.toBe('confident');
        }
      }
    }
  });

  it('o limiar do YouTube é mais exigente que o do Spotify (FR-023)', () => {
    expect(THRESHOLDS.confident).toBeGreaterThan(capabilitiesOf('spotify').thresholds.confident);
  });
});

describe('research §7 — bônus de canal canônico', () => {
  it(' - Topic vale mais que VEVO, e o resto vale zero', () => {
    expect(channelBonus('Queen - Topic')).toBeGreaterThan(channelBonus('QueenVEVO'));
    expect(channelBonus('QueenVEVO')).toBeGreaterThan(0);
    expect(channelBonus('Marina Reis')).toBe(0);
    expect(channelBonus('Karaoke Universe')).toBe(0);
  });

  it('a comparação ignora caixa e espaços de borda', () => {
    expect(channelBonus('  Queen - TOPIC  ')).toBe(channelBonus('Queen - Topic'));
    expect(channelBonus('queenvevo')).toBe(channelBonus('QueenVEVO'));
  });
});

describe('contrato §3 — decodificação obrigatória antes de pontuar', () => {
  it('decodifica as entidades que a API devolve', () => {
    expect(decodeHtmlEntities('Sweet Child O&#39;Mine')).toBe("Sweet Child O'Mine");
    expect(decodeHtmlEntities('Simon &amp; Garfunkel')).toBe('Simon & Garfunkel');
    expect(decodeHtmlEntities('&quot;Heroes&quot;')).toBe('"Heroes"');
    expect(decodeHtmlEntities('sem entidade')).toBe('sem entidade');
  });

  it('remove os sufixos de canal canônico para comparar com o artista', () => {
    expect(channelAsArtist('Queen - Topic')).toBe('Queen');
    expect(channelAsArtist('QueenVEVO')).toBe('Queen');
    expect(channelAsArtist('Marina Reis')).toBe('Marina Reis');
  });
});
