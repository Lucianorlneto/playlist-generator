import { WIZARD_STEPS, type WizardStep } from '@/domain/types';

import type { SliceCreator, WizardSlice } from './types';

function neighbour(step: WizardStep, offset: number): WizardStep {
  const index = WIZARD_STEPS.indexOf(step);
  const target = Math.min(WIZARD_STEPS.length - 1, Math.max(0, index + offset));
  return WIZARD_STEPS[target] ?? step;
}

export const createWizardSlice: SliceCreator<WizardSlice> = (set) => ({
  step: 'credential',
  stepToken: 0,

  goToStep: (step) =>
    set((state) => (state.step === step ? state : { step, stepToken: state.stepToken + 1 })),

  goNext: () =>
    set((state) => {
      const next = neighbour(state.step, 1);
      return next === state.step ? state : { step: next, stepToken: state.stepToken + 1 };
    }),

  goBack: () =>
    set((state) => {
      const previous = neighbour(state.step, -1);
      return previous === state.step ? state : { step: previous, stepToken: state.stepToken + 1 };
    }),
});
