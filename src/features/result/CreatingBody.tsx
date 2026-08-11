import { committedItemCount } from '@/domain/batching';
import type { CreationProgress } from '@/domain/types';
import { format, t } from '@/i18n/pt-BR';
import { Icon } from '@/ui/Icon';
import { SpinningDisc } from '@/ui/motion';
import { RateLimitWaiting } from '@/ui/RateLimitWaiting';

/**
 * O corpo do cartão enquanto a criação está em voo (009/FR-001 a FR-013a; nó
 * `qBqxK — Service Result · Loading`, instanciado como `yjjDB` em `SjphR`).
 *
 * ## Por que são dois exports e não um componente
 *
 * A grade de esqueleto **não** vive aqui dentro. Ela e o `<dl>` de informações
 * reais dividem uma célula que é filha direta do cartão e está montada nos dois
 * estados — se a célula fosse filha deste corpo, desmontaria junto com ele no
 * instante em que o carregamento saísse, e não haveria fusão cruzada alguma a
 * executar (009/contracts/loading-card.md §5.1.1).
 *
 * Como o rodapé fica **abaixo** da grade e o indicador **acima** dela, a célula
 * compartilhada atravessa este conteúdo. Daí a partição:
 *
 * | Bloco | Conteúdo | Posição |
 * | --- | --- | --- |
 * | `CreatingIntro` | indicador, descrição, aviso de espera | acima da célula |
 * | `CreatingFootnote` | o rodapé `role="status"` | abaixo da célula |
 *
 * Os dois moram no mesmo arquivo porque são um bloco lógico só, partido por uma
 * restrição de layout — mantê-los juntos é o que deixa a partição legível.
 *
 * ## Nada aqui ramifica por provedor
 *
 * O nome do serviço chega **já resolvido** por `nameOf(provider)`, como em todo
 * o resto do produto (009/FR-023). Nada do que este arquivo desenha é colorido
 * pela marca: o disco é âmbar, as barras são neutras, os textos vêm da tinta
 * principal e da secundária.
 */

export interface CreatingIntroProps {
  /** Nome do serviço, já resolvido. Nunca um `ProviderId` (FR-023). */
  readonly service: string;
}

/**
 * Indicador, descrição e — enquanto durar — o aviso de espera (FR-002 a FR-006,
 * FR-018).
 *
 * **Devolve um Fragment, nunca um `<div>`.** Um envoltório viraria um único
 * filho flex da seção, precisaria repetir o `gap-4` por dentro, e a linha do
 * indicador deixaria de ser literalmente o 2º filho do cartão — que é a
 * aritmética inteira do SC-004 (009/contracts/loading-card.md §3).
 */
export function CreatingIntro({ service }: CreatingIntroProps) {
  return (
    <>
      {/*
        **A linha do indicador** (nó `RIMcK`), 48px de altura.

        A conta do SC-004: a coluna de texto mede 47,7px — título `text-step`
        (28,8px) + `gap-0.5` (2px) + subtítulo `text-meta` (16,9px) — e o disco
        mede 48px. Os dois ficam a 0,3px um do outro, então o topo do título
        coincide com o topo da linha, que é o mesmo ponto em que o `StepHeading`
        do cartão concluído começa. O deslocamento é **zero**, não uma tolerância.
      */}
      <div className="flex items-center gap-3">
        {/*
          Decorativo (FR-003): o estado está escrito no título ao lado, e o disco
          não é focável nem anunciado. O substrato é `--accent-tint-surface` e
          não `--accent-tint` porque este disco vive **dentro de um cartão**, sobre
          `--surface` — o outro mistura sobre `--surface-zone` e entregaria um
          disco bege num cartão branco no tema Papel.
        */}
        <div
          aria-hidden
          className="bg-accent-tint-surface flex size-12 shrink-0 items-center justify-center rounded-pill"
        >
          <SpinningDisc>
            {/* Sem `label`: `Icon` resolve para `aria-hidden`, que é o certo aqui. */}
            <Icon role="loading" className="text-accent-text text-step" />
          </SpinningDisc>
        </div>

        <div className="flex flex-col gap-0.5">
          <p className="text-ink text-step font-semibold">
            {format(t.playlistConfig.creating, { service })}
          </p>
          <p className="text-ink-muted text-meta">{t.result.creatingSubtitle}</p>
        </div>
      </div>

      {/*
        **A descrição** (nó `G37LNR`). Sem `role` e sem região viva: o texto é
        fixo do primeiro ao último quadro, e um `role="status"` aqui só
        acrescentaria um anúncio na montagem que o título já dá (FR-006).
      */}
      <p className="text-ink-muted text-body">{format(t.result.creatingDescription, { service })}</p>

      {/*
        **O aviso de espera, agora também na criação inicial** (FR-018).

        Antes desta feature ele aparecia só na busca e na retomada: um backoff no
        meio da primeira criação deixava a tela muda, e o disco girando não
        distingue "trabalhando" de "esperando o serviço liberar".

        Sem `onCancel` (FR-018b): cancelar uma escrita já confirmada em voo não é
        a mesma ação que cancelar uma busca, e esta feature não abre esse caminho.
        É o último nó acima da célula compartilhada, e some sem deixar buraco.
      */}
      <RateLimitWaiting
        variant="countdown"
        label={format(t.review.progressWaiting, { service })}
      />
    </>
  );
}

export interface CreatingFootnoteProps {
  readonly service: string;
  /** `null` enquanto a playlist ainda não foi criada na conta. */
  readonly creation: CreationProgress | null;
}

/**
 * O rodapé — **uma** região viva, com um nó só (FR-011 a FR-013; nó `mJCdf`).
 *
 * Dois nós que se revezassem produziriam dois anúncios na troca: a remoção de um
 * e a inserção do outro. O FR-013 pede um.
 *
 * O texto é a função pura de `009/data-model.md` §2 sobre `committedItemCount`,
 * que **já** é a fonte de verdade de quantos itens estão confirmados — a mesma
 * que a retomada usa para não duplicar. Nenhum contador novo é introduzido.
 *
 * A troca de forma acontece **uma vez**, no primeiro lote confirmado; depois
 * disso é o mesmo texto com outro número, que é o que a tela já fazia antes desta
 * feature. Na retomada (FR-025) `creation` chega do rascunho com
 * `committedItems > 0`, então o rodapé nasce mostrando progresso e nunca volta
 * para "aguardando" — dizer o contrário seria mentir sobre trabalho que já existe
 * na conta do usuário.
 *
 * A tinta é `--ink-muted`. O arquivo de design usa `#5B6474` aqui, uma terceira
 * tinta que **não** é adotada (FR-020): ela reprova em todos os substratos, e
 * todo valor que passa no limiar fica indistinguível de `--ink-muted`.
 */
export function CreatingFootnote({ service, creation }: CreatingFootnoteProps) {
  const confirmados = creation === null ? 0 : committedItemCount(creation);

  return (
    <p role="status" className="text-ink-muted text-meta">
      {creation === null || confirmados === 0
        ? format(t.result.awaitingConfirmation, { service })
        : format(t.result.creationProgress, {
            current: confirmados,
            total: creation.orderedUris.length,
          })}
    </p>
  );
}
