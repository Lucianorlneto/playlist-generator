import type { ProviderId } from '@/domain/providers';
import { nameOf, textFor } from '@/features/credential/providerText';
import { format, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
import { Button } from '@/ui/Button';

import { useAuthorize } from './useAuthorize';

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

  const service = nameOf(provider);
  const text = textFor(provider);

  // O corpo da autorização saiu daqui na feature 007, quando o chip da barra
  // superior passou a ser o segundo lugar de onde se autoriza. Duas cópias
  // divergiriam, e a primeira coisa que a cópia esqueceria seria gravar o
  // rascunho antes de navegar — falha que só aparece na volta do provedor.
  const connect = useAuthorize(provider, navigate);

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
