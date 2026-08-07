/**
 * Os critérios **comparativos** entre formas de escrita, medidos contra as
 * mesmas 50 faixas escritas de quatro maneiras (`003/research §13`).
 *
 * Sete dos onze critérios de sucesso são comparações entre formas, e sem o mesmo
 * conjunto de faixas nas três não há o que comparar. Esta suíte cobre três:
 *
 * - **SC-002**: o acerto automático sem separador fica no máximo 5 pontos
 *   percentuais abaixo do formato explícito;
 * - **SC-003**: ≥ 90% das faixas escritas só com o título têm a gravação
 *   pretendida **entre as candidatas** — não necessariamente escolhida sozinha,
 *   que é o que SC-010 mede e só no catálogo musical;
 * - **SC-006**: 100% de equivalência entre a forma acentuada/capitalizada e a
 *   mesma linha sem acento em caixa baixa.
 *
 * As candidatas concorrentes são geradas aqui, como em `scoring-reference`: a
 * faixa certa, uma versão de karaokê, um tributo com o mesmo título e outra
 * faixa do mesmo artista. É o conjunto que `limit=5` costuma devolver.
 */

import { describe, expect, it } from 'vitest';

import { capabilitiesOf } from '@/domain/providers';
import { parseLine } from '@/domain/parser';
import { classifyLine, scoreForShape } from '@/domain/scoring';
import type { InputLine, TrackCandidate, TrackCandidateRaw } from '@/domain/types';

import reference from '../fixtures/reference-shapes.json';

interface ShapeEntry {
  explicit: string;
  free: string;
  freePlain: string;
  titleOnly: string;
  expectedId: string;
  title: string;
  artists: string[];
  album: string;
  durationMs: number;
  otherTitle: string;
}

const entries = reference.entries as ShapeEntry[];
const THRESHOLDS = capabilitiesOf('spotify').thresholds;

