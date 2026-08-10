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
  /**
   * Os destinos escolhidos, na ordem fixa do produto.
   *
   * **A fonte mudou na 008**: era `store.queue.order`, e passou a ser
   * `store.destinations.selected`. A `ExecutionQueue` só é construída ao sair da
   * etapa Entrada, e a regra nova de FR-028 precisa derivar **com a etapa
   * Destinos corrente** — instante em que `queue.order` ainda está vazia
   * (`data-model.md` §3, mudança 3).
   *
   * Não é uma segunda fonte de ordem: `destinations.selected` já é mantido
   * ordenado por `orderSelection`, pela mesma `PROVIDER_ORDER` de que
   * `buildQueue` deriva. Depois de `lockSelection`, os dois coincidem.
   */
  readonly destinations: readonly ProviderId[];
  /** Linhas analisadas da entrada. */
  readonly lineCount: number;
  /** Há credencial cadastrada. */
  readonly credentialsReady: boolean;
  /**
   * Execuções **encerradas** — com desfecho, qualquer que seja ele.
   *
   * Existe porque a regra nova, sem ele, produziria uma afirmação falsa: com a
   * guarda de estado removida, derivar a etapa Serviço de `destinations.length`
   * faria a trilha dizer "2 serviços concluídos" no instante em que o segundo
   * destino é marcado — muito antes de qualquer serviço concluir. O valor
   * decidido da etapa Serviço não é quantos destinos existem, é **quantos
   * serviços terminaram** (008/research §R7).
   */
  readonly servicesFinished: number;
}

/**
 * A regra única que decide entre `derived` e `neutral` (008/FR-028).
 *
 * **Deriva quando há valor decidido; fica neutra quando não há.** Uma frase, e
 * ela vale igualmente para degrau concluído, corrente **e à frente** — o estado
 * do degrau deixou de ser lido.
 *
 * ## O que a feature 008 revogou, e por que isso não afrouxa nada
 *
 * A 007 tinha uma guarda a mais: `if (state !== 'done') return neutral`. Eram
 * duas regras onde uma basta, e a segunda produzia um efeito que o arquivo de
 * design contradiz — na etapa Destinos corrente, com os dois serviços já
 * marcados, a linha continuava dizendo "Escolha onde criar as playlists" em vez
 * de nomear o que foi escolhido.
 *
 * **FR-066 continua literal**: a proibição de afirmar uma escolha que o usuário
 * não fez não dependia da guarda de estado, e sim da ausência de valor. Um
 * degrau sem dado real volta a `neutral` em vez de afirmar um vazio, e é isso —
 * não o `state` — que impede a trilha de reproduzir o "Spotify e YouTube" que o
 * mockup mostra sob Destinos já na tela de Configuração.
 */
function supportFor(step: WizardStep, snapshot: RailSnapshot): SupportLine {
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
      // informação de apoio da própria tela, não da trilha (FR-014).
      //
      // O valor decidido é a contagem de execuções **encerradas**, e não a de
      // destinos escolhidos. Com a guarda de estado removida (008/FR-028), a
      // segunda faria a trilha dizer "2 serviços concluídos" já na etapa
      // Destinos, no instante em que o segundo destino é marcado — que é
      // exatamente o que FR-029 proíbe. A correção é do valor, não da regra.
      const encerrados = snapshot.servicesFinished;
      return encerrados > 0
        ? {
            kind: 'derived',
            value: plural(encerrados, t.rail.derived.serviceOne, t.rail.derived.serviceOther),
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
      // `state` **não** entra: a regra deriva do valor, não do degrau (FR-028).
      support: supportFor(step, snapshot),
    };
  });
}
