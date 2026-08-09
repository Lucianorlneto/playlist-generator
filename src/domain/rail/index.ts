/**
 * A composição da trilha de etapas — regra, não apresentação (Princípio III).
 *
 * Quais degraus existem, como se numeram e o que cada um declara é **decisão de
 * negócio**. `src/app/StepRail.tsx` desenha o que este módulo devolve e não
 * decide nada: sem esta separação, a regra "a etapa Resumo só existe com mais de
 * um destino" continuaria vivendo duplicada entre o indicador e o redutor da
 * fila, como vivia até a feature 007.
 *
 * Puro: sem DOM, sem store, sem I/O, sem relógio. A entrada é um instantâneo do
 * estado; a saída é uma lista. `tests/unit/rail-composition.spec.ts` o percorre
 * inteiro sem renderizar nada.
 *
 * ## Sobre importar o dicionário aqui
 *
 * `@/i18n/pt-BR` é um objeto congelado de strings — um módulo de dados, tão puro
 * quanto `providers.ts`. O que o Princípio III isola é **I/O**, e não há nenhum.
 * A alternativa — devolver descritores e formatá-los no componente — espalharia
 * pela camada de apresentação exatamente a decisão que este módulo existe para
 * concentrar: *quando* uma linha de apoio pode afirmar algo.
 *
 * A dependência é de mão única e vale a pena vigiar: domínio → i18n, nunca
 * domínio → features. O nome de exibição de um provedor é lido direto de
 * `t.providers`, não de `features/credential/providerText`.
 */

import { format, listAnd, plural, t } from '@/i18n/pt-BR';

import type { ProviderId } from '../providers';
import { WIZARD_STEPS, type WizardStep } from '../types';

/**
 * A linha sob o nome da etapa.
 *
 * `neutral` não carrega valor: a descrição da etapa é fixa e o componente a lê
 * do dicionário pelo próprio `step`. `derived` carrega a frase já resolvida,
 * porque ela depende de dados que só existem aqui.
 */
export type SupportLine = { readonly kind: 'derived'; readonly value: string } | { readonly kind: 'neutral' };

export type RailStepState = 'done' | 'current' | 'pending';

export interface RailStep {
  readonly step: WizardStep;
  /** 1..N, contíguo, atribuído **depois** da filtragem. */
  readonly ordinal: number;
  readonly state: RailStepState;
  readonly support: SupportLine;
}

/** O instantâneo do estado de que a composição depende — e nada além dele. */
export interface RailSnapshot {
  readonly current: WizardStep;
  /** `store.queue.order`: os destinos escolhidos, na ordem fixa do produto. */
  readonly destinations: readonly ProviderId[];
  /** Linhas analisadas da entrada. */
  readonly lineCount: number;
  /** Há credencial cadastrada. */
  readonly credentialsReady: boolean;
}

/**
 * A regra única que decide entre `derived` e `neutral`.
 *
 * **Enquanto a etapa não está concluída, a linha descreve o que fazer; depois de
 * concluída, descreve o que foi decidido.** Uma frase, e ela satisfaz as quatro
 * regras que `data-model.md` §3 lista separadamente:
 *
 * - *derivada só quando há valor* — `done` implica que a decisão aconteceu;
 * - *degrau pendente nunca deriva* — `pending` não é `done`;
 * - *nunca afirmar o que não aconteceu* (FR-066) — é a mesma coisa dita de
 *   outro ângulo, e é o que separa esta implementação do mockup: o arquivo de
 *   design mostra "Spotify e YouTube" sob Destinos já na tela de Configuração;
 * - *a etapa atual pode diferir da concluída* (FR-067) — `current` recebe a
 *   linha neutra, `done` recebe a derivada.
 *
 * A exceção é a ausência de valor: um degrau `done` sem dado real volta a
 * `neutral` em vez de afirmar um vazio.
 */
function supportFor(step: WizardStep, state: RailStepState, snapshot: RailSnapshot): SupportLine {
  if (state !== 'done') return { kind: 'neutral' };

  switch (step) {
    case 'credential':
      return snapshot.credentialsReady
        ? { kind: 'derived', value: t.rail.derived.credential }
        : { kind: 'neutral' };

    case 'destinations': {
      if (snapshot.destinations.length === 0) return { kind: 'neutral' };
      const nomes = snapshot.destinations.map((id) => t.providers[id].name);
      return {
        kind: 'derived',
        value: format(t.rail.derived.destinations, { list: listAnd(nomes) }),
      };
    }

    case 'input':
      return snapshot.lineCount > 0
        ? {
            kind: 'derived',
            value: plural(snapshot.lineCount, t.rail.derived.inputOne, t.rail.derived.inputOther),
          }
        : { kind: 'neutral' };

    case 'service': {
      // A fase corrente do ciclo **não** entra aqui: seis fases por serviço são
      // informação de apoio da própria tela, não da trilha (FR-014). O que a
      // trilha declara sobre esta etapa é quantos serviços ela abrangeu.
      const total = snapshot.destinations.length;
      return total > 0
        ? {
            kind: 'derived',
            value: plural(total, t.rail.derived.serviceOne, t.rail.derived.serviceOther),
          }
        : { kind: 'neutral' };
    }

    case 'summary':
      // Nada é decidido no Resumo; ele é o resultado. Não há o que derivar.
      return { kind: 'neutral' };
  }
}

/**
 * Os degraus visíveis, já filtrados.
 *
 * O Resumo só existe com **mais de um destino** (FR-013): com um único destino a
 * tela de resultado é o fim do fluxo, e anunciar uma etapa que nunca vai
 * acontecer é informação falsa.
 */
function visibleSteps(snapshot: RailSnapshot): readonly WizardStep[] {
  return WIZARD_STEPS.filter((step) => step !== 'summary' || snapshot.destinations.length > 1);
}

/**
 * A trilha, pronta para desenhar.
 *
 * A numeração é atribuída **depois** da filtragem, e é por isso que com um único
 * destino a trilha numera 1‑2‑3‑4 em vez de 1‑2‑3‑5 (FR-013). Numerar antes e
 * esconder depois produziria um buraco visível que ninguém consegue explicar.
 */
export function composeRail(snapshot: RailSnapshot): RailStep[] {
  const steps = visibleSteps(snapshot);
  const currentIndex = steps.indexOf(snapshot.current);

  return steps.map((step, index) => {
    // Etapa corrente ausente da lista visível — só acontece se `current` for
    // `summary` com um destino só, estado que o fluxo não produz. Tratada como
    // "tudo pendente" em vez de lançar: a trilha é informação, e derrubar a
    // aplicação inteira por causa dela seria desproporcional.
    const state: RailStepState =
      currentIndex === -1
        ? 'pending'
        : index < currentIndex
          ? 'done'
          : index === currentIndex
            ? 'current'
            : 'pending';

    return {
      step,
      ordinal: index + 1,
      state,
      support: supportFor(step, state, snapshot),
    };
  });
}
