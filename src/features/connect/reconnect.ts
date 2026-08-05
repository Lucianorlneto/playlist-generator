/**
 * Perda de sessão e reconexão (US4 cenário 2, SC-006).
 *
 * Quando a renovação falha, três coisas acontecem nesta ordem: o rascunho é
 * gravado **de forma síncrona** (para que a etapa atual sobreviva à ida ao
 * consentimento), a sessão é descartada e o usuário é levado à etapa de
 * credencial com uma mensagem acionável.
 *
 * A restauração da etapa exata no retorno não acontece aqui — acontece em
 * `restoreDraft`, na inicialização. Ter um único caminho de restauração é o que
 * garante que recarga, reconexão e reabertura se comportem igual.
 */

import { AppError } from '@/services/spotify/errors';
import { clearSession } from '@/services/storage/sessionRepo';
import { useAppStore } from '@/store';
import { flushDraftNow } from '@/store/draftPersistence';

export function handleSessionLoss(error?: AppError): void {
  const store = useAppStore.getState();

  // A gravação vem antes de qualquer mudança de estado: é o que preserva texto,
  // nome da playlist e revisão através da reconexão (FR-044).
  flushDraftNow();

  clearSession();
  store.setSession(null);
  store.setAuthError(error ?? new AppError('session_expired'));
  store.goToStep('credential');
}
