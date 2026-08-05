/**
 * Orquestração da busca: limitador → busca → pontuação → deduplicação.
 *
 * Duas garantias que este módulo existe para sustentar:
 * - **a falha de uma linha não aborta as demais** (contrato §6): cada busca é
 *   capturada individualmente e vira `error` naquele item;
 * - **cancelar funciona em qualquer momento**, inclusive durante a espera por
 *   limitação, porque o mesmo `AbortSignal` atravessa o limitador e o backoff do
 *   cliente HTTP (FR-026, SC-011).
 */

import { markDuplicates } from '@/domain/dedupe';
import { classify, scoreCandidate } from '@/domain/scoring';
import { pendingItem, type InputLine, type MatchItem, type TrackCandidate } from '@/domain/types';
import { t } from '@/i18n/pt-BR';
import { isAbortError, limiter as sharedLimiter, type Limiter } from '@/services/rate-limiter';
import { AppError } from '@/services/spotify/errors';
import { searchTrack } from '@/services/spotify/search';

export interface RunMatchOptions {
  signal: AbortSignal;
  /** Chamado a cada linha concluída, com a contagem acumulada. */
  onProgress?: (done: number, total: number) => void;
  /** Chamado a cada item resolvido, para atualização incremental da tela. */
  onItem?: (item: MatchItem) => void;
  limiter?: Limiter;
}

/** Resolve uma única linha. Usada tanto no lote quanto na re-busca por linha (FR-017). */
export async function matchLine(
  line: InputLine,
  signal: AbortSignal,
  limiter: Limiter = sharedLimiter,
): Promise<MatchItem> {
  const base = pendingItem(line);

  if (line.parseStatus === 'unparsed') return base;

  try {
    const raw = await limiter.run(() => searchTrack(line, signal), signal);

    const candidates: TrackCandidate[] = raw
      .map((track) => ({ ...track, score: scoreCandidate(line, track) }))
      .sort((a, b) => b.score - a.score);

    const best = candidates[0];
    if (best === undefined) {
      return { ...base, status: 'not_found', candidates: [] };
    }

    const status = classify(best.score);

    return {
      ...base,
      status,
      candidates,
      selectedUri: status === 'not_found' ? null : best.uri,
      // Só Confiante entra marcada; Incerta espera confirmação visual (FR-025).
      included: status === 'confident',
    };
  } catch (error) {
    if (isAbortError(error)) throw error;
    const message = error instanceof AppError ? error.info.title : t.errors.searchLineFailed.title;
    return { ...base, status: 'not_found', error: message };
  }
}

/**
 * Resolve a lista inteira. Os itens saem na ordem original — a concorrência está
 * na execução, não no resultado (FR-019).
 */
export async function runMatching(
  lines: InputLine[],
  options: RunMatchOptions,
): Promise<MatchItem[]> {
  const { signal, onProgress, onItem, limiter = sharedLimiter } = options;
  // Pré-preenchido: se o usuário cancelar no meio, as linhas ainda não buscadas
  // voltam como `pending` e o que já foi encontrado é preservado (SC-011).
  const results = lines.map((line) => pendingItem(line));
  let done = 0;

  await Promise.allSettled(
    lines.map(async (line, index) => {
      const item = await matchLine(line, signal, limiter);
      results[index] = item;
      done += 1;
      onItem?.(item);
      onProgress?.(done, lines.length);
    }),
  );

  return markDuplicates(results);
}
