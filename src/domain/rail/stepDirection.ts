import { WIZARD_STEPS, type WizardStep } from '@/domain/types';

/** Avanço, retorno, ou nenhum dos dois. */
export type StepDirection = -1 | 0 | 1;

/**
 * A direção de uma troca de etapa (FR-022, FR-024; `010/data-model.md` §3).
 *
 * | Entrada | Saída | Significado |
 * | --- | --- | --- |
 * | `from` é `null` | `0` | primeira montagem — não é troca, não anima |
 * | `from` vem antes de `to` | `1` | avanço |
 * | `from` vem depois | `-1` | retorno |
 * | `from === to` | `0` | nada mudou |
 *
 * ## Por que mora em `src/domain/rail/`
 *
 * Porque é regra, não apresentação: qual etapa vem antes de qual é conhecimento
 * do fluxo, e `rail/` já é o lar da regra que decide o que a trilha mostra a
 * partir da posição no fluxo. Direção é a mesma família (Princípio III).
 *
 * Sem DOM, sem relógio, sem estado — o que permite `tests/unit/step-direction.spec.ts`
 * cobrir **todo par** de etapas em vez de amostrar alguns numa tela montada.
 *
 * ## A ordem canônica não é duplicada
 *
 * `WIZARD_STEPS` é a origem, e uma etapa nova no fluxo passa a ter direção sem
 * que este arquivo mude. Uma segunda lista aqui seria a que envelheceria.
 *
 * ## Zero significa sem movimento
 *
 * Recarregar a página, voltar do retorno de autorização ou restaurar um rascunho
 * não é uma troca (FR-024). Devolver `0` é o que faz o `initial={false}` de
 * `StepTransition` valer na prática, em vez de depender de o chamador lembrar.
 */
export function stepDirection(from: WizardStep | null, to: WizardStep): StepDirection {
  if (from === null) return 0;

  const origem = WIZARD_STEPS.indexOf(from);
  const destino = WIZARD_STEPS.indexOf(to);

  /*
    Uma etapa fora da ordem canônica não tem direção a declarar. O caso não é
    alcançável pelo tipo, e o tratamento existe pelo mesmo motivo que a leitura
    de armazenamento nunca lança: o modo de falha certo aqui é ficar parado, não
    animar para um lado arbitrário.
  */
  if (origem === -1 || destino === -1) return 0;

  if (origem < destino) return 1;
  if (origem > destino) return -1;
  return 0;
}
