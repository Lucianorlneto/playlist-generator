import { t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
import { StepHeading } from '@/ui/StepHeading';
import { Stickers } from '@/ui/Stickers';

import { DestinationSelector } from './DestinationSelector';

/**
 * Etapa 2: para onde a playlist vai (US1, FR-008 a FR-012, FR-043).
 *
 * O avanço é bloqueado com zero destinos (FR-011) e a mensagem explica o que
 * falta — não é um botão apagado sem explicação. Essa mensagem vive na barra de
 * ações desde a 007, junto com a contagem de destinos selecionados.
 *
 * ## O que a feature 008 tirou daqui
 *
 * **A explicação da ordem de execução** (FR-019, SC-005). Ela era um parágrafo
 * ao pé do seletor — "Quando você escolhe os dois, executamos um serviço de cada
 * vez…" — e agora vive uma **única vez**, no painel "Ordem de execução", que é
 * onde o arquivo de design a põe. A contagem de destinos **permanece** na barra
 * de ações, que é o outro lugar em que o arquivo a desenha.
 *
 * **Os adesivos entraram.** Eles estavam dentro do painel lateral, competindo
 * com a fotografia; o arquivo os põe na coluna primária, abaixo dos cartões de
 * destino (`Primary Column > Frame 1 > Stickers Decor`, nó `wv9Cp`).
 */
export function DestinationsStep() {
  const stepToken = useAppStore((state) => state.stepToken);

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4">
      <StepHeading
        title={t.destinations.heading}
        description={t.destinations.intro}
        focusToken={stepToken}
      />

      <DestinationSelector />

      {/*
        A decoração da coluna primária, na superfície que o arquivo lhe dá:
        `stickers-band` carrega a razão de aspecto de 680 × 210 do nó `wv9Cp`, e
        `Stickers` põe os onze em fração dessa grade. A faixa de 3rem anterior
        não cabia a composição e empurrava os adesivos para as duas beiradas.

        Os adesivos vivem numa camada absoluta — eles **não ocupam células de
        layout**, e é isso que faz a etapa permanecer idêntica em conteúdo e sem
        buraco com as imagens desabilitadas (SC-014). Todos são `aria-hidden`
        com `alt` vazio.

        `mt-auto` a empurra para o pé da coluna, que é onde o arquivo a ancora
        (`Frame 1` é absoluto em y = 534 de uma coluna de 744).

        `max-w-measure` a trava na largura de leitura. A coluna primária cresce
        além dela em janela larga, e uma faixa presa à razão de 680 × 210 cresce
        **em altura** junto: a 1920 px a decoração passava de 350 px e virava o
        assunto da tela. 680 é a medida em que o arquivo a desenhou.
      */}
      <div aria-hidden="true" className="stickers-band max-w-measure mt-auto">
        <Stickers />
      </div>
    </section>
  );
}
