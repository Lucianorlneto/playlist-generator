import { nameOf } from '@/features/credential/providerText';
import { format, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';

/**
 * "Spotify — 1 de 2", visível em todas as telas do ciclo (FR-018).
 *
 * Com um único destino não renderiza **nada** (invariante Q4). Exibir "1 de 1"
 * anunciaria uma fila que não existe e cobraria do usuário a atenção de conferir
 * um número que nunca muda.
 */
export function QueueIndicator() {
  const queue = useAppStore((state) => state.queue);

  if (queue.order.length <= 1) return null;

  const provider = queue.order[queue.currentIndex];
  if (provider === undefined) return null;

  return (
    <p
      role="status"
      aria-label={t.queue.label}
      className="text-ink-muted text-body font-semibold"
    >
      {format(t.queue.position, {
        service: nameOf(provider),
        current: queue.currentIndex + 1,
        total: queue.order.length,
      })}
    </p>
  );
}
