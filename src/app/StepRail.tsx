import { composeRail, type RailStep, type RailStepState } from '@/domain/rail';
import { format, t } from '@/i18n/pt-BR';
import { Icon } from '@/ui/Icon';
import { cx } from '@/ui/cx';

import { useRailSnapshot } from './railSnapshot';
import { ResetFlow } from './ResetFlow';

/**
 * A trilha vertical de etapas (FR-010, FR-011; `contracts/shell.md` §4).
 *
 * **Desenha o que `src/domain/rail/` devolve e não decide nada** (Princípio III).
 * Quais degraus existem, como se numeram e o que cada um declara é regra de
 * negócio, e a regra tem um lar único e testável sem DOM. Este arquivo não sabe
 * que o Resumo é condicional, não conta destinos e não formata linha de apoio.
 *
 * Substitui o `StepIndicator` horizontal da 005 e herda dele os três
 * comportamentos acessíveis que já estavam conquistados
 * (`contracts/token-migration.md` §6.3):
 *
 * - a régua `aria-hidden` virou o conector vertical entre discos, também
 *   `aria-hidden`;
 * - a contagem "N de T" para leitor de tela virou o `ordinal` do domínio;
 * - o `aria-current="step"` permanece literal, e **uma única vez** — o título da
 *   etapa na área principal não o repete (FR-041).
 *
 * ## A distinção entre estados é por forma
 *
 * | Estado | Disco | Conteúdo | Conector | Tinta do nome |
 * | --- | --- | --- | --- | --- |
 * | `done` | Preenchido `--accent` | `check` em `--accent-ink` | `--accent` | `--ink` |
 * | `current` | Tingido | Numeral em `--accent-text` | `--rule` | `--ink` |
 * | `pending` | Vazado, contorno `--rule-strong` | Numeral em `--ink-muted` | `--rule` | `--ink-muted` |
 *
 * **Esta tabela é a razão pela qual `--ink-faint` não existe.** O arquivo de
 * design distinguia pendente de secundário por uma terceira tinta que reprova no
 * contraste em todos os substratos; aqui a distinção é preenchido / tingido /
 * vazado — forma, que sobrevive a cores forçadas e a daltonismo (FR-042).
 */

const STEP_LABEL = {
  credential: t.steps.credential,
  destinations: t.steps.destinations,
  input: t.steps.input,
  service: t.steps.service,
  summary: t.steps.summary,
} as const;

const NEUTRAL_SUPPORT = {
  credential: t.rail.neutral.credential,
  destinations: t.rail.neutral.destinations,
  input: t.rail.neutral.input,
  service: t.rail.neutral.service,
  summary: t.rail.neutral.summary,
} as const;

/**
 * Mapas explícitos de literais, nunca concatenação: o scanner do Tailwind lê o
 * código como texto e não resolve expressão (`tp/no-dynamic-classname`).
 */
const DISC_CLASSES: Record<RailStepState, string> = {
  done: 'bg-accent text-accent-ink border-transparent',
  current: 'bg-accent-tint text-accent-text border-accent-text',
  pending: 'bg-transparent text-ink-muted border-rule-strong',
};

const CONNECTOR_CLASSES: Record<RailStepState, string> = {
  done: 'bg-accent',
  current: 'bg-rule',
  pending: 'bg-rule',
};

const NAME_CLASSES: Record<RailStepState, string> = {
  done: 'text-ink',
  current: 'text-ink font-semibold',
  pending: 'text-ink-muted',
};

function Degrau({ step, ultimo, total }: { step: RailStep; ultimo: boolean; total: number }) {
  const support =
    step.support.kind === 'derived' ? step.support.value : NEUTRAL_SUPPORT[step.step];

  return (
    <li className="flex gap-3">
      {/*
        A coluna do indicador. O conector é `aria-hidden` porque duplica
        visualmente o que o estado do degrau já diz — anunciá-lo faria o leitor
        de tela ouvir a mesma informação duas vezes.
      */}
      <div className="flex flex-col items-center">
        <span
          aria-hidden="true"
          className={cx(
            'rounded-pill text-data flex size-6 shrink-0 items-center justify-center border font-semibold',
            DISC_CLASSES[step.state],
          )}
        >
          {step.state === 'done' ? <Icon role="done" /> : step.ordinal}
        </span>
        {!ultimo && (
          <span
            aria-hidden="true"
            className={cx(
              'rounded-hair w-0.5 flex-1 transition-colors duration-200 motion-reduce:transition-none',
              CONNECTOR_CLASSES[step.state],
            )}
          />
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-0.5 pb-6">
        <span
          // **Uma única vez por etapa** (FR-041). O `StepHeading` da área
          // principal não repete a posição no fluxo; ela é dita aqui.
          aria-current={step.state === 'current' ? 'step' : undefined}
          className={cx('text-body', NAME_CLASSES[step.state])}
        >
          {/*
            A contagem que o `StepIndicator` anunciava como "N de T" virou o
            `ordinal` do domínio. Continua existindo só para leitor de tela: quem
            vê já tem o numeral desenhado no disco.
          */}
          <span className="sr-only">
            {format(t.rail.position, { n: step.ordinal, total })}{' '}
          </span>
          {STEP_LABEL[step.step]}
        </span>
        <span className="text-ink-muted text-meta">{support}</span>
      </div>
    </li>
  );
}

export function StepRail() {
  const rail = composeRail(useRailSnapshot());

  return (
    <nav
      aria-label={t.rail.title}
      /*
        `overflow-y-auto` porque a trilha é fixa na janela desde que a casca
        parou de rolar: numa janela baixa — telefone deitado, zoom de texto a
        200% — os cinco degraus mais o rodapé passam da altura disponível, e sem
        isto o excedente ficaria inalcançável em vez de rolar.

        `justify-between` continua empurrando o rodapé para baixo enquanto sobra
        espaço, que é o caso comum.

        `relative` ancora aqui os `sr-only` de cada degrau — que são
        `position: absolute` e, sem um ancestral posicionado, se ancorariam no
        documento e inflariam o `scrollHeight` dele com altura invisível.
      */
      className="border-rule bg-surface-zone zone-rail relative flex flex-col justify-between overflow-y-auto border-r p-4"
    >
      <div className="flex flex-col gap-4">
        <h2 className="text-ink-muted text-data font-semibold tracking-wide uppercase">
          {t.rail.title}
        </h2>

        <ol className="flex flex-col">
          {rail.map((step, index) => (
            <Degrau
              key={step.step}
              step={step}
              ultimo={index === rail.length - 1}
              total={rail.length}
            />
          ))}
        </ol>
      </div>

      {/*
        O rodapé da trilha. `ResetFlow` preserva integralmente a confirmação de
        descarte da feature 006 — o botão não descarta, ele pergunta (FR-015,
        FR-065). Em largura estreita a trilha não é renderizada e a ação migra
        para a barra superior; **nunca existe nos dois lugares** (FR-054).
      */}
      {/*
        `empty:hidden` porque `ResetFlow` devolve `null` quando não há trabalho a
        descartar — comportamento da feature 006, preservado. Sem isso, o filete
        divisor fica sozinho no rodapé da trilha, anunciando uma seção que não
        existe. Foi o que a primeira conferência de fidelidade mostrou.
      */}
      <div className="border-rule mt-6 border-t pt-4 empty:hidden">
        <ResetFlow />
      </div>
    </nav>
  );
}
