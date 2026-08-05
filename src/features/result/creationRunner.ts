/**
 * Criação da playlist e adição das faixas (FR-032, FR-033, SC-009).
 *
 * Os lotes vão **em série**, na ordem original. Paralelizar destruiria tanto a
 * garantia de ordem de FR-019 quanto o índice de retomada — e, com no máximo
 * três lotes no pior caso realista, não haveria ganho de tempo relevante
 * (research §10).
 *
 * `committedBatches` só incrementa **depois** da resposta de sucesso, e a
 * gravação desse campo no rascunho é síncrona (ver `draftPersistence`). É essa
 * combinação que faz a retomada não duplicar nem faltar faixa.
 */

import { buildOrderedUris, committedTrackCount, remainingBatches } from '@/domain/batching';
import {
  BATCH_SIZE,
  type CreationProgress,
  type CreationResult,
  type MatchItem,
} from '@/domain/types';
import { toAppError } from '@/services/spotify/errors';
import { addTracks, createPlaylist } from '@/services/spotify/playlists';
import { clearDraft } from '@/services/storage/draftRepo';
import { useAppStore } from '@/store';

import { effectivePath } from './effectivePath';

/** Linhas que não entraram por não terem correspondência (FR-039, FR-040). */
export function failedLines(items: MatchItem[]): string[] {
  return [...items]
    .sort((a, b) => a.line.index - b.line.index)
    .filter(
      (item) => item.status === 'not_found' || item.status === 'unparsed' || item.error !== null,
    )
    .map((item) => item.line.raw);
}

function buildResult(progress: CreationProgress, items: MatchItem[]): CreationResult {
  const store = useAppStore.getState();
  const displayName = store.session?.user.displayName ?? '';
  const name = store.playlistConfig.name.trim();

  return {
    playlistId: progress.playlistId,
    playlistUrl: progress.playlistUrl,
    playlistName: name,
    effectivePath: effectivePath(displayName, name),
    addedCount: progress.orderedUris.length,
    skippedCount: Math.max(0, items.length - progress.orderedUris.length),
    failedLines: failedLines(items),
  };
}

/**
 * Envia os lotes que faltam. Compartilhada pela criação inicial e pela retomada —
 * ter um único caminho é o que garante que a retomada obedeça às mesmas regras.
 */
async function sendRemainingBatches(
  progress: CreationProgress,
  signal?: AbortSignal,
): Promise<void> {
  const store = useAppStore.getState();
  const batches = remainingBatches(progress);
  let committed = progress.committedBatches;

  for (const batch of batches) {
    try {
      await addTracks(progress.playlistId, batch, signal);
    } catch (error) {
      useAppStore.getState().setCreation({
        ...progress,
        committedBatches: committed,
        failedAt: committed,
      });
      useAppStore.getState().setCreationError(toAppError(error));
      return;
    }

    committed += 1;
    // Gravado imediatamente: um lote confirmado que ficasse pendurado em debounce
    // poderia ser perdido e reenviado na retomada (SC-009).
    useAppStore
      .getState()
      .setCreation({ ...progress, committedBatches: committed, failedAt: null });
  }

  const finished: CreationProgress = {
    ...progress,
    committedBatches: committed,
    failedAt: null,
  };

  const items = useAppStore.getState().items;
  useAppStore.getState().setResult(buildResult(finished, items));
  useAppStore.getState().setCreating(false);
  useAppStore.getState().setCreationError(null);

  // Criação bem-sucedida apaga o rascunho (FR-045). A credencial e a sessão
  // continuam onde estavam.
  useAppStore.getState().setCreation(null);
  clearDraft();
  store.goToStep('result');
}

export async function startCreation(signal?: AbortSignal): Promise<void> {
  const store = useAppStore.getState();
  const session = store.session;
  if (session === null || store.creating) return;

  const orderedUris = buildOrderedUris(store.items);
  if (orderedUris.length === 0) return;

  store.setCreating(true);
  store.setCreationError(null);
  store.goToStep('result');

  let created: { id: string; url: string };
  try {
    created = await createPlaylist({
      userId: session.user.id,
      name: store.playlistConfig.name,
      description: store.playlistConfig.description,
      isPublic: store.playlistConfig.isPublic,
      ...(signal === undefined ? {} : { signal }),
    });
  } catch (error) {
    useAppStore.getState().setCreationError(toAppError(error));
    return;
  }

  const progress: CreationProgress = {
    playlistId: created.id,
    playlistUrl: created.url,
    orderedUris,
    batchSize: BATCH_SIZE,
    committedBatches: 0,
    failedAt: null,
  };
  useAppStore.getState().setCreation(progress);

  await sendRemainingBatches(progress, signal);
}

/**
 * Retomada após falha parcial (FR-033). **Nunca** cria uma segunda playlist:
 * parte do `playlistId` já gravado e só reenvia o que falta.
 */
export async function retryRemaining(signal?: AbortSignal): Promise<void> {
  const store = useAppStore.getState();
  const progress = store.creation;
  if (progress === null || store.creating) return;

  store.setCreating(true);
  store.setCreationError(null);

  await sendRemainingBatches(progress, signal);
}

export { committedTrackCount };
