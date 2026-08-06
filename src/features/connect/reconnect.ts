/**
 * Perda de sessão e reautorização (FR-035, SC-014).
 *
 * Quando a sessão de um serviço cai, três coisas acontecem **nesta ordem**: o
 * rascunho é gravado de forma síncrona (para que a fase atual sobreviva à ida ao
 * consentimento), a sessão **daquele** serviço é descartada, e a interface pede
 * reautorização informando de onde o trabalho será retomado.
 *
 * A ordem não é cosmética. Gravar depois de limpar a sessão deixaria uma janela
 * em que um fechamento de aba perderia a revisão inteira — e "nenhuma decisão
 * revisada é perdida" é justamente o que FR-035 promete.
 *
 * Nada é apagado: o rascunho sobrevive à expiração por definição (Princípio V).
 * A restauração da fase exata acontece em `restoreDraft`, na inicialização —
 * ter um único caminho de restauração é o que garante que recarga, reconexão e
 * reabertura se comportem igual.
 */

import type { ProviderId } from '@/domain/providers';
import { AppError } from '@/services/providers/errors';
import { clearSession } from '@/services/storage/sessionRepo';
import { useAppStore } from '@/store';
import { flushDraftNow } from '@/store/draftPersistence';

/**
 * Onde o trabalho será retomado, para exibir junto do pedido de reautorização
 * (FR-035). Deriva da fila; não guarda estado próprio.
 */
export function resumePointOf(provider: ProviderId): string {
  const run = useAppStore.getState().queue.runs[provider];
  return run?.phase ?? 'connect';
}

export function handleSessionLoss(provider: ProviderId, error?: AppError): void {
  const store = useAppStore.getState();

  // A gravação vem antes de qualquer mudança de estado.
  flushDraftNow();

  // Só a chave daquele serviço é tocada (invariante S2, FR-036).
  clearSession(provider);
  store.setSession(provider, null);
  store.setAuthError(error ?? new AppError('reauth_required', { provider }));
}
