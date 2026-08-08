import { committedItemCount } from '@/domain/batching';
import type { ProviderId } from '@/domain/providers';
import { nameOf } from '@/features/credential/providerText';
import { format, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
import { Button } from '@/ui/Button';
import { RateLimitWaiting } from '@/ui/RateLimitWaiting';

import { retryRemaining } from './creationRunner';

export interface RetryRemainingProps {
  provider: ProviderId;
}

/**
 * Retomada de uma criação interrompida (FR-033, SC-010).
 *
 * O botão reenvia **apenas os itens restantes**, reutilizando a playlist já
 * criada. Não existe caminho aqui que crie uma segunda playlist nem que reenvie
 * um item confirmado — a contagem em itens torna isso exato com `batchSize` 100
 * ou 1.
 */
export function RetryRemaining({ provider }: RetryRemainingProps) {
  const creation = useAppStore((state) => state.queue.runs[provider]?.creation ?? null);
  const creating = useAppStore((state) => state.creating);
  const error = useAppStore((state) => state.creationError);
  const config = useAppStore((state) => state.playlistConfig);

  if (creation === null) return null;

  const added = committedItemCount(creation);

  return (
    <section
      role="alert"
      className="border-state-uncertain-edge bg-state-uncertain-tint rounded-card border p-3"
    >
      <h3 className="text-ink text-body font-bold">{t.result.partialHeading}</h3>
      <p className="text-ink mt-1 text-body">
        {format(t.result.partialBody, {
          added,
          total: creation.orderedUris.length,
          name: config.name.trim(),
        })}
      </p>
      {error !== null && <p className="field-message">{error.info.nextStep}</p>}

      <div className="mt-2">
        <Button
          variant="primary"
          size="sm"
          disabled={creating}
          onClick={() => {
            void retryRemaining();
          }}
        >
          {creating ? t.result.retryingRemaining : t.result.retryRemaining}
        </Button>
      </div>

      <RateLimitWaiting label={format(t.review.progressWaiting, { service: nameOf(provider) })} />
    </section>
  );
}