function candidate(
  title: string,
  artists: string[],
  album: string,
  id: string,
): TrackCandidateRaw {
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

function candidatesFor(entry: ShapeEntry): TrackCandidateRaw[] {
  return [
    candidate(entry.title, entry.artists, entry.album, 'correta'),
    candidate(`${entry.title} (Karaoke Version)`, ['Karaoke Universe'], 'Karaoke Hits', 'karaoke'),
    candidate(entry.title, ['The Tribute Players'], 'Tribute Collection', 'tributo'),
    candidate(entry.otherTitle, entry.artists, entry.album, 'outra'),
  ];
}

interface Outcome {
  status: string;
  best: TrackCandidate | undefined;
  candidates: TrackCandidate[];
}

function resolve(entry: ShapeEntry, raw: string): Outcome {
  const line: InputLine = parseLine(raw, 0, 'l0');
  const candidates: TrackCandidate[] = candidatesFor(entry)
    .map((track) => ({ ...track, score: scoreForShape(line, track, THRESHOLDS.uncertain) }))
    .sort((a, b) => b.score - a.score);

  const { status } = classifyLine(line, candidates, THRESHOLDS);
  return { status, best: candidates[0], candidates };
}

/** Acertou sozinha: a melhor é a correta **e** o sistema a marcou como confiante. */
function autoCorrect(entry: ShapeEntry, raw: string): boolean {
  const { status, best } = resolve(entry, raw);
  return status === 'confident' && best?.id === 'correta';
}

function rate(fn: (entry: ShapeEntry) => boolean): number {
  return entries.filter(fn).length / entries.length;
}

describe('a fixture cobre as mesmas 50 faixas nas quatro formas', () => {
  it('tem 50 entradas, e as formas derivam umas das outras', () => {
    expect(entries).toHaveLength(50);
    for (const entry of entries) {
      // Sem distinção de caixa: `Bad Guy - Billie Eilish` traz o título como
      // `bad guy`, que é a grafia do próprio catálogo.
      expect(entry.explicit.toLocaleLowerCase('pt-BR')).toContain(
        entry.title.toLocaleLowerCase('pt-BR'),
      );
      expect(entry.free).toBe(`${entry.title} ${entry.artists[0]}`);
      expect(entry.titleOnly).toBe(entry.title);
      expect(entry.freePlain).toBe(
        entry.free.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR'),
      );
    }
  });

  it('a forma explícita corta, a livre não (invariante L1)', () => {
    for (const entry of entries) {
      expect(parseLine(entry.explicit, 0, 'l0').shape, entry.explicit).toBe('explicit');
      expect(parseLine(entry.free, 0, 'l0').shape, entry.free).toBe('free');
      expect(parseLine(entry.titleOnly, 0, 'l0').artist, entry.titleOnly).toBe('');
    }
  });
});

describe('SC-002 — a forma livre não fica 5 pontos abaixo da explícita', () => {
  it('a taxa de acerto automático sem separador acompanha a do formato explícito', () => {
    const explicita = rate((entry) => autoCorrect(entry, entry.explicit));
    const livre = rate((entry) => autoCorrect(entry, entry.free));

    const falhas = entries
      .filter((entry) => !autoCorrect(entry, entry.free))
      .map((entry) => {
        const { status, best } = resolve(entry, entry.free);
        return `${entry.free} → ${best?.title ?? 'nenhuma'} (${best?.score.toFixed(3) ?? '-'}, ${status})`;
      });

    expect(
      livre,
      `explícita ${(explicita * 100).toFixed(0)}% · livre ${(livre * 100).toFixed(0)}%\nFalhas:\n${falhas.join('\n')}`,
    ).toBeGreaterThanOrEqual(explicita - 0.05);
  });

  it('a forma explícita continua acertando ao menos 90% (não regressão)', () => {
    expect(rate((entry) => autoCorrect(entry, entry.explicit))).toBeGreaterThanOrEqual(0.9);
  });
});

describe('SC-003 — o título isolado traz a gravação pretendida entre as candidatas', () => {
  it('≥ 90% das linhas só-título têm a faixa certa entre as candidatas', () => {
    const comACerta = rate((entry) => {
      const { candidates } = resolve(entry, entry.titleOnly);
      return candidates.some((candidate) => candidate.id === 'correta');
    });

    expect(comACerta).toBeGreaterThanOrEqual(0.9);
  });

  /**
   * SC-004 no recorte desta fixture: cada entrada tem um tributo com o **mesmo
   * título**, e nenhuma linha só-título pode escolher sozinha entre os dois. É a
   * regra de margem operando exatamente onde deve.
   */
  it('SC-004 — nenhuma linha só-título escolhe o tributo sozinha', () => {
    for (const entry of entries) {
      const { status, best } = resolve(entry, entry.titleOnly);
      if (status !== 'confident') continue;
      expect(best?.id, `${entry.titleOnly} marcou ${best?.title} sozinha`).toBe('correta');
    }
  });

  it('nenhuma versão de karaokê é marcada como confiante em forma alguma', () => {
    for (const entry of entries) {
      for (const raw of [entry.explicit, entry.free, entry.titleOnly]) {
        const { status, best } = resolve(entry, raw);
        if (status === 'confident') {
          expect(best?.id, `${raw} aceitou karaokê`).not.toBe('karaoke');
        }
      }
    }
  });
});

describe('SC-006 — acento e caixa não mudam o resultado', () => {
  it('100% das faixas dão o mesmo desfecho com e sem acento, em caixa baixa', () => {
    const divergentes: string[] = [];

    for (const entry of entries) {
      const acentuada = resolve(entry, entry.free);
      const plana = resolve(entry, entry.freePlain);

      if (acentuada.status !== plana.status || acentuada.best?.id !== plana.best?.id) {
        divergentes.push(
          `${entry.free}: ${acentuada.status}/${acentuada.best?.id} ≠ ${plana.status}/${plana.best?.id}`,
        );
      }
    }

    expect(divergentes, `Divergências:\n${divergentes.join('\n')}`).toHaveLength(0);
  });

  it('a pontuação é idêntica, não apenas o desfecho', () => {
    for (const entry of entries) {
      expect(resolve(entry, entry.freePlain).best?.score, entry.free).toBeCloseTo(
        resolve(entry, entry.free).best?.score ?? -1,
        10,
      );
    }
  });
});
