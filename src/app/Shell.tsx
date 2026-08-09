import type { JSX, ReactNode } from 'react';

import type { WizardStep } from '@/domain/types';
import { DestinationsActionBar } from '@/features/destinations/DestinationsActionBar';
import { InputActionBar } from '@/features/input/InputActionBar';
import { useAppStore } from '@/store';

import { useIsNarrowShell } from './shellBreakpoint';
import { StepRail } from './StepRail';
import { StepSummary } from './StepSummary';
import { Topbar } from './Topbar';

/**
 * A casca de três zonas (`contracts/shell.md` §1).
 *
 * ```text
 * ┌─ Barra superior ─────────────────────────────────────────────┐
 * │ Marca            Chip Spotify · Chip YouTube │ ⌗ Tema        │
 * ├─ Trilha ──────────┬─ Área principal ─────────────────────────┤
 * │ ETAPAS            │  ┌ Coluna primária ─┐  ┌ Painel lateral ┐│
 * │  ① Configuração   │  │                  │  │   (opcional)   ││
 * │  ② Destinos       │  └──────────────────┘  └────────────────┘│
 * │  ③ Entrada        │                                          │
 * │  ④ Serviço        ├─ Barra de ações (só Destinos e Entrada) ─┤
 * │  ⑤ Resumo         │  Estado em texto            Voltar  Ir → │
 * │ ↺ Recomeçar       │                                          │
 * └───────────────────┴──────────────────────────────────────────┘
 * ```
 *
 * **Ordem no DOM = ordem visual de leitura** (FR-040): barra superior → trilha →
 * conteúdo → barra de ações. Nenhuma reordenação por CSS que descole as duas —
 * é o que faz a ordem de tabulação seguir o olho sem `tabindex` positivo em
 * lugar nenhum.
 *
 * Substitui a coluna única centralizada de 46rem da feature 005. O que a
 * goteira daquela versão dava ao fluxo — a sensação de cinco páginas do mesmo
 * documento — a trilha dá melhor, e em todas as etapas, porque diz **onde** se
 * está em vez de apenas parecer consistente.
 */

export interface ShellProps {
  /** A tela da etapa corrente. */
  readonly children: ReactNode;
  /**
   * Painel lateral de apoio, quando a tela o previr (hoje: Destinos).
   *
   * **Não rouba a largura de leitura** da coluna primária (FR-020): a coluna
   * mantém `--container-measure` e o painel ocupa a sua própria medida ao lado.
   * Em largura estreita ele desce para baixo dela, preservando a ordem de
   * leitura (FR-053).
   */
  readonly sidePanel?: ReactNode;
}

/**
 * **A lista fechada de etapas com barra de ações** (FR-016, FR-061).
 *
 * Existe uma única vez, aqui, e é um mapa e não um `if`: acrescentar uma etapa à
 * faixa exige acrescentar uma linha a este objeto, o que é uma decisão visível
 * em revisão de código. Um `step === 'destinations' || step === 'input'`
 * espalhado por dois componentes seria a mesma regra em dois lugares, e o
 * terceiro lugar entraria sem ninguém notar.
 *
 * As demais etapas mantêm as ações **dentro do cartão que as explica**:
 *
 * - **Configuração** — salvar e remover credencial ficam no cartão do serviço a
 *   que pertencem, porque a ação é sobre aquele Client ID e não sobre a etapa;
 * - **Ciclo do serviço** — "Pular o {serviço}" permanece adjacente ao cartão de
 *   conexão, reautorização, orçamento e revisão, com o comportamento da feature
 *   006 intacto (FR-062). Movê-lo para uma faixa genérica desfaria a ligação
 *   entre o que se pula e onde se está;
 * - **Resumo** — é resultado, não decisão. Não há o que avançar.
 */
const ACTION_BAR_BY_STEP: Partial<Record<WizardStep, () => JSX.Element>> = {
  destinations: DestinationsActionBar,
  input: InputActionBar,
};

export function Shell({ children, sidePanel }: ShellProps) {
  const narrow = useIsNarrowShell();
  const step = useAppStore((state) => state.step);

  const StepActionBar = ACTION_BAR_BY_STEP[step];

  return (
    <div className="bg-bg flex min-h-dvh flex-col">
      <Topbar narrow={narrow} />

      <div className="flex min-h-0 flex-1">
        {/*
          A zona da trilha. Abaixo do ponto de corte ela **não é renderizada** —
          o `StepSummary` toma o seu lugar no topo do conteúdo, logo adiante.

          A troca acontece em JavaScript e não por `display: none` porque as duas
          formas carregam `aria-current="step"`, e duas cópias — mesmo com uma
          escondida — seriam dois portadores da mesma afirmação para qualquer
          coisa que leia o DOM sem aplicar CSS (FR-041, FR-052).
        */}
        {!narrow && <StepRail />}

        <div className="flex min-w-0 flex-1 flex-col">
          {/*
            `flex-wrap` é o que faz FR-020 valer em toda largura. Sem ele, numa
            janela de 64rem — o próprio ponto de corte — o painel lateral
            espremeria a coluna primária para caber ao lado, e a medida de
            leitura de 42.5rem viraria 38 ou menos sem que nada falhasse. Com
            ele, o painel simplesmente desce quando não há espaço.
          */}
          <div className="flex min-w-0 flex-1 flex-col items-start gap-6 p-4 shell:flex-row shell:flex-wrap shell:justify-center">
            <main
              id="conteudo"
              className="shell:basis-measure flex w-full min-w-0 flex-1 flex-col gap-4"
            >
              {narrow && <StepSummary />}
              {children}
            </main>

            {/*
              O painel lateral **não rouba** a largura de leitura da coluna
              primária (FR-020): a coluna mantém `--container-measure` e o painel
              ocupa a sua própria medida ao lado. Em largura estreita o eixo do
              contêiner vira coluna e ele desce para baixo, sem que a ordem do
              DOM mude (FR-053).
            */}
            {sidePanel !== undefined && (
              <aside className="shell:zone-side-panel w-full min-w-0">{sidePanel}</aside>
            )}
          </div>

          {/*
            A barra de ações, **apenas** para as etapas de `ACTION_BAR_BY_STEP`.
            Vem por último no DOM porque é o último passo da leitura: estado da
            etapa, depois as ações que ele autoriza (FR-040).
          */}
          {StepActionBar !== undefined && <StepActionBar />}
        </div>
      </div>
    </div>
  );
}
