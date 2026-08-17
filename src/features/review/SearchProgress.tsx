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
 * motivo é **acessibilidade**: o elemento carrega papel, valor e máximo sem uma
 * linha de ARIA, e leitor de tela e tecnologia assistiva já sabem lê-lo.
 *
 * ## A razão anterior estava errada, e a correção é registrada
 *
 * Este comentário afirmava que a CSP do artefato de produção — `style-src 'self'`
 * — bloquearia uma largura em porcentagem inline. **Não bloqueia** (010/research
 * §R1): a restrição alcança estilo que chega como **texto** — o atributo `style`
 * presente no HTML servido e blocos `<style>` —, e escrita programática via
 * CSSOM, que é o que o React e a biblioteca de movimento fazem, não passa pelo
 * analisador de CSP. A prova é anterior à apuração e está no próprio
 * repositório: `src/ui/Stickers.tsx` posiciona os onze adesivos por `style` e
 * funciona no `dist/`.
 *
 * A decisão continua certa; o que sai é a premissa falsa que a sustentava. Uma
 * decisão apoiada em razão errada é uma decisão que ninguém consegue rever
 * (010/FR-028).
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
      {/*
        `<progress>` nativo continua sendo a escolha, por acessibilidade — a
        decisão já morava neste arquivo. É por causa dela que `color-scheme`
        precisa ser declarado por tema em `tokens.css`: sem isso o tema escuro
        entregaria uma barra clara no meio da tela (research §9).
      */}
      <progress
        className="accent-accent bg-surface-raised h-2 w-full rounded-pill"
        value={search.done}
        max={Math.max(search.total, 1)}
        aria-label={t.review.progressLabel}
      >
        {counting}
      </progress>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Contagem em `data-numeral`: tabular, para que o número não dance
            enquanto sobe (contracts/components.md §8). */}
        <LiveRegion
          className="data-numeral"
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
