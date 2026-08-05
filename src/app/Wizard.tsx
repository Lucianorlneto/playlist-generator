import type { JSX } from 'react';

import type { WizardStep } from '@/domain/types';
import { CredentialStep } from '@/features/credential/CredentialStep';
import { SessionHeader } from '@/features/connect/SessionHeader';
import { InputScreen } from '@/features/input/InputScreen';
import { ResultScreen } from '@/features/result/ResultScreen';
import { ReviewScreen } from '@/features/review/ReviewScreen';
import { t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';

import { DraftRecoveryBanner } from './DraftRecoveryBanner';
import { StepIndicator } from './StepIndicator';

const SCREENS: Record<WizardStep, () => JSX.Element> = {
  credential: CredentialStep,
  input: InputScreen,
  review: ReviewScreen,
  result: ResultScreen,
};

/**
 * Fluxo linear de quatro etapas (FR-041). O Wizard não decide quando avançar —
 * cada etapa chama `goToStep` quando sua própria condição de saída é satisfeita.
 * A movimentação de foco fica no `StepHeading` de cada tela, disparada pelo
 * `stepToken` que muda a cada transição (FR-046).
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
