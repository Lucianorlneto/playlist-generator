import { PROVIDER_ORDER } from '@/domain/providers';
import { nameOf } from '@/features/credential/providerText';
import { ConnectButton } from '@/features/connect/ConnectButton';
import { format, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
import { Button } from '@/ui/Button';

/**
 * Contas dos serviços escolhidos, sempre visíveis (FR-036, `004/US3`).
 *
 * **O que mudou na 004, e por quê.** A lista era "provedores com sessão ativa".
 * A consequência era perversa: no instante em que a sessão caía — exatamente
 * quando o usuário mais precisava de uma saída — o serviço **sumia** do
 * cabeçalho, levando junto o seu único ponto de interação. Ficava desconectado e
 * sem nada em que clicar.
 *
 * Agora a lista é "destinos selecionados **com credencial salva**", conectados ou
 * não. Nenhum caminho leva a um serviço desconectado sem saída (SC-004).
 *
 * Os dois filtros existem por razões diferentes e nenhum é redundante:
 * - **selecionado** (H4): o Princípio II proíbe requisição a provedor não
 *   escolhido, e oferecer "reconectar" a um deles convidaria a violá-lo;
 * - **com credencial** (H3): sem Client ID não há autorização possível, e o
 *   botão seria uma promessa que o app não pode cumprir.
 *
 * Fica no cabeçalho de todas as etapas de propósito: o caso "conectado a uma
 * conta diferente da esperada" só é detectável se o nome estiver à vista
 * **antes** da confirmação da criação (FR-015).
 */
export function SessionHeader() {
  const sessions = useAppStore((state) => state.sessions);
  const credentials = useAppStore((state) => state.credentials);
  const selected = useAppStore((state) => state.destinations.selected);
  const disconnect = useAppStore((state) => state.disconnect);

  // Antes da etapa de destinos `selected` está vazio e nada é listado — correto:
  // ainda não há trabalho a preservar.
  const listed = PROVIDER_ORDER.filter(
    (provider) => selected.includes(provider) && credentials[provider] !== null,
  );
  if (listed.length === 0) return null;

  return (
    <ul aria-label={t.connect.accountsLabel} className="flex flex-col items-end gap-1 text-body">
      {listed.map((provider) => {
        const session = sessions[provider];
        const service = nameOf(provider);
        const state =
          session === null ? t.connect.disconnectedState : session.user.displayName;

        return (
          <li
            key={provider}
            aria-label={format(t.connect.serviceStateLabel, { service, state })}
            className="text-ink-muted flex flex-wrap items-center gap-2"
          >
            <span>
              {service} ·{' '}
              {session === null ? (
                <strong className="text-ink font-semibold">{t.connect.disconnectedState}</strong>
              ) : (
                <>
                  {t.connect.connectedAs}{' '}
                  <strong className="text-ink font-semibold">{session.user.displayName}</strong>
                </>
              )}
            </span>

            {/*
              H1, H2, H5: **Reconectar** é oferecido sempre, conectado ou não.
              Reusa `ConnectButton`, que já grava o rascunho antes de navegar e
              pede autorização só ao provedor afetado (FR-024, H8). Nenhuma ação
              daqui escreve na conta do usuário (H7, FR-026).
            */}
            <ConnectButton provider={provider} compact />

            {/* H6: rótulos inequívocos — desconectar só existe quando há o que
                desconectar, e nunca ocupa o lugar de reconectar. */}
            {session !== null && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  disconnect(provider);
                }}
              >
                {format(t.connect.disconnect, { service })}
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
