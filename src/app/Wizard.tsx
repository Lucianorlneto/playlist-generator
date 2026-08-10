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
 */
export function Wizard() {
  const step = useAppStore((state) => state.step);
  const Screen = SCREENS[step];

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
        <DraftRecoveryBanner />
        <Screen />
      </div>
    </Shell>
  );
}
