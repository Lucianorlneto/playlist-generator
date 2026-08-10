import { composeRail } from '@/domain/rail';
import { format, t } from '@/i18n/pt-BR';

import { useRailSnapshot } from './railSnapshot';

/**
 * A trilha colapsada, em largura estreita (FR-037, FR-052).
 *
 * ## É informação, não navegação
 *
 * FR-052 lista três proibições explícitas, e todas apontam para a mesma ideia:
 *
 * - **sem estado de abertura** — nada que expanda, recolha ou lembre se estava
 *   aberto. Um acordeão aqui seria um segundo mecanismo de navegação competindo
 *   com o fluxo linear, que já é a única forma de andar pelo assistente;
 * - **sem controle acionável novo** — nenhum `button`, nenhum `a`, nenhum
 *   `role` interativo;
 * - **sem parada de tabulação adicional** — consequência da anterior, e a razão
 *   pela qual ela é declarada separadamente: um `tabindex={0}` num `div` não é
 *   controle acionável e ainda assim inflaria o caminho de teclado.
 *
 * A trilha inteira não cabe em 320px sem virar rolagem ou acordeão. O que cabe é
 * a resposta à pergunta que a trilha responde — **onde eu estou** —, e é isso
 * que este componente entrega.
 *
 * ## Consome o mesmo domínio
 *
 * `composeRail` é a mesma função que a trilha larga usa. Reimplementar a
 * contagem aqui produziria o caso em que a trilha diz "3 de 5" e o resumo diz
 * "3 de 4" na mesma sessão, quando há um destino só — porque a regra do Resumo
 * condicional teria duas cópias (FR-013).
 */
export function StepSummary() {
  const rail = composeRail(useRailSnapshot());

  const atual = rail.find((step) => step.state === 'current');
  if (atual === undefined) return null;

  const nome = {
    credential: t.steps.credential,
    destinations: t.steps.destinations,
    input: t.steps.input,
    service: t.steps.service,
    summary: t.steps.summary,
  }[atual.step];

  const apoio =
    atual.support.kind === 'derived'
      ? atual.support.value
      : {
          credential: t.rail.neutral.credential,
          destinations: t.rail.neutral.destinations,
          input: t.rail.neutral.input,
          service: t.rail.neutral.service,
          summary: t.rail.neutral.summary,
        }[atual.step];

  return (
    <section
      aria-label={t.rail.title}
      className="border-rule bg-surface-zone rounded-panel flex flex-col gap-0.5 border p-3"
    >
      <span className="text-ink-muted text-data font-semibold tracking-wide uppercase">
        {format(t.rail.position, { n: atual.ordinal, total: rail.length })}
      </span>
      {/*
        `aria-current="step"` continua aparecendo **uma única vez** por etapa
        (FR-041): em largura estreita a trilha não é renderizada, então este é o
        único portador. É por isso que a troca acontece em JavaScript e não por
        `display: none` — duas cópias, uma escondida, seriam dois `aria-current`.
      */}
      <span aria-current="step" className="text-ink text-section font-semibold">
        {nome}
      </span>
      <span className="text-ink-muted text-meta">{apoio}</span>
    </section>
  );
}
