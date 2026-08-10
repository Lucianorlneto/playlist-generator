import type { JSX, ReactNode } from 'react';

import type { WizardStep } from '@/domain/types';
import { CredentialActionBar } from '@/features/credential/CredentialActionBar';
import { DestinationsActionBar } from '@/features/destinations/DestinationsActionBar';
import { ExecutionOrderPanel } from '@/features/destinations/ExecutionOrderPanel';
import { InputActionBar } from '@/features/input/InputActionBar';
import { useAppStore } from '@/store';
import { AmbientBackdrop } from '@/ui/AmbientBackdrop';

import { StepContextLine } from './StepContextLine';
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
 * │  ④ Serviço        ├─ Barra de ações (Configuração·Destinos·Entrada)┤
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
 * O critério é **ter uma decisão de etapa a confirmar**, e as três que têm são
 * Configuração, Destinos e Entrada.
 *
 * **Configuração entrou na fidelidade de design da 008**, revertendo uma decisão
 * da 007. O argumento de lá — "esta etapa tem um cartão por serviço, cada um com
 * a sua ação" — continua valendo para **salvar e remover**, que permanecem nos
 * cartões porque são sobre aquele Client ID e não sobre a etapa. Ele não valia
 * para o avanço, que é decisão da etapa e não do cartão: numa página de dois mil
 * pixels de altura, um botão ao pé do conteúdo é um botão que só existe depois
 * de rolar tudo.
 *
 * As duas restantes mantêm as ações **dentro do cartão que as explica**:
 *
 * - **Ciclo do serviço** — "Pular o {serviço}" permanece adjacente ao cartão de
 *   conexão, reautorização, orçamento e revisão, com o comportamento da feature
 *   006 intacto (FR-062). Movê-lo para uma faixa genérica desfaria a ligação
 *   entre o que se pula e onde se está;
 * - **Resumo** — é resultado, não decisão. Não há o que avançar.
 */
const ACTION_BAR_BY_STEP: Partial<Record<WizardStep, () => JSX.Element>> = {
  credential: CredentialActionBar,
  destinations: DestinationsActionBar,
  input: InputActionBar,
};

/**
 * Painel lateral de apoio, por etapa.
 *
 * Hoje só Destinos o prevê. O mapa existe pela mesma razão do de barra de ações:
 * a decisão de qual etapa ganha painel é do sistema, não de cada tela, e ela
 * ficar num lugar só é o que torna "o painel não rouba a largura de leitura"
 * (FR-020) verificável em um ponto em vez de em cinco.
 */
const SIDE_PANEL_BY_STEP: Partial<Record<WizardStep, () => JSX.Element>> = {
  destinations: ExecutionOrderPanel,
};

