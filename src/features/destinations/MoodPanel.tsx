import moodPhoto from '@/assets/imgs/loja-de-discos-1637873416794_1920x1279 (1).jpg';
import { Stickers } from '@/ui/Stickers';

/**
 * O painel lateral de apoio da etapa de Destinos (FR-020, FR-034, FR-049).
 *
 * **Não rouba a largura de leitura** da coluna primária: ele ocupa
 * `--side-panel-width` ao lado dela, e em largura estreita desce para baixo, pelo
 * `flex-wrap` do `Shell`. É a forma executável de FR-020.
 *
 * ## Ele é decoração inteira, e nenhum texto
 *
 * A primeira versão repetia aqui o título e a introdução da etapa. Ficou óbvio
 * na primeira conferência de fidelidade por que isso está errado: **a mesma
 * frase aparecia duas vezes na mesma tela**, uma na coluna de leitura e outra a
 * 30cm dela. Repetir não é reforçar — é dividir a atenção entre duas cópias e
 * obrigar o leitor a conferir se dizem a mesma coisa.
 *
 * O painel ficou com o que o arquivo de design põe nele: clima. Fotografia e
 * adesivos, ambos `aria-hidden` com `alt` vazio, carregados de forma diferida.
 * Com imagens desabilitadas a etapa continua completa, porque **nada** que
 * exista aqui é informação (SC-014).
 *
 * A sobreposição em degradê é **declarada por tema** (FR-049): a que o design
 * mostra caminha para o quase-preto e escureceria demais sobre papel. As duas
 * versões vivem em `mood-photo-veil`, em `src/styles/index.css`.
 */
export function MoodPanel() {
  return (
    <div className="border-rule bg-surface-zone rounded-panel relative overflow-hidden border">
      {/*
        `aspect-video` reserva a caixa **antes** de a imagem chegar: nada se
        desloca quando ela carrega (FR-070, SC-020), e sem imagem o painel não
        colapsa num buraco.
      */}
      <div className="mood-photo aspect-[3/4] w-full">
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

      {/*
        Os adesivos sobrepõem o painel inteiro. **Sem `-z-10`**: a primeira
        versão os punha atrás, e como o painel tem fundo próprio eles ficavam
        invisíveis — o defeito que só a conferência visual pega, porque `src`,
        `alt` e tamanho estavam todos corretos.
      */}
      <Stickers />
    </div>
  );
}
