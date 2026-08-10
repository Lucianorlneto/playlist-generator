import { useCallback } from 'react';

import type { ProviderId } from '@/domain/providers';
import { computeRedirectUri } from '@/features/credential/redirectUri';
import { toAppError } from '@/services/providers/errors';
import { providerFor } from '@/services/providers/registry';
import { useAppStore } from '@/store';
import { flushDraftNow } from '@/store/draftPersistence';

/**
 * O **único** caminho de autorização da aplicação.
 *
 * Existia dentro do `ConnectButton` até a feature 007 acrescentar o segundo
 * lugar de onde se autoriza — o chip da barra superior. Copiar o corpo para lá
 * criaria duas rotas de consentimento, e a segunda esqueceria alguma coisa: o
 * candidato óbvio é o `flushDraftNow`, cuja ausência só se manifesta como
 * trabalho perdido depois de voltar do provedor, longe da linha que a causou.
 *
 * As garantias que este hook concentra:
 *
 * - **O provedor vem por argumento**, nunca do estado global. É o que torna
 *   impossível, por construção, pedir consentimento a um serviço que não está na
 *   vez (FR-017).
 * - **O rascunho é gravado antes de navegar.** A autorização é uma navegação de
 *   página inteira: o que estiver pendurado no debounce de 500 ms morre com o
 *   documento. Gravar aqui é o que faz o retorno cair no serviço e na etapa
 *   exatos em vez de recomeçar.
 * - **Sem credencial não há navegação.** Não é validação defensiva: sem Client
 *   ID não existe URL de autorização a construir.
 */
export function useAuthorize(
  provider: ProviderId,
  navigate?: (url: string) => void,
): () => Promise<void> {
  const credential = useAppStore((state) => state.credentials[provider]);
  const setConnecting = useAppStore((state) => state.setConnecting);
  const setAuthError = useAppStore((state) => state.setAuthError);

  return useCallback(async () => {
    if (credential === null) return;
    setConnecting(provider);
    try {
      const url = await providerFor(provider).buildAuthorizeUrl(
        credential.clientId,
        computeRedirectUri(),
      );
      flushDraftNow();
      if (navigate === undefined) window.location.assign(url);
      else navigate(url);
    } catch (error) {
      setAuthError(toAppError(error, provider));
    }
  }, [credential, navigate, provider, setAuthError, setConnecting]);
}
