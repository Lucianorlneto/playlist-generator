import { useState } from 'react';

import { linesFor } from '@/domain/run/lines';
import { capabilitiesOf, type ProviderId } from '@/domain/providers';
import { nameOf } from '@/features/credential/providerText';
import { QueueIndicator } from '@/features/queue/QueueIndicator';
import { ListReduction } from '@/features/input/ListReduction';
import { SkipButton } from '@/features/service/SkipButton';
import { format, plural, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
import { Button } from '@/ui/Button';
import { cx } from '@/ui/cx';
import { Icon } from '@/ui/Icon';

export interface QuotaEstimateScreenProps {
  provider: ProviderId;
}

/**
 * Mapas explícitos de literais, nunca concatenação: o scanner do Tailwind lê o
 * código como texto e não resolve expressão (`tp/no-dynamic-classname`).
 *
 * A cor de marca entra por `text-*`, que tinge o glifo — o ícone herda
 * `currentColor`. **Nunca por `bg-*`**: o substrato tingido de 008/FR-004 é
 * exceção nomeada do distintivo do cartão de destino, e não vale aqui
 * (008/contracts/destinations.md §4).
 */
const PROVIDER_ICON = {
  spotify: 'provider-spotify',
  youtube: 'provider-youtube',
} as const;

const BRAND_INK = {
  spotify: 'text-brand-spotify',
  youtube: 'text-brand-youtube',
} as const;

/**
 * Estimativa de consumo, exibida **antes de qualquer requisição de busca**
 * (FR-029, SC-011).
 *
 * Quando a estimativa cabe, a tela é informativa e o usuário segue. Quando não
 * cabe, ela **bloqueia** e oferece exatamente duas ações (FR-029, FR-034,
 * SC-008):
 *
 * 1. **reduzir a lista**, informando quantas linhas cabem;
 * 2. **pular o destino**.
 *
 * E mais um texto **sem ação associada**, declarando a premissa do cálculo: o
 * saldo parte sempre do orçamento padrão do provedor menos o que este app já
 * consumiu hoje neste dispositivo. Ampliar a cota junto ao provedor não altera
 * esse cálculo — por isso "ampliar o orçamento" não é oferecido como saída aqui.
 * Ela aparece só no esgotamento **durante** a execução, onde de fato ajuda.
 */
export function QuotaEstimateScreen({ provider }: QuotaEstimateScreenProps) {
  const run = useAppStore((state) => state.queue.runs[provider] ?? null);
  const lines = useAppStore((state) => state.lines);
  const dispatchRun = useAppStore((state) => state.dispatchRun);
  const reduceUpcoming = useAppStore((state) => state.reduceUpcoming);
  const [reducing, setReducing] = useState(false);

  const service = nameOf(provider);
  const estimate = run?.estimate ?? null;

  if (run === null || estimate === null) return null;

  // O custo de uma busca no provedor, para converter a reserva de **linhas** em
  // unidades — que é a moeda em que o resto da tela fala.
  const QUOTA_SEARCH_COST = capabilitiesOf(provider).quota?.costs.search ?? 0;

  if (reducing) {
    return (
      <ListReduction
        provider={provider}
        lines={linesFor(lines, run.lineIds)}
        lineIds={run.lineIds}
        maxLinesThatFit={estimate.maxLinesThatFit}
        onConfirm={(lineIds) => {
          // O ajuste é aplicado **antes** da busca daquele destino (FR-013).
          reduceUpcoming(provider, lineIds);
          dispatchRun({ type: 'lines_reduced', lineIds }, provider);
          setReducing(false);
        }}
        onCancel={() => {
          setReducing(false);
        }}
      />
    );
  }

  const percent = Math.round(
    (estimate.estimatedUnits / Math.max(1, estimate.estimatedUnits + estimate.availableUnits)) * 100,
  );

  return (
    /*
      **O cartão de fase** (008/FR-006, 008/T021; nó `rxIZJ — Budget Card` em
      `TSwx6`).

      O arquivo desenha esta fase **dentro** de um cartão: `--surface` com
      contorno `--rule`, e o título "Orçamento diário do {serviço}" é filho dele,
      não do cabeçalho da etapa. O que FR-006 remove é a moldura em volta do
      **cabeçalho da etapa** — a linha de contexto continua fora do cartão, como
      o arquivo a põe (`Content > Primary Column > Greeting`).

      Declarar o cartão aqui, e não herdá-lo do `Wizard`, é o que devolve o
      degrau de luminosidade de que a caixa de números depende: ela é `--bg`
      sobre `--surface` no arquivo (nó `p9MMgo — Stats Box`), e sem o cartão em
      volta seria `--bg` sobre `--bg` — a superfície existiria e não se veria.
    */
    <section className="app-card flex flex-col gap-3">
      {/*
        **O cabeçalho do cartão de fase** (008/FR-001; nó `v7c4o` do arquivo de
        design, tela `TSwx6`).

        O glifo do provedor na cor da marca identifica de qual serviço é o
        orçamento sem depender de o olho voltar ao topo da tela. Decorativo: o
        nome do serviço está escrito no título logo abaixo (FR-005).
      */}
      <header className="flex items-center gap-2">
        <Icon
          role={PROVIDER_ICON[provider]}
          className={cx('text-section', BRAND_INK[provider])}
        />
        {/*
          A repetição **visual** da posição na fila (008/FR-013). O
          `QueueIndicator` é `aria-hidden`: a linha de contexto já anunciou a
          mesma coisa alguns pixels acima, e duas regiões vivas dizendo o mesmo
          é a frase lida duas vezes, não redundância útil.
        */}
        <QueueIndicator />
      </header>

      <h3 className="text-ink text-body font-bold">{format(t.quota.heading, { service })}</h3>
      <p className="field-message">{format(t.quota.intro, { service })}</p>

      <dl className="border-rule bg-bg grid grid-cols-1 gap-2 rounded-card border p-3 text-body sm:grid-cols-2">
        <div>
          <dt className="text-ink-muted">{t.quota.estimateLabel}</dt>
          <dd className="text-ink font-semibold">
            {estimate.estimatedUnits} {t.quota.unit}
          </dd>
        </div>
        <div>
          <dt className="text-ink-muted">{t.quota.availableLabel}</dt>
          <dd className="text-ink font-semibold">
            {estimate.availableUnits} {t.quota.unit}
          </dd>
        </div>
        {/*
          A reserva de segunda tentativa aparece **no contexto do provedor que
          tem cota** (seção "Assimetria entre provedores" da constituição). Ela
          já está dentro do consumo previsto acima; exibi-la separada é o que
          impede o número total de parecer inexplicavelmente maior.
        */}
        <div>
          <dt className="text-ink-muted">{t.quota.retryReserveLabel}</dt>
          <dd className="text-ink font-semibold">
            {estimate.retryReserve * QUOTA_SEARCH_COST} {t.quota.unit}
          </dd>
        </div>
      </dl>

      <p className="field-message">
        {estimate.retryReserve === 0
          ? format(t.quota.retryReserveNoneOne, { total: estimate.lineCount })
          : format(
              plural(estimate.retryReserve, t.quota.retryReserveOne, t.quota.retryReserveOther),
              { count: estimate.retryReserve, total: estimate.lineCount },
            )}
      </p>

      {!estimate.blocked && (
        <p className="field-message">{format(t.quota.fractionLabel, { percent })}</p>
      )}

      {estimate.blocked ? (
        <div
          role="alert"
          className="border-state-missing bg-state-missing-tint text-ink flex flex-col gap-2 rounded-card border p-3 text-body"
        >
          <p className="font-bold">{t.quota.blockedHeading}</p>
          <p>
            {format(t.quota.blockedBody, {
              estimated: estimate.estimatedUnits,
              available: estimate.availableUnits,
              service,
            })}
          </p>
          <p>
            {estimate.maxLinesThatFit > 0
              ? format(t.quota.blockedFits, { count: estimate.maxLinesThatFit })
              : t.quota.blockedFitsNone}
          </p>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              size="sm"
              disabled={estimate.maxLinesThatFit === 0}
              onClick={() => {
                setReducing(true);
              }}
            >
              {t.quota.reduceList}
            </Button>
            <SkipButton
              provider={provider}
              variant="secondary"
              size="sm"
              label={format(t.quota.skipDestination, { service })}
            />
          </div>

          {/* Declaração da premissa — texto, não ação (FR-034). */}
          <p className="field-message">{format(t.quota.premise, { service })}</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            onClick={() => {
              dispatchRun({ type: 'estimate_ok' }, provider);
            }}
          >
            {t.quota.proceed}
          </Button>
          <SkipButton provider={provider} label={format(t.quota.skipDestination, { service })} />
        </div>
      )}

      <p className="field-message">{t.quota.resetNotice}</p>
    </section>
  );
}
