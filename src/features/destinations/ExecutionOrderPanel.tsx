import moodPhoto from '@/assets/imgs/loja-de-discos-1637873416794_1920x1279 (1).jpg';
import { activeCount } from '@/domain/run/queue';
import { displayedQueue } from '@/domain/run/selection';
import { nameOf } from '@/features/credential/providerText';
import { format, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
import { cx } from '@/ui/cx';
import { Icon } from '@/ui/Icon';
import { Settle } from '@/ui/motion';

/**
 * O painel lateral da etapa de Destinos (008/FR-014 a FR-020; nó `T7goKr` em
 * `uy2ns`).
 *
 * **Substitui o `MoodPanel`**, que era decoração inteira e nenhum texto. A
 * decisão da 007 de deixá-lo sem palavras foi tomada para não repetir na lateral
 * o título e a introdução da etapa — e essa razão continua boa. O que o arquivo
 * põe aqui não é repetição: é a **ordem de execução**, que até agora aparecia
 * como parágrafo solto no corpo da etapa. Mover é o que FR-019 pede, e o
 * resultado é uma frase a menos na tela, não uma a mais.
 *
 * ## A composição, de cima para baixo, é a do arquivo
 *
 * ```text
 * Side Panel  T7goKr
 * ├── Panel Head  aAq4V   ícone `queue` em --accent-text + "Ordem de execução"
 * ├── Queue  uFd38        um item por destino selecionado, ou o convite
 * ├── Hint  Hix5w         --accent-tint, ícone `hint`
 * ├── Mood Photo  M0bYb   fotografia + véu por tema
 * └── Photo Caption  d5S1gP
 * ```
 *
 * **O texto vem antes da fotografia no DOM** (invariante P4), e a informação
 * permanece completa **sem** as imagens (P3, FR-018, SC-006) — que é a exigência
 * da 007 que sobrevive à revogação da decisão de painel mudo.
 *
 * ## O painel nunca some nem colapsa (P1, FR-015a)
 *
 * Com seleção vazia, cabeçalho, aviso, fotografia e legenda permanecem, e no
 * lugar da fila entra um convite. A alternativa — renderizar o painel só quando
 * há seleção — faria a coluna primária mudar de largura a cada clique, que é o
 * pior comportamento possível numa tela cuja única tarefa é clicar.
 */

/**
 * Mapa explícito de literais, nunca concatenação: o scanner do Tailwind lê o
 * código como texto e não resolve expressão (`tp/no-dynamic-classname`).
 */
const PROVIDER_ICON = {
  spotify: 'provider-spotify',
  youtube: 'provider-youtube',
} as const;

/**
 * A cor de marca **no glifo**, sobre substrato neutro.
 *
 * O marcador da fila **não** é preenchido com cor de marca: o arquivo o desenha
 * com `#FFFFFF0A` e contorno `--rule` (nó `kwx6k`), e só o glifo é tingido. A
 * exceção nomeada de 008/FR-004 vale exclusivamente para o distintivo do cartão
 * de destino, e `tp/no-raw-visual-values` recusa `bg-brand-tint-*` aqui.
 */
const BRAND_INK = {
  spotify: 'text-brand-spotify',
  youtube: 'text-brand-youtube',
} as const;

export function ExecutionOrderPanel() {
  const destinations = useAppStore((state) => state.destinations);
  const queue = useAppStore((state) => state.queue);
  const fila = displayedQueue(destinations);

  /*
    O portão de ociosidade de `Settle` (010/FR-030, FR-010a).

    A fila muda por **seleção**, não por trabalho: nesta etapa não há execução em
    curso, e é exatamente por isso que a animação de posição é admissível aqui.
    O portão é passado assim mesmo — `activeCount` é o invariante Q1 do domínio,
    e derivar o portão dele é o que torna a fronteira do FR-010 verificável em
    vez de convencional (contracts/motion-catalog.md §4).
  */
  const ocioso = activeCount(queue) === 0;

  return (
    <div className="border-rule bg-surface rounded-panel flex flex-col gap-4 border p-4">
      {/* Cabeçalho: o papel `queue` é `list-ordered` no arquivo, em âmbar. */}
      <div className="flex items-center gap-2">
        <Icon role="queue" className="text-accent-text text-section" />
        <h2 className="text-ink text-section">{t.destinations.panelTitle}</h2>
      </div>

      {/*
        A fila, ou o convite **no lugar dela** (FR-015a). O que não acontece: o
        painel encolher, a lista sumir sem explicação, ou uma altura reservada e
        vazia esperando a primeira marcação.
      */}
      {fila.length === 0 ? (
        <p className="text-ink-muted text-meta">{t.destinations.panelEmpty}</p>
      ) : (
        /*
          `Settle` não cria elemento: ele pendura a referência dele na própria
          `<ol>`. Um envoltório aqui produziria `ol > div > li`, que é violação
          séria na regra `list` do axe (contracts/motion-catalog.md §2.2).
        */
        <Settle idle={ocioso}>
          <ol className="flex flex-col">
            {fila.map((item, index) => {
              const anterior = fila[index - 1];
              return (
                <li key={item.provider} className="flex gap-3">
                  {/*
                  A coluna do marcador (`Marker Col`, nó `VqJwh`): o marcador e,
                  **abaixo dele**, o conector que liga um item ao seguinte. O
                  conector é o que torna a fila uma fila em vez de duas linhas
                  soltas — a ordem passa a ser visível na forma, não só escrita
                  na nota de cada item.
                */}
                  <span className="flex flex-col items-center gap-1">
                    {/*
                    O marcador: substrato neutro e contorno, com o glifo do
                    provedor na cor da marca (FR-001). Decorativo — o nome do
                    serviço está escrito ao lado (FR-005).
                  */}
                    <span
                      aria-hidden="true"
                      className="border-rule bg-surface-raised rounded-control flex size-8 shrink-0 items-center justify-center border"
                    >
                      <Icon
                        role={PROVIDER_ICON[item.provider]}
                        className={cx('text-section', BRAND_INK[item.provider])}
                      />
                    </span>

                    {/*
                    **Só entre itens**, nunca depois do último: um conector que
                    desce do último marcador para lugar nenhum promete uma etapa
                    a mais. É por isso que ele olha `index`, e não a existência
                    do item corrente.
                  */}
                    {index < fila.length - 1 && (
                      <span aria-hidden="true" className="bg-rule rounded-hair h-6 w-0.5" />
                    )}
                  </span>

                  <span className="flex min-w-0 flex-col gap-0.5 pt-1">
                    <span className="text-ink text-meta font-semibold">
                      {nameOf(item.provider)}
                    </span>
                    {/*
                    A nota de ordem relativa **não existe com um destino só**
                    (`solo`): "1º · será criada primeiro" numa fila de um item
                    anuncia uma ordem que não existe.
                  */}
                    {!item.solo && (
                      <span className="text-ink-muted text-data">
                        {anterior === undefined
                          ? t.destinations.panelFirst
                          : format(t.destinations.panelAfter, {
                              position: item.position,
                              previous: nameOf(anterior.provider),
                            })}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        </Settle>
      )}

      {/*
        O aviso de execução em série, sobre âmbar tingido. **É a única vez que a
        ordem é explicada na tela** (FR-019, SC-005) — o parágrafo que dizia o
        mesmo no corpo da etapa saiu.
      */}
      <p className="bg-accent-tint text-accent-tint-ink rounded-card text-meta flex items-start gap-2 p-3">
        {/*
          `mt-0.5` alinha o glifo à **primeira linha**, não ao topo da caixa. O
          ícone tem 1em de altura e a linha tem 1,45em: com `items-start` puro
          ele pousa quase 3px acima do centro óptico da linha, e a mesma correção
          de 2px já existe em `DraftRecoveryBanner` pelo mesmo motivo.
        */}
        <Icon role="hint" className="text-accent-text mt-0.5" />
        {t.destinations.panelHint}
      </p>

      {/*
        A fotografia e a sua legenda, **depois** do texto (P4, FR-018). Com as
        imagens desabilitadas o painel continua completo: cabeçalho, fila, aviso
        e legenda são texto real (SC-006).

        A razão de aspecto reserva a caixa antes de a imagem chegar — nada se
        desloca quando ela carrega, e sem imagem o painel não colapsa num buraco.

        **`2/1` e não `3/4`.** O arquivo desenha a fotografia com 148 px de
        altura sobre os 290 px úteis do painel (nó `M0bYb`), que é uma faixa
        larga e baixa; `3/4` a fazia crescer para perto de 390 px e o painel
        deixava de caber na tela — a legenda saía do campo de visão e a coluna da
        direita virava uma fotografia com um cabeçalho em cima.
      */}
      <div className="mood-photo rounded-card aspect-[2/1] w-full">
        <img
          src={moodPhoto}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
        />
        <span aria-hidden="true" className="mood-photo-veil" />
      </div>

      <p className="text-ink-muted text-data">{t.destinations.panelCaption}</p>
    </div>
  );
}
