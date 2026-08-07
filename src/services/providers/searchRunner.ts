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
import { planQueries } from '@/domain/retry';
import { classifyLine, scoreForShape } from '@/domain/scoring';
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
import { queryShapeOf } from './retryPlan';
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
  /**
   * Consulta **alternativa** da linha. Ausente = o provedor não retenta.
   *
   * Emitida só quando a primeira não trouxe candidata acima do piso, a linha é
   * elegível (`003/research §6`) e há orçamento (`003/FR-009`).
   */
  retryLine?: (line: InputLine, signal?: AbortSignal) => Promise<TrackCandidateRaw[]>;
  /** Teto de retentativas da execução (invariante O4). Ausente = ilimitado. */
  retryBudget?: number;
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
  /**
   * Havia retentativa a fazer e o orçamento não permitiu. Vira
   * `attentionReason: 'retry_skipped_quota'` — não `not_found` puro (M2).
   */
  retrySkipped: boolean;
}

const UNRESOLVED: LineOutcome = { raw: [], error: null, resolved: false, retrySkipped: false };

/**
 * Orçamento de retentativa da execução, decrementado de forma **sequencialmente
 * consistente** (invariante O4).
 *
 * As linhas são buscadas em paralelo, e a decisão de retentar é tomada depois de
 * cada primeira resposta. Sem um ponto único que reserve a vaga antes de emitir
 * a requisição, várias linhas leriam o mesmo saldo e estourariam o teto juntas —
 * e SC-007 deixaria de valer por construção. `claim()` é síncrono de propósito:
 * entre a leitura e a escrita não há `await` em que outra linha possa entrar.
 */
class RetryBudget {
  private remaining: number;
  private spent = 0;

  constructor(
    limit: number | undefined,
    private readonly onClaim?: (total: number) => void,
  ) {
    this.remaining = limit ?? Number.POSITIVE_INFINITY;
  }

  claim(): boolean {
    if (this.remaining <= 0) return false;
    this.remaining -= 1;
    this.spent += 1;
    this.onClaim?.(this.spent);
    return true;
  }
}

/** Alguma candidata passou do piso? É o gatilho de FR-009. */
function hasUsableCandidate(
  line: InputLine,
  raw: readonly TrackCandidateRaw[],
  uncertain: number,
): boolean {
  return raw.some((track) => scoreForShape(line, track, uncertain) >= uncertain);
}

async function searchOne(
  line: InputLine,
  deps: ProviderSearchDeps,
  limiter: Limiter,
  budget: RetryBudget,
  signal?: AbortSignal,
): Promise<LineOutcome> {
  // A guarda **permanece**, e o seu significado é que mudou: depois do parser
  // novo, `unparsed` quer dizer "sem conteúdo alfanumérico". Removê-la faria o
  // sistema consultar `---` e `🎵`, violando `003/FR-011` e gastando cota.
  if (line.parseStatus === 'unparsed') {
    return { raw: [], error: null, resolved: true, retrySkipped: false };
  }

  try {
    const raw = await limiter.run(() => deps.searchLine(line, signal), signal);

    const uncertain = capabilitiesOf(deps.provider).thresholds.uncertain;
    // Zero resultados e resultados todos abaixo do piso contam **igualmente**:
    // o gatilho é "nenhuma candidata utilizável", não "nenhuma candidata".
    const retryLine = deps.retryLine;
    if (retryLine === undefined || hasUsableCandidate(line, raw, uncertain)) {
      return { raw, error: null, resolved: true, retrySkipped: false };
    }

    const shape = queryShapeOf(deps.provider);
    const eligible =
      planQueries(line, shape.primary, shape.retry, shape.fieldedPrimary).retry !== null;
    if (!eligible) return { raw, error: null, resolved: true, retrySkipped: false };

    if (!budget.claim()) return { raw, error: null, resolved: true, retrySkipped: true };

    // No máximo **uma** retentativa por linha e por serviço. Não há terceira.
    const retried = await limiter.run(() => retryLine(line, signal), signal);
    return {
      raw: retried.length > 0 ? retried : raw,
      error: null,
      resolved: true,
      retrySkipped: false,
    };
  } catch (error) {
    if (isAbortError(error)) throw error;
    const message = error instanceof AppError ? error.info.title : t.errors.searchLineFailed.title;
    return { raw: [], error: message, resolved: true, retrySkipped: false };
  }
}

function toItem(line: InputLine, outcome: LineOutcome, deps: ProviderSearchDeps): MatchItem {
  const base = pendingItem(line);
  if (line.parseStatus === 'unparsed') return base;
  // Cancelada antes de ser buscada: continua aguardando, não "não encontrada".
  if (!outcome.resolved) return base;
  if (outcome.error !== null) {
    return { ...base, status: 'not_found', error: outcome.error, attentionReason: 'not_found' };
  }

  const raw = outcome.raw;

  const thresholds = capabilitiesOf(deps.provider).thresholds;

  const candidates: TrackCandidate[] = raw
    .map((track) => {
      const hints = deps.hintsOf?.(track, raw) ?? track.versionHints ?? [];
      const bonus = deps.bonusOf?.(track) ?? 0;
      // A via de pontuação é escolhida pela **forma** da linha: a explícita
      // mantém a fórmula da 001 (SC-011), a livre usa a cobertura combinada.
      const base =
        deps.scoreOf?.(line, track) ?? scoreForShape(line, track, thresholds.uncertain);
      const score = Math.min(1, base + bonus);
      return {
        ...track,
        ...(hints.length === 0 ? {} : { versionHints: hints }),
        score,
      };
    })
    .sort((a, b) => b.score - a.score);

  // `classifyLine` em vez de `classifyFor`: a regra de margem precisa ver a
  // **segunda** candidata, o que uma função de pontuação isolada não vê.
  const { status, attentionReason } = classifyLine(
    line,
    candidates,
    thresholds,
    outcome.retrySkipped,
  );

  const best = candidates[0];

  return {
    ...base,
    status,
    candidates,
    selectedUri: status === 'not_found' ? null : (best?.uri ?? null),
    // Só Confiante entra marcada; Incerta espera confirmação visual (FR-023).
    included: status === 'confident',
    attentionReason,
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
  const budget = new RetryBudget(deps.retryBudget, ctx.onRetry);
  const outcomes: LineOutcome[] = lines.map(() => ({ ...UNRESOLVED }));
  let done = 0;

  await Promise.allSettled(
    lines.map(async (line, index) => {
      const outcome = await searchOne(line, deps, limiter, budget, ctx.signal);
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

  return lines.map((line, index) => toItem(line, outcomes[index] ?? UNRESOLVED, deps));
}