export function Shell({ children, sidePanel }: ShellProps) {
  const narrow = useIsNarrowShell();
  const step = useAppStore((state) => state.step);

  const StepActionBar = ACTION_BAR_BY_STEP[step];
  const StepSidePanel = SIDE_PANEL_BY_STEP[step];

  return (
    /*
      **A casca ocupa a janela e não rola; quem rola é o conteúdo.**

      `h-dvh` com `overflow-hidden` no elemento raiz tira a rolagem do documento
      e a entrega ao contêiner da área principal, algumas linhas abaixo. É o que
      mantém a barra superior e a trilha à vista o tempo todo: as duas são zonas
      de orientação — "estou conectado?" e "onde eu estou?" —, e uma zona que
      responde a pergunta de orientação deixa de responder quando sai da tela.

      `dvh` e não `vh`: em navegador de telefone a barra de endereço entra e sai,
      e `100vh` mede a janela **sem** ela — a diferença é uma faixa de conteúdo
      cortada embaixo, que só aparece no aparelho de alguém.
    */
    /*
      **Sem `bg-bg` aqui, e a ausência é o conserto de um defeito.**

      A casca declarava o próprio substrato, e ele **apagava o fundo ambiente**.
      O motivo é a ordem de pintura de uma pilha: `AmbientBackdrop` carrega
      `z-index: -10`, o que faz dele um contexto de empilhamento negativo, e um
      contexto negativo é pintado **antes** dos fundos dos descendentes de bloco
      em fluxo do contexto ancestral. A casca é um desses descendentes — logo o
      seu `bg-bg` opaco cobria a textura inteira.

      O defeito é do tipo que esta base de código vigia: **nada falha**. A
      imagem carrega, tem o tamanho certo, a opacidade certa e o tratamento por
      tema certo, e simplesmente não se vê. Foi medido: o pixel do fundo dava
      exatamente `rgb(13, 17, 23)` — `--bg` puro, zero contribuição da textura —
      em toda a área principal.

      O substrato continua existindo, uma camada acima: `body` já declara
      `background-color: var(--bg)` em `@layer base`, e o fundo do `body` se
      propaga para a tela do documento, que é pintada **antes** dos contextos
      negativos. A textura passa a caber entre os dois, que é onde ela deve
      estar.
    */
    <div className="flex h-dvh flex-col overflow-hidden">
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

        {/*
          A área principal: **o que rola e o que fica** (nó `Ytv7C` do arquivo).

          Ela é uma coluna de dois filhos — o conteúdo, que toma a altura
          disponível e rola por dentro, e a barra de ações, de altura própria e
          fora da rolagem. É a mesma composição do arquivo, em que `Content`
          ocupa 814 px de 892 e `Action Bar` os 78 restantes, encostada no pé.

          `relative` **não é decoração**: ele torna este contêiner o bloco
          contêiner dos descendentes absolutos. `sr-only` — usado no numeral da
          trilha, no controle do cartão de destino e no rótulo de vários selos —
          é `position: absolute`, e sem um ancestral posicionado esses elementos
          se ancoram no **documento**. Eles então escapam do `overflow-hidden` da
          casca e inflam o `scrollHeight` do `html`, devolvendo ao documento uma
          rolagem que a estrutura acabou de tirar dele. Foi medido: 832 px de
          altura fantasma, invisíveis, que só a rolagem programática revelava.
        */}
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {/*
            A decoração de fundo, em camada absoluta atrás de tudo **dentro da
            área principal** — que é onde o arquivo a ancora, e não na janela
            (nós `eEqZf` e `D7q9e5`). Fora do fluxo de propósito: o conteúdo
            nunca espera por ela, e nada se desloca quando ela chega (FR-068,
            FR-070; SC-019, SC-020).

            Este contêiner não rola — quem rola é o filho —, então a textura fica
            imóvel sem precisar de `fixed`.
          */}
          <AmbientBackdrop />

          {/*
            **A única zona que rola.**

            `min-h-0` é o que torna isso possível: um item de flex tem
            `min-height: auto` por padrão e se recusa a encolher abaixo do
            próprio conteúdo, de modo que sem ele o contêiner cresceria e
            devolveria a rolagem ao documento — levando a barra superior e a
            trilha junto, que é exatamente o que esta estrutura desfaz.
          */}
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
            {/*
              `flex-wrap` é o que faz FR-020 valer em toda largura. Sem ele, numa
              janela de 64rem — o próprio ponto de corte — o painel lateral
              espremeria a coluna primária para caber ao lado, e a medida de
              leitura de 42.5rem viraria 38 ou menos sem que nada falhasse. Com
              ele, o painel simplesmente desce quando não há espaço.

              O respiro acompanha o arquivo: `Content` tem 48 px de goteira
              lateral e 36 px entre as duas colunas (nó `QYIVs`), e é o degrau de
              48 e o de 32 da escala que os traduzem. Abaixo do ponto de corte a
              casca colapsa em coluna única e o respiro volta a 16 px, que é o
              que cabe numa janela de 375 px.
            */}
            <div className="shell:flex-row shell:flex-wrap shell:justify-center shell:gap-8 shell:p-12 flex min-w-0 flex-1 flex-col items-start gap-6 p-4">
              <main
                id="conteudo"
                className="shell:basis-measure flex w-full min-w-0 flex-1 flex-col gap-4 self-stretch"
              >
                {narrow && <StepSummary />}
                {/*
                  **O bloco de cabeçalho** (008/FR-006, 008/research §R1).

                  A linha de contexto e o que vem abaixo dela ficam num respiro
                  próprio, mais estreito que o da coluna: no arquivo de design a
                  linha é o primeiro filho de `Heading`, não um irmão solto da
                  coluna primária (nó `jkrUm` dentro de `jHTKw`). O agrupamento
                  em si não é observável, mas o espaçamento é — e era ele que a
                  moldura do `Wizard` mascarava.

                  A ordem de leitura e a ordem no DOM ficam idênticas às do
                  arquivo: linha de contexto, depois o título da etapa.

                  `flex-1` no bloco: é ele que permite a uma etapa ancorar algo
                  no pé da coluna — hoje a faixa de adesivos de Destinos, que o
                  arquivo desenha encostada na base da coluna primária. Sem ele o
                  bloco teria altura de conteúdo e `mt-auto` não teria folga
                  nenhuma para consumir.
                */}
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <StepContextLine />
                  {children}
                </div>
              </main>

              {/*
                O painel lateral **não rouba** a largura de leitura da coluna
                primária (FR-020): a coluna mantém `--container-measure` e o
                painel ocupa a sua própria medida ao lado. Em largura estreita o
                eixo do contêiner vira coluna e ele desce para baixo, sem que a
                ordem do DOM mude (FR-053).

                `self-start` para o painel **não esticar** até o pé da área de
                conteúdo: ele tem a altura do que diz (493 px no arquivo, nó
                `T7goKr`), e um painel esticado transformaria a fotografia do pé
                numa faixa de altura variável.
              */}
              {(sidePanel !== undefined || StepSidePanel !== undefined) && (
                <aside className="shell:zone-side-panel w-full min-w-0 self-start">
                  {sidePanel ?? (StepSidePanel === undefined ? null : <StepSidePanel />)}
                </aside>
              )}
            </div>
          </div>

          {/*
            A barra de ações, **apenas** para as etapas de `ACTION_BAR_BY_STEP`.

            **Fora do contêiner que rola**, como a barra superior e a trilha: ela
            é a zona que responde "o que posso fazer agora, e por quê", e uma
            resposta que sai da tela quando o conteúdo é alto deixa de responder.
            Era o que acontecia — em Destinos, a faixa de adesivos empurrava
            "Continuar" para fora do campo de visão.

            Vem por último no DOM porque é o último passo da leitura: estado da
            etapa, depois as ações que ele autoriza (FR-040) — e aqui a ordem no
            DOM e a ordem visual continuam idênticas, porque ela também é o
            último elemento na vertical.
          */}
          {StepActionBar !== undefined && <StepActionBar />}
        </div>
      </div>
    </div>
  );
}
