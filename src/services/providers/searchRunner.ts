/**
 * Orquestração da busca, comum aos dois provedores: limitador → busca →
 * enriquecimento → pontuação → classificação.
 *
 * Existe para que `PlaylistProvider.search` seja escrito **uma vez**. O que cada
 * catálogo tem de próprio entra por injeção — como traduzir uma linha em
 * consulta, como enriquecer o resultado, que bônus de canal aplicar, que
 * indícios de versão marcar — e a mecânica de concorrência, cancelamento e
 * isolamento de falha fica aqui.
 *
 * Duas garantias que este módulo sustenta:
 *
 * - **a falha de uma linha não aborta as demais**: cada busca é capturada
 *   individualmente e vira `error` naquele item;
 * - **cancelar funciona em qualquer momento**, inclusive durante a espera por
 *   limitação, porque o mesmo `AbortSignal` atravessa o limitador e o backoff do
 *   cliente HTTP (`001/FR-026`, SC-011).
 */

import { capabilitiesOf, type ProviderId } from '@/domain/providers';
import { classifyFor, scoreCandidate } from '@/domain/scoring';
import {
  pendingItem,
  type InputLine,
  type MatchItem,
  type TrackCandidate,
  type TrackCandidateRaw,
  type VersionHint,
} from '@/domain/types';
import { t } from '@/i18n/pt-BR';
import { isAbortError, limiterFor, type Limiter } from '@/services/rate-limiter';

import { AppError } from './errors';
import type { SearchContext } from './types';

export interface ProviderSearchDeps {
  provider: ProviderId;
  /** Candidatas cruas de uma linha, já traduzidas para o modelo comum. */
  searchLine: (line: InputLine, signal?: AbortSignal) => Promise<TrackCandidateRaw[]>;
  /**
   * Completa em lote o que a busca não devolveu — no YouTube, duração e canal
   * (research §4). Recebe **todas** as candidatas de todas as linhas e devolve
   * as versões completas, indexadas por `id`.
   */
  enrich?: (
    candidates: TrackCandidateRaw[],
    signal?: AbortSignal,
  ) => Promise<Map<string, TrackCandidateRaw>>;
  /**
   * Pontuação bruta da candidata. O padrão é `scoreCandidate`; o catálogo de
   * vídeo substitui para limpar as decorações editoriais do título **antes** de
   * comparar, sem alterar o título exibido (research §7).
   */
  scoreOf?: (line: InputLine, candidate: TrackCandidateRaw) => number;
  /** Bônus de canal canônico, somado à pontuação (research §7). */
  bonusOf?: (candidate: TrackCandidateRaw) => number;
  /** Indícios de versão diferente daquela linha (FR-025). */
  hintsOf?: (candidate: TrackCandidateRaw, siblings: TrackCandidateRaw[]) => VersionHint[];
  limiter?: Limiter;
}

interface LineOutcome {
  raw: TrackCandidateRaw[];
  error: string | null;
  /**
   * `false` enquanto a linha não foi buscada. É o que distingue "não achei" de
   * "nem cheguei a procurar": ao cancelar, as linhas pendentes voltam como
   * `pending`, não como `not_found` (SC-011).
   */
  resolved: boolean;
}

async function searchOne(
  line: InputLine,
  deps: ProviderSearchDeps,
  limiter: Limiter,
  signal?: AbortSignal,
): Promise<LineOutcome> {
  if (line.parseStatus === 'unparsed') return { raw: [], error: null, resolved: true };

  try {
    const raw = await limiter.run(() => deps.searchLine(line, signal), signal);
    return { raw, error: null, resolved: true };
  } catch (error) {
    if (isAbortError(error)) throw error;
    const message = error instanceof AppError ? error.info.title : t.errors.searchLineFailed.title;
    return { raw: [], error: message, resolved: true };
  }
}

function toItem(line: InputLine, outcome: LineOutcome, deps: ProviderSearchDeps): MatchItem {
  const base = pendingItem(line);
  if (line.parseStatus === 'unparsed') return base;
  // Cancelada antes de ser buscada: continua aguardando, não "não encontrada".
  if (!outcome.resolved) return base;
  if (outcome.error !== null) return { ...base, status: 'not_found', error: outcome.error };

  const raw = outcome.raw;

  const thresholds = capabilitiesOf(deps.provider).thresholds;

  const candidates: TrackCandidate[] = raw
    .map((track) => {
      const hints = deps.hintsOf?.(track, raw) ?? track.versionHints ?? [];
      const bonus = deps.bonusOf?.(track) ?? 0;
      const base = deps.scoreOf?.(line, track) ?? scoreCandidate(line, track);
      const score = Math.min(1, base + bonus);
      return {
        ...track,
        ...(hints.length === 0 ? {} : { versionHints: hints }),
        score,
      };
    })
    .sort((a, b) => b.score - a.score);

  const best = candidates[0];
  if (best === undefined) return { ...base, status: 'not_found', candidates: [] };

  // Um indício de versão rebaixa `confident` → `uncertain` independentemente da
  // pontuação (invariante K2): o erro caro é aceitar o cover em silêncio.
  const status = classifyFor(best.score, thresholds, best.versionHints ?? []);

  return {
    ...base,
    status,
    candidates,
    selectedUri: status === 'not_found' ? null : best.uri,
    // Só Confiante entra marcada; Incerta espera confirmação visual (FR-023).
    included: status === 'confident',
  };
}

/**
 * Resolve a lista inteira. Os itens saem na ordem original das linhas — a
 * concorrência está na execução, não no resultado.
 */
export async function runProviderSearch(
  lines: InputLine[],
  ctx: SearchContext,
  deps: ProviderSearchDeps,
): Promise<MatchItem[]> {
  const limiter = deps.limiter ?? limiterFor(deps.provider);
  const outcomes: LineOutcome[] = lines.map(() => ({ raw: [], error: null, resolved: false }));
  let done = 0;

  await Promise.allSettled(
    lines.map(async (line, index) => {
      const outcome = await searchOne(line, deps, limiter, ctx.signal);
      outcomes[index] = outcome;
      done += 1;
      ctx.onProgress?.(done, lines.length);
    }),
  );

  if (deps.enrich !== undefined) {
    const all = outcomes.flatMap((outcome) => outcome.raw);
    if (all.length > 0) {
      // Falha do enriquecimento degrada a exibição, não a busca: sem duração o
      // item continua utilizável, e derrubar a lista inteira seria pior.
      let enriched: Map<string, TrackCandidateRaw>;
      try {
        enriched = await deps.enrich(all, ctx.signal);
      } catch (error) {
        if (isAbortError(error)) throw error;
        enriched = new Map();
      }
      for (const outcome of outcomes) {
        outcome.raw = outcome.raw.map((candidate) => enriched.get(candidate.id) ?? candidate);
      }
    }
  }

  return lines.map((line, index) =>
    toItem(line, outcomes[index] ?? { raw: [], error: null, resolved: false }, deps),
  );
}
