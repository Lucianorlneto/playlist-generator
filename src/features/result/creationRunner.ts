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
import { AppError, isSessionLevel, toAppError, toErrorInfo } from '@/services/providers/errors';
import { providerFor } from '@/services/providers/registry';
import { handleSessionLoss } from '@/features/connect/reconnect';
import { clearDraft } from '@/services/storage/draftRepo';
import { useAppStore } from '@/store';
import { flushDraftNow } from '@/store/draftPersistence';

import { effectivePath } from './effectivePath';

/**
 * Linhas que não entraram por não terem correspondência (FR-041).
 *
 * Devolve texto e índice **da mesma travessia**, para que não exista o estado em
 * que as duas listas discordam sobre qual numeral pertence a qual linha.
 */
export function failedEntries(items: MatchItem[]): { lines: string[]; indices: number[] } {
  const failed = [...items]
    .sort((a, b) => a.line.index - b.line.index)
    .filter(
      (item) => item.status === 'not_found' || item.status === 'unparsed' || item.error !== null,
    );

  return {
    lines: failed.map((item) => item.line.raw),
    indices: failed.map((item) => item.line.index),
  };
}

/** O texto puro, para quem só precisa do que se copia. */
export function failedLines(items: MatchItem[]): string[] {
  return failedEntries(items).lines;
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
    failedLines: failedEntries(items).lines,
    failedIndices: failedEntries(items).indices,
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

      if (isSessionLevel(appError)) {
        // FR-027: a autorização caiu no meio da adição. Isto **não** é falha da
        // criação — a playlist existe, o índice de confirmação está gravado e a
        // execução é retomável. A ordem é a mesma da busca: rascunho primeiro,
        // depois sessão, depois estado.
        handleSessionLoss(provider, appError);
        useAppStore.getState().dispatchRun({ type: 'session_lost', from: 'creating' }, provider);
        useAppStore.getState().setCreating(false);
        // Gravação imediata da fase nova, pelo mesmo motivo que o índice de
        // itens confirmados é gravado síncrono: o pedido precisa sobreviver ao
        // fechamento da aba e à ida ao consentimento (A6, FR-018).
        flushDraftNow();
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
    // Registrado aqui porque é o único instante em que a conta que **de fato**
    // recebeu a playlist é conhecida com certeza (`004/FR-031`).
    accountId: session.user.id,
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

  const veredito = resumeVerdict(provider, progress);
  // Sem sessão, **nada** acontece: nem retomada nem encerramento (R4, FR-016).
  // Encerrar aqui transformaria "o usuário ainda não reconectou" em desfecho
  // definitivo, descartando o trabalho que a execução está justamente esperando
  // para concluir.
  if (veredito === 'no_session') return;
  if (veredito === 'other_account') {
    finishAsPartialInAnotherAccount(provider, progress);
    return;
  }

  store.setCreating(true);
  store.setCreationError(null);

  await sendRemainingItems(provider, progress, signal);
}

/**
 * Três respostas possíveis, e cada uma leva a um caminho diferente
 * (`004/FR-031`, R4):
 *
 * - `no_session`: ainda não reconectou. Não é desfecho — é espera.
 * - `other_account`: reconectou a outra conta. A playlist parcial está na
 *   antiga, e a confirmação de revisão não se transfere (D2 do plano).
 * - `same_account`: retoma normalmente.
 *
 * `accountId` desconhecido — rascunho anterior a esta feature — conta como
 * `same_account`: tratar ausência como divergência encerraria como parcial uma
 * execução perfeitamente retomável, que é o dano oposto ao que o requisito evita.
 */
type ResumeVerdict = 'no_session' | 'other_account' | 'same_account';

function resumeVerdict(provider: ProviderId, progress: CreationProgress): ResumeVerdict {
  const current = useAppStore.getState().sessions[provider];
  if (current === null) return 'no_session';
  if (progress.accountId === null) return 'same_account';
  return current.user.id === progress.accountId ? 'same_account' : 'other_account';
}

/**
 * Reconectar a outra conta encerra o destino como **parcial**, com a contagem
 * real do que foi escrito (FR-031).
 *
 * Não há retomada possível: a playlist está na conta antiga, e a confirmação de
 * revisão que o usuário deu não se transfere para outra conta — é o limite
 * explícito de D2 do plano. Criar uma segunda playlist na conta nova deixaria a
 * primeira órfã e incompleta, e escreveria sem a confirmação que o Princípio V
 * exige.
 */
function finishAsPartialInAnotherAccount(
  provider: ProviderId,
  progress: CreationProgress,
): void {
  const items = useAppStore.getState().items();
  const committed = committedItemCount(progress);

  // O resultado entra **antes** do encerramento: `outcomeOf` só distingue
  // "parcial" de "falhou" pela existência da playlist, e uma execução já
  // encerrada é imutável (R2) — inverter a ordem relataria "falhou" sobre uma
  // playlist que existe na conta do usuário.
  useAppStore
    .getState()
    .setResult(provider, buildResult(provider, progress, items, committed, false));
  useAppStore
    .getState()
    .dispatchRun(
      {
        type: 'failed',
        error: toErrorInfo(new AppError('reauth_required', { provider }), provider),
      },
      provider,
    );
  useAppStore.getState().setCreating(false);
}

export function creationErrorOf(error: unknown, provider: ProviderId): AppError {
  return toAppError(error, provider);
}

export { committedItemCount };
