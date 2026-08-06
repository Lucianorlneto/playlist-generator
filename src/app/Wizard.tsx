import type { JSX } from 'react';

import type { WizardStep } from '@/domain/types';
import { SessionHeader } from '@/features/connect/SessionHeader';
import { CredentialStep } from '@/features/credential/CredentialStep';
import { DestinationsStep } from '@/features/destinations/DestinationsStep';
import { InputScreen } from '@/features/input/InputScreen';
import { ServiceStep } from '@/features/service/ServiceStep';
import { SummaryScreen } from '@/features/summary/SummaryScreen';
import { t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';

import { DraftRecoveryBanner } from './DraftRecoveryBanner';
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
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-ink text-lg font-bold">{t.app.title}</h1>
          <SessionHeader />
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
