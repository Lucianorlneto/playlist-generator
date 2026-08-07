import type { ProviderId } from '@/domain/providers';
import { nameOf, textFor } from '@/features/credential/providerText';
import { format, t } from '@/i18n/pt-BR';
import { toAppError } from '@/services/providers/errors';
import { providerFor } from '@/services/providers/registry';
import { computeRedirectUri } from '@/features/credential/redirectUri';
import { useAppStore } from '@/store';
import { flushDraftNow } from '@/store/draftPersistence';
import { Button } from '@/ui/Button';

export interface ConnectButtonProps {
  provider: ProviderId;
  /** Injetável para teste: em produção é a navegação real do navegador. */
  navigate?: (url: string) => void;
  /**
   * Apresentação compacta, para o cabeçalho de contas (`004/US3`): rótulo de
   * **reconexão** e sem os avisos de escopo e credencial, que já foram lidos na
   * etapa de conexão e viram ruído repetido em toda tela.
   *
   * O comportamento é o mesmo — este é o único caminho de autorização do app, e
   * é isso que garante que reconectar do cabeçalho grave o rascunho antes de
   * navegar exatamente como reconectar do diálogo (FR-024, H8).
   */
  compact?: boolean;
}

/**
 * Autoriza **um** serviço — o do ciclo que começou (FR-017, SC-005).
 *
 * O provedor vem por propriedade em vez de ser lido do estado global: é o que
 * torna impossível, por construção, pedir consentimento a um serviço que não
 * está na vez.
 */
export function ConnectButton({ provider, navigate, compact = false }: ConnectButtonProps) {
  const credential = useAppStore((state) => state.credentials[provider]);
  const connecting = useAppStore((state) => state.connecting === provider);
  const setConnecting = useAppStore((state) => state.setConnecting);
  const setAuthError = useAppStore((state) => state.setAuthError);

  const service = nameOf(provider);
  const text = textFor(provider);

  async function connect(): Promise<void> {
    if (credential === null) return;
    setConnecting(provider);
    try {
      const url = await providerFor(provider).buildAuthorizeUrl(
        credential.clientId,
        computeRedirectUri(),
      );
      // A autorização é uma navegação de página inteira: o que estiver pendurado
      // no debounce de 500 ms morre com o documento. Gravar aqui é o que faz o
      // retorno cair no serviço e na etapa exatos em vez de recomeçar (FR-037).
      flushDraftNow();
      if (navigate === undefined) window.location.assign(url);
      else navigate(url);
    } catch (error) {
      setAuthError(toAppError(error, provider));
    }
  }

  if (compact) {
    return (
      <Button
        size="sm"
        variant="secondary"
        disabled={credential === null || connecting}
        onClick={() => void connect()}
      >
        {format(connecting ? t.connect.connecting : t.connect.reconnect, { service })}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="primary"
        disabled={credential === null || connecting}
        onClick={() => void connect()}
      >
        {format(connecting ? t.connect.connecting : t.connect.connect, { service })}
      </Button>
      {credential === null && (
        <p className="field-message">{format(t.connect.needsCredential, { service })}</p>
      )}
      <p className="field-message">{text.scopesNotice}</p>
    </div>
  );
}
