import type { ProviderId } from '@/domain/providers';
import { nameOf } from '@/features/credential/providerText';
import { format, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
import { Button } from '@/ui/Button';
import { LiveRegion } from '@/ui/LiveRegion';
import { RateLimitWaiting } from '@/ui/RateLimitWaiting';

export interface SearchProgressProps {
  provider: ProviderId;
}

/**
 * Progresso da busca (`001/FR-026`, SC-011).
 *
 * Barra visual **mais** contagem textual em região viva: a barra sozinha não diz
 * nada a quem usa leitor de tela. O botão de cancelar é um botão real, sempre
 * alcançável por teclado, inclusive durante a espera por limitação.
 *
 * A barra é o `<progress>` nativo, e não uma `<div>` com largura calculada. O
 * motivo é a CSP do artefato de produção: `style-src 'self'` também bloqueia
 * atributos `style` inline, então uma largura em porcentagem simplesmente não
 * seria aplicada — falha que não aparece em desenvolvimento.
 */
export function SearchProgress({ provider }: SearchProgressProps) {
  const search = useAppStore((state) => state.search);
  const cancelSearch = useAppStore((state) => state.cancelSearch);

  if (!search.running && search.done === 0) return null;

  const counting = format(t.review.progressCounting, {
    done: search.done,
    total: search.total,
  });

  return (
    <section className="flex flex-col gap-2" aria-label={t.review.progressLabel}>
      <progress
        className="accent-accent h-2 w-full"
        value={search.done}
        max={Math.max(search.total, 1)}
        aria-label={t.review.progressLabel}
      >
        {counting}
      </progress>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <LiveRegion
          visible
          message={
            search.running
              ? counting
              : search.canceled
                ? t.review.searchCanceled
                : format(t.review.progressDone, { done: search.done, total: search.total })
          }
        />
        {search.running && (
          <Button size="sm" variant="danger" onClick={cancelSearch}>
            {t.review.cancelSearch}
          </Button>
        )}
      </div>

      {search.running && (
        <RateLimitWaiting
          onCancel={cancelSearch}
          label={format(t.review.progressWaiting, { service: nameOf(provider) })}
        />
      )}
    </section>
  );
}
