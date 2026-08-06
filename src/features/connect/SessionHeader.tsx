import { PROVIDER_ORDER } from '@/domain/providers';
import { nameOf } from '@/features/credential/providerText';
import { format, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
import { Button } from '@/ui/Button';

/**
 * Contas conectadas, sempre visíveis (FR-036).
 *
 * Uma linha por serviço conectado, com desconexão independente: encerrar a
 * sessão de um destino não pode afetar a do outro, nem o resultado já produzido
 * por ele.
 *
 * Fica no cabeçalho de todas as etapas de propósito: o caso "conectado a uma
 * conta diferente da esperada" só é detectável se o nome estiver à vista **antes**
 * da confirmação da criação.
 */
export function SessionHeader() {
  const sessions = useAppStore((state) => state.sessions);
  const disconnect = useAppStore((state) => state.disconnect);

  const connected = PROVIDER_ORDER.filter((provider) => sessions[provider] !== null);
  if (connected.length === 0) return null;

  return (
    <ul aria-label={t.connect.sessionsLabel} className="flex flex-col items-end gap-1 text-sm">
      {connected.map((provider) => {
        const session = sessions[provider];
        if (session === null) return null;
        const service = nameOf(provider);
        return (
          <li
            key={provider}
            aria-label={format(t.connect.accountLabel, { service })}
            className="text-ink-muted flex flex-wrap items-center gap-2"
          >
            <span>
              {service} · {t.connect.connectedAs}{' '}
              <strong className="text-ink font-semibold">{session.user.displayName}</strong>
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                disconnect(provider);
              }}
            >
              {format(t.connect.disconnect, { service })}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
