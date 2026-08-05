import { t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
import { Button } from '@/ui/Button';

/**
 * Nome da conta conectada, sempre visível (FR-009).
 *
 * Fica no cabeçalho de todas as etapas de propósito: o edge case "usuário
 * conectado a uma conta diferente da esperada" só é detectável se o nome estiver
 * à vista antes da confirmação da criação.
 */
export function SessionHeader() {
  const session = useAppStore((state) => state.session);
  const disconnect = useAppStore((state) => state.disconnect);

  if (session === null) return null;

  return (
    <div
      aria-label={t.connect.accountLabel}
      className="text-ink-muted flex flex-wrap items-center gap-2 text-sm"
    >
      <span>
        {t.connect.connectedAs}{' '}
        <strong className="text-ink font-semibold">{session.user.displayName}</strong>
      </span>
      <Button size="sm" variant="ghost" onClick={disconnect}>
        {t.connect.disconnect}
      </Button>
    </div>
  );
}
