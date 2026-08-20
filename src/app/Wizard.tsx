import { useState, type JSX } from 'react';

import { stepDirection } from '@/domain/rail/stepDirection';
import type { WizardStep } from '@/domain/types';
import { CredentialStep } from '@/features/credential/CredentialStep';
import { DestinationsStep } from '@/features/destinations/DestinationsStep';
import { InputScreen } from '@/features/input/InputScreen';
import { ServiceStep } from '@/features/service/ServiceStep';
import { SummaryScreen } from '@/features/summary/SummaryScreen';
import { useAppStore } from '@/store';
import { StepTransition } from '@/ui/motion';

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
 *
 * ## O que a feature 008 tirou daqui
 *
 * **A moldura** (FR-006). Havia um `<div className="app-card">` envolvendo o
 * conteúdo de toda etapa, e ele é a caixa que o pedido aponta em volta de "Para
 * onde vai a playlist?". O arquivo de design não desenha cartão em volta de
 * cabeçalho de etapa em **nenhuma** das quatorze telas: `Heading` é filho direto
 * de `Primary Column`, sem preenchimento e sem contorno.
 *
 * O utilitário `app-card` **permanece** em `src/styles/index.css`, e continua
 * sendo usado por `MatchRow` e `SummaryScreen` — o arquivo desenha cartão para a
 * linha de correspondência (`g3IhDr`) e para o resultado por serviço (`x2kz71`).
 * Remover o utilitário junto com o uso errado seria trocar um defeito por outro
 * (008/research §R5).
 *
 * O respiro que o preenchimento do cartão fornecia passa a ser dado pelo `gap`
 * da coluna — degrau da escala, nunca valor arbitrário (FR-035).
 *
 * ## O que a feature 010 acrescentou
 *
 * A troca de etapa passou a ter **direção** (FR-021, FR-022). O alcance é
 * deliberadamente estreito: só `<Screen />` transita. A barra superior, a
 * trilha, a barra de ação e o aviso de rascunho ficam imóveis, porque nenhum
 * deles pertence a uma etapa (`010/contracts/surfaces.md` §1).
 *
 * A etapa anterior é **local a este componente**: não entra no store, não entra
 * em `draftPersistence` e não vira chave de armazenamento. É orquestração, não
 * estado de domínio — um rascunho recuperado não deve carregar a direção da
 * última transição (`010/data-model.md` §3).
 */
export function Wizard() {
  const step = useAppStore((state) => state.step);

  /*
    A etapa anterior, para derivar a direção.

    **`useState` e não `useRef`**, apesar de `data-model.md` §3 dizer "ref": a
    regra `react-hooks/refs` recusa tanto ler quanto escrever uma referência
    durante o render, e é durante o render que a direção precisa existir. O que
    o modelo de dados de fato exige está preservado — o par é **local ao
    `Wizard`**, não entra no store, não entra em `draftPersistence` e não vira
    chave de armazenamento: um rascunho recuperado não deve carregar a direção
    da última transição.

    O par mora num objeto só porque `anterior` sem `atual` não tem como saber que
    ficou velho. É o padrão de ajuste de estado durante o render que a
    documentação do React descreve, e o render extra acontece uma vez por troca.

    `anterior: null` na primeira montagem, e `stepDirection` devolve `0` para
    ele: montar numa etapa — recarregar a página, voltar do consentimento,
    restaurar um rascunho — não é uma troca e não anima (FR-024).
  */
  const [visto, setVisto] = useState<{
    atual: WizardStep;
    anterior: WizardStep | null;
  }>({ atual: step, anterior: null });

  if (visto.atual !== step) setVisto({ atual: step, anterior: visto.atual });

  const direcao = stepDirection(visto.anterior, visto.atual);
  const Screen = SCREENS[visto.atual];

  return (
    <Shell>
      {/*
        O agrupamento existe porque o `Shell` passou a aproximar a linha de
        contexto do que vem abaixo dela — é o respiro do **bloco de cabeçalho**,
        e não o da coluna. Sem este contêiner, o aviso de rascunho herdaria esse
        respiro estreito e colaria na tela da etapa.

        `flex-1` repassa a altura da coluna à tela da etapa. É o elo que faltava
        para uma etapa poder ancorar algo no pé da coluna — hoje a faixa de
        adesivos de Destinos: sem ele o agrupamento tem altura de conteúdo, e a
        folga que `mt-auto` consumiria fica presa **acima** dele, invisível.
      */}
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {/*
          **Fora** do bloco que transita, e é decisão (FR-021b). O aviso não
          pertence a nenhuma etapa — sobrevive a todas —, e transitá-lo junto o
          faria sair e voltar a cada avanço, sugerindo que sumiu. A entrada
          própria dele está no componente (contracts/surfaces.md §1.5).
        */}
        <DraftRecoveryBanner />

        {/*
          `flex-1` desce até aqui pela mesma razão de antes: a faixa de adesivos
          de Destinos ancora no pé da coluna, e o envoltório da transição está
          agora entre o agrupamento e a tela.
        */}
        <StepTransition step={visto.atual} direction={direcao}>
          <Screen />
        </StepTransition>
      </div>
    </Shell>
  );
}
