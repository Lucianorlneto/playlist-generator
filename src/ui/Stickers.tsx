import boombox from '@/assets/imgs/Boombox.png';
import cassette1 from '@/assets/imgs/Cassette 1.png';
import cassette2 from '@/assets/imgs/Cassette 2.png';
import cassette3 from '@/assets/imgs/Cassette 3.png';
import headphones1 from '@/assets/imgs/Headphones 1.png';
import headphones2 from '@/assets/imgs/Headphones 2.png';
import playButton from '@/assets/imgs/Play Button.png';
import star1 from '@/assets/imgs/Star 1.png';
import star2 from '@/assets/imgs/Star 2.png';
import vinyl1 from '@/assets/imgs/Vinyl 1.png';
import vinyl2 from '@/assets/imgs/Vinyl 2.png';

import { cx } from './cx';

/**
 * Os onze adesivos da etapa de Destinos (FR-034, FR-035, FR-049, FR-068).
 *
 * **Nenhum deles carrega informação.** São `aria-hidden` com `alt` vazio, e a
 * tela é idêntica em conteúdo sem eles — SC-014 exige que ela permaneça
 * plenamente utilizável e sem buraco com imagens desabilitadas, e é por isso que
 * eles vivem numa camada absoluta em vez de ocupar células de layout.
 *
 * ## Posições declaradas, não aleatórias
 *
 * A tabela abaixo é a transcrição do arquivo de design. Sortear posições faria
 * cada carga produzir uma composição diferente — e "decoração" não é desculpa
 * para instabilidade visual entre visitas.
 *
 * ## Movimento suprimido
 *
 * FR-035: sob `prefers-reduced-motion` qualquer movimento é suprimido. A regra
 * global de `index.css` já zera transição e animação; aqui não há movimento
 * próprio a coordenar, e o `motion-safe:` da rotação é o que a torna opcional em
 * vez de imposta.
 *
 * ## Tratamento por tema (FR-049)
 *
 * Os adesivos foram compostos contra o quase-preto. `sticker` é o utilitário que
 * carrega o tratamento por tema — no claro, um contorno suave que impede a arte
 * clara de desaparecer sobre o papel. **Cada um foi verificado individualmente
 * sobre o substrato claro** em T074; nenhum foi deixado invisível.
 */

interface Sticker {
  readonly src: string;
  /**
   * A classe **completa e literal** de posição, tamanho e inclinação.
   *
   * Literal, e não montada por interpolação, por duas razões que se somam: o
   * scanner do Tailwind lê o código como texto e não resolve expressão — uma
   * classe montada em tempo de execução simplesmente não é emitida —, e
   * `tp/no-dynamic-classname` recusa a construção justamente por isso.
   *
   * As posições verticais usam **frações** e não degraus de espaçamento: a
   * escala finita da 007 vai até `12` (3rem), e distribuir onze adesivos ao
   * longo de um painel alto com ela exigiria inventar degraus. Fração é medida
   * relativa ao contêiner, não uma medida avulsa — não fura a escala, opera em
   * outro eixo.
   */
  readonly className: string;
}

const STICKERS: readonly Sticker[] = [
  { src: vinyl1, className: 'top-0 -left-8 size-12 motion-safe:-rotate-6' },
  /*
    `sticker-faint`: medido em 1,40:1 sobre o substrato claro (T074) — abaixo do
    limiar em que a silhueta ainda é perceptível. É o único dos onze que precisa
    da variante reforçada; os demais ficam entre 1,67 e 2,80.
  */
  { src: vinyl2, className: 'sticker-faint top-0 -right-6 size-8 motion-safe:rotate-12' },
  { src: cassette1, className: 'top-1/4 -left-6 size-12 motion-safe:rotate-6' },
  { src: cassette2, className: 'top-1/4 -right-8 size-8 motion-safe:-rotate-12' },
  { src: cassette3, className: 'top-1/2 -left-8 size-8 motion-safe:rotate-3' },
  { src: headphones1, className: 'top-1/2 -right-6 size-12 motion-safe:-rotate-3' },
  { src: headphones2, className: 'top-3/4 -left-6 size-8 motion-safe:rotate-6' },
  { src: boombox, className: 'top-3/4 -right-8 size-12 motion-safe:-rotate-6' },
  { src: star1, className: 'top-4 right-4 size-4 motion-safe:rotate-12' },
  { src: star2, className: 'bottom-0 left-4 size-4 motion-safe:-rotate-12' },
  { src: playButton, className: 'bottom-0 right-12 size-6 motion-safe:rotate-6' },
];

export function Stickers() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {STICKERS.map((sticker) => (
        <img
          key={sticker.src}
          src={sticker.src}
          alt=""
          loading="lazy"
          decoding="async"
          className={cx('sticker absolute', sticker.className)}
        />
      ))}
    </div>
  );
}
