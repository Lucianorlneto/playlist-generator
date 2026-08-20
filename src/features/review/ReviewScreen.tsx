import { useMemo } from 'react';

import type { ProviderId } from '@/domain/providers';
import { nameOf } from '@/features/credential/providerText';
import { SkipButton } from '@/features/service/SkipButton';
import { format, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
import { StepHeading } from '@/ui/StepHeading';
import { Settle, Stagger } from '@/ui/motion';

import { MatchRow } from './MatchRow';
import { PlaylistConfigForm } from './PlaylistConfigForm';
import { SearchProgress } from './SearchProgress';

export interface ReviewScreenProps {
  provider: ProviderId;
}

/**
 * Revisão obrigatória antes de qualquer escrita na conta **daquele** serviço
 * (FR-019, Princípio V).
 *
 * Confirmar o primeiro destino não libera escrita no segundo: cada `ServiceRun`
 * tem sua própria revisão e seu próprio evento de confirmação.
 *
 * A lista é renderizada na ordem de `line.index` e **nunca reordenada**. Ordenar
 * por status agruparia os problemas — e destruiria a correspondência visual com
 * o texto que o usuário colou.
 */
export function ReviewScreen({ provider }: ReviewScreenProps) {
  const stepToken = useAppStore((state) => state.stepToken);
  const run = useAppStore((state) => state.queue.runs[provider] ?? null);
  // O portão de ociosidade de `Settle` (010/FR-027): durante a busca há
  // requisição em voo, e animação de posição fica do lado de fora da fronteira.
  const search = useAppStore((state) => state.search);

  // Estabilizado: `run?.items ?? []` cria um array novo quando não há execução,
  // o que invalidaria os `useMemo` abaixo a cada render.
  const items = useMemo(() => run?.items ?? [], [run]);
  const service = nameOf(provider);

  const ordered = useMemo(() => [...items].sort((a, b) => a.line.index - b.line.index), [items]);

  const summary = useMemo(() => {
    let confident = 0;
    let uncertain = 0;
    let notFound = 0;
    let selected = 0;
    for (const item of items) {
      if (item.status === 'confident') confident += 1;
      if (item.status === 'uncertain') uncertain += 1;
      if (item.status === 'not_found' || item.status === 'unparsed') notFound += 1;
      if (item.included) selected += 1;
    }
    return { confident, uncertain, notFound, selected };
  }, [items]);

  return (
    <section className="flex flex-col gap-4">
      <StepHeading
        title={format(t.review.heading, { service })}
        description={t.review.intro}
        focusToken={stepToken}
      />

      <SearchProgress provider={provider} />

      <p className="text-ink-muted text-body">
        {format(t.review.summaryConfident, { count: summary.confident })} ·{' '}
        {format(t.review.summaryUncertain, { count: summary.uncertain })} ·{' '}
        {format(t.review.summaryNotFound, { count: summary.notFound })}
      </p>
      <p className="text-ink text-body font-semibold">
        {format(t.review.selectedCount, { selected: summary.selected, total: items.length })}
      </p>
      <p className="field-message">{t.review.editLinePropagates}</p>

      {/*
        O cabeçalho de colunas saiu junto com a grade de quatro colunas.
        `MatchRow` deixou de ser uma linha de tabela e passou a ser uma entrada
        de documento — goteira com o numeral, e o conteúdo empilhado ao lado
        (design.md §5). Não há mais colunas a rotular, e um cabeçalho que não
        encabeça nada é ruído.

        Nada se perde em acessibilidade: o elemento era `aria-hidden`, e cada
        campo da linha continua rotulado por texto próprio.
      */}
      {/*
        A lista entra escalonada e acomoda depois (010/FR-026, FR-027).

        **Uma `<ul>` só, com duas primitivas.** `Settle` não cria elemento
        nenhum: ele pendura a referência dele no contêiner que `Stagger`
        renderiza. Dois envoltórios produziriam `ul > div > li`, que é violação
        séria na regra `list` do axe (contracts/motion-catalog.md §2.2).

        O portão de `Settle` é passado **mesmo sendo sempre verdadeiro aqui** —
        na revisão a busca já terminou. Passá-lo assim mesmo é o que o mantém
        auditável em vez de decorativo: quem lê esta linha vê qual estado abre a
        animação de posição, e o teste de componente afirma os dois lados
        (contracts/motion-catalog.md §4).
      */}
      <Settle idle={search.running === false}>
        <Stagger
          role="enter"
          as="ul"
          label={t.review.listLabel}
          className="flex flex-col gap-2"
        >
          {ordered.map((item) => (
            <MatchRow key={item.line.id} item={item} provider={provider} />
          ))}
        </Stagger>
      </Settle>

      <PlaylistConfigForm provider={provider} />

      <div>
        <SkipButton provider={provider} />
      </div>
    </section>
  );
}
