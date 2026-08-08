import type { JSX } from 'react';

import type { WizardStep } from '@/domain/types';
import { SessionHeader } from '@/features/connect/SessionHeader';
import { CredentialStep } from '@/features/credential/CredentialStep';
import { DestinationsStep } from '@/features/destinations/DestinationsStep';
import { InputScreen } from '@/features/input/InputScreen';
import { ServiceStep } from '@/features/service/ServiceStep';
import { ThemeControl } from '@/features/theme/ThemeControl';
import { SummaryScreen } from '@/features/summary/SummaryScreen';
import { t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';

import { DraftRecoveryBanner } from './DraftRecoveryBanner';
import { ResetFlow } from './ResetFlow';
import { StepIndicator } from './StepIndicator';

const SCREENS: Record<WizardStep, () => JSX.Element | null> = {
  credential: CredentialStep,
  destinations: DestinationsStep,
  input: InputScreen,
  service: ServiceStep,
  summary: SummaryScreen,
};

/**
 * Fluxo linear de cinco etapas (FR-043):
 *
 * ```text
 * Configuração → Destinos → Entrada → [ciclo por serviço] → Resumo
 * ```
 *
 * O Wizard não decide quando avançar — cada etapa chama `goToStep` quando sua
 * própria condição de saída é satisfeita, e a etapa "Serviço" delega ao redutor
 * puro da fila. A movimentação de foco fica no `StepHeading` de cada tela,
 * disparada pelo `stepToken` que muda a cada transição.
 */
export function Wizard() {
  const step = useAppStore((state) => state.step);
  const Screen = SCREENS[step];

  return (
    /*
      A coluna de `--measure` (46rem) e a goteira de `--gutter` reservada em
      todas as etapas (design.md §4).

      A medida é um pouco mais estreita que os 48rem anteriores porque a linha
      de texto corrido ficava longa demais em tela grande. A goteira é a decisão
      estrutural: nas telas de lista ela carrega o numeral, nas demais fica
      vazia — mas a borda esquerda do conteúdo permanece na mesma posição em
      todo o fluxo. É o que faz cinco telas diferentes parecerem cinco páginas
      do mesmo documento.
    */
    <div className="mx-auto flex min-h-dvh w-full max-w-measure flex-col gap-4 px-4 py-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-ink text-section">{t.app.title}</h1>
          {/*
            O controle de tema entra à esquerda do `SessionHeader`, no fim do
            cabeçalho: é a única adição à ordem de tabulação que esta feature faz
            (SC-016), e ela acontece antes do conteúdo principal, não no meio dele.

            `ResetFlow` entra por último no grupo (`006/FR-013`, ui-contract §1).
            É o único ponto renderizado em **todas** as etapas, que é o que o
            requisito pede — e some sozinho quando não há trabalho a descartar.
          */}
          <div className="flex items-center gap-3">
            <ThemeControl />
            <SessionHeader />
            <ResetFlow />
          </div>
        </div>
        <StepIndicator current={step} />
      </header>

      <DraftRecoveryBanner />

      <main id="conteudo" className="app-card flex-1">
        <Screen />
      </main>
    </div>
  );
}
