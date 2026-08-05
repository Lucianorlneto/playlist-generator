import { committedTrackCount } from '@/domain/batching';
import { format, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
import { Button } from '@/ui/Button';
import { RateLimitWaiting } from '@/ui/RateLimitWaiting';

import { retryRemaining } from './creationRunner';

/**
 * Retomada de uma criação interrompida (FR-033, SC-009).
 *
 * O botão repete **apenas os lotes restantes**, reutilizando a playlist já
 * criada. Não existe caminho aqui que crie uma segunda playlist nem que reenvie
 * um lote confirmado.
 */
export function RetryRemaining() {
  const creation = useAppStore((state) => state.creation);
  const creating = useAppStore((state) => state.creating);
  const error = useAppStore((state) => state.creationError);
  const config = useAppStore((state) => state.playlistConfig);

  if (creation === null) return null;

  const added = committedTrackCount(creation);

  return (
    <section
      role="alert"
      className="border-status-uncertain bg-status-uncertain-soft rounded-lg border p-3"
    >
      <h3 className="text-ink text-sm font-bold">{t.result.partialHeading}</h3>
      <p className="text-ink mt-1 text-sm">
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

      <RateLimitWaiting />
    </section>
  );
}
