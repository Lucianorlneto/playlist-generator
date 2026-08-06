/**
 * Criação da playlist e adição dos itens, no serviço corrente (FR-031 a FR-033,
 * SC-010).
 *
 * Os lotes vão **em série**, na ordem original. Paralelizar destruiria tanto a
 * garantia de ordem quanto o índice de retomada — e no YouTube, onde o lote é de
 * um item, também tornaria a retomada não idempotente (research §9).
 *
 * `committedItems` só incrementa **depois** da resposta de sucesso, e a gravação
 * desse campo no rascunho é síncrona (ver `draftPersistence`). É essa combinação
 * que faz a retomada não duplicar nem faltar item, com `batchSize` 100 ou 1.
 *
 * **Esgotamento de cota encerra sem repetir** (FR-031, SC-009): o erro é
 * terminal por construção — `AppError.terminal` — e o laço sai na hora, com a
 * playlist incompleta relatada e **não** removida (FR-032).
 */

import { buildOrderedUris, committedItemCount, remainingItems } from '@/domain/batching';
import { capabilitiesOf, type ProviderId } from '@/domain/providers';
import type { CreationProgress, CreationResult, MatchItem } from '@/domain/types';
import { toAppError, toErrorInfo } from '@/services/providers/errors';
import type { AppError } from '@/services/providers/errors';
import { providerFor } from '@/services/providers/registry';
import { clearDraft } from '@/services/storage/draftRepo';
import { useAppStore } from '@/store';

import { effectivePath } from './effectivePath';

/** Linhas que não entraram por não terem correspondência (FR-041). */
export function failedLines(items: MatchItem[]): string[] {
  return [...items]
    .sort((a, b) => a.line.index - b.line.index)
    .filter(
      (item) => item.status === 'not_found' || item.status === 'unparsed' || item.error !== null,
    )
    .map((item) => item.line.raw);
}

function buildResult(
  provider: ProviderId,
  progress: CreationProgress,
  items: MatchItem[],
  addedCount: number,
  incompleteByQuota: boolean,
): CreationResult {
  const store = useAppStore.getState();
  const displayName = store.sessions[provider]?.user.displayName ?? '';
  const name = store.playlistConfig.name.trim();

  return {
    provider,
    playlistId: progress.playlistId,
    playlistUrl: progress.playlistUrl,
    playlistName: name,
    effectivePath: effectivePath(provider, displayName, name),
    addedCount,
    skippedCount: Math.max(0, items.length - progress.orderedUris.length),
    failedLines: failedLines(items),
    incompleteByQuota,
  };
}

/** Apaga o rascunho **só** quando todos os serviços terminaram com sucesso. */
function clearDraftIfAllSucceeded(): void {
  const { queue } = useAppStore.getState();
  const runs = queue.order.map((provider) => queue.runs[provider]);
  const allDone = runs.length > 0 && runs.every((run) => run?.outcome === 'completed');
  if (allDone) clearDraft();
}

/**
 * Envia os lotes que faltam. Compartilhada pela criação inicial e pela retomada —
 * ter um único caminho é o que garante que a retomada obedeça às mesmas regras.
 */
async function sendRemainingItems(
  provider: ProviderId,
  progress: CreationProgress,
  signal?: AbortSignal,
): Promise<void> {
  const adapter = providerFor(provider);
  const batches = remainingItems(progress);
  let committed = committedItemCount(progress);

  for (const batch of batches) {
    try {
      await adapter.addItems(progress.playlistId, batch, signal);
    } catch (error) {
      const appError = toAppError(error, provider);
      const stopped: CreationProgress = { ...progress, committedItems: committed, failedAt: committed };
      useAppStore.getState().setCreation(provider, stopped);

      if (appError.kind === 'quota_exhausted') {
        // Encerra o serviço **sem repetir**. A playlist existe incompleta e não
        // é removida — repetir com o mesmo nome será bloqueado pela checagem de
        // nome duplicado, e o relato avisa disso (FR-031, FR-032).
        const items = useAppStore.getState().items();
        useAppStore.getState().dispatchRun(
          {
            type: 'quota_exhausted',
            result: buildResult(provider, stopped, items, committed, true),
            error: toErrorInfo(appError, provider),
          },
          provider,
        );
        useAppStore.getState().setCreating(false);
        return;
      }

      useAppStore.getState().setCreationError(appError);
      return;
    }

    committed += batch.length;
    // Gravado imediatamente: um item confirmado que ficasse pendurado em
    // debounce poderia ser perdido e reenviado na retomada (SC-010).
    useAppStore
      .getState()
      .setCreation(provider, { ...progress, committedItems: committed, failedAt: null });
  }

  const finished: CreationProgress = { ...progress, committedItems: committed, failedAt: null };
  const items = useAppStore.getState().items();

  useAppStore
    .getState()
    .dispatchRun(
      { type: 'created', result: buildResult(provider, finished, items, committed, false) },
      provider,
    );
  useAppStore.getState().setCreating(false);
  useAppStore.getState().setCreationError(null);

  clearDraftIfAllSucceeded();
}

export async function startCreation(signal?: AbortSignal): Promise<void> {
  const store = useAppStore.getState();
  const provider = store.currentProvider();
  if (provider === null || store.creating) return;

  const session = store.sessions[provider];
  const run = store.runFor(provider);
  // A fase `creating` é inalcançável sem `review_confirmed` — a checagem aqui é
  // a segunda barreira, não a primeira (FR-019, Princípio V).
  if (session === null || run === null || run.phase !== 'creating') return;

  const orderedUris = buildOrderedUris(run.items);
  if (orderedUris.length === 0) return;

  store.setCreating(true);
  store.setCreationError(null);
  // A seleção de destinos trava quando a primeira criação começa (FR-012).
  store.lockDestinations();

  let created: { id: string; url: string };
  try {
    created = await providerFor(provider).createPlaylist({
      session,
      name: store.playlistConfig.name,
      description: store.playlistConfig.description,
      isPublic: store.playlistConfig.isPublic,
      ...(signal === undefined ? {} : { signal }),
    });
  } catch (error) {
    const appError = toAppError(error, provider);
    if (appError.kind === 'quota_exhausted') {
      useAppStore
        .getState()
        .dispatchRun(
          { type: 'quota_exhausted', result: null, error: toErrorInfo(appError, provider) },
          provider,
        );
      useAppStore.getState().setCreating(false);
      return;
    }
    useAppStore.getState().setCreationError(appError);
    return;
  }

  const progress: CreationProgress = {
    playlistId: created.id,
    playlistUrl: created.url,
    orderedUris,
    batchSize: capabilitiesOf(provider).batchSize,
    committedItems: 0,
    failedAt: null,
  };
  useAppStore.getState().dispatchRun({ type: 'creation_started', creation: progress }, provider);

  await sendRemainingItems(provider, progress, signal);
}

/**
 * Retomada após falha parcial (FR-033). **Nunca** cria uma segunda playlist:
 * parte do `playlistId` já gravado e só reenvia o que falta (invariante N2).
 */
export async function retryRemaining(signal?: AbortSignal): Promise<void> {
  const store = useAppStore.getState();
  const provider = store.currentProvider();
  if (provider === null || store.creating) return;

  const progress = store.runFor(provider)?.creation ?? null;
  if (progress === null) return;

  store.setCreating(true);
  store.setCreationError(null);

  await sendRemainingItems(provider, progress, signal);
}

export function creationErrorOf(error: unknown, provider: ProviderId): AppError {
  return toAppError(error, provider);
}

export { committedItemCount };
