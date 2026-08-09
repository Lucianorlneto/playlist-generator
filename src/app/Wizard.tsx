import type { JSX } from 'react';

import type { WizardStep } from '@/domain/types';
import { CredentialStep } from '@/features/credential/CredentialStep';
import { DestinationsStep } from '@/features/destinations/DestinationsStep';
import { InputScreen } from '@/features/input/InputScreen';
import { ServiceStep } from '@/features/service/ServiceStep';
import { SummaryScreen } from '@/features/summary/SummaryScreen';
import { useAppStore } from '@/store';

import { DraftRecoveryBanner } from './DraftRecoveryBanner';
import { Shell } from './Shell';

const SCREENS: Record<WizardStep, () => JSX.Element | null> = {
  credential: CredentialStep,
  destinations: DestinationsStep,
  input: InputScreen,
  service: ServiceStep,
  summary: SummaryScreen,
};

/**
 * Fluxo linear de cinco etapas:
 *
 * ```text
 * Configuração → Destinos → Entrada → [ciclo por serviço] → Resumo
 * ```
 *
 * O Wizard não decide quando avançar — cada etapa chama `goToStep` quando sua
 * própria condição de saída é satisfeita, e a etapa "Serviço" delega ao redutor
 * puro da fila. A movimentação de foco fica no `StepHeading` de cada tela,
 * disparada pelo `stepToken` que muda a cada transição.
 *
 * ## O que a feature 007 tirou daqui
 *
 * O cabeçalho inteiro. Título, controle de tema, contas, indicação de etapa e
 * ação de recomeçar eram montados neste componente e passaram para as zonas do
 * `Shell`, que existem em todas as etapas e não são remontadas a cada transição.
 * O Wizard ficou com a única responsabilidade que sempre foi dele: escolher qual
 * tela renderizar.
 */
export function Wizard() {
  const step = useAppStore((state) => state.step);
  const Screen = SCREENS[step];

  return (
    <Shell>
      <DraftRecoveryBanner />
      <div className="app-card">
        <Screen />
      </div>
    </Shell>
  );
}
