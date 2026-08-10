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
 * ## A composição é a do arquivo, não uma dispersão pelas bordas
 *
 * A versão anterior pendurava os adesivos nas **margens** de uma faixa de 3rem
 * (`-left-8`, `top-1/4`, `-right-6`), e o resultado era o que o arquivo não
 * desenha: onze recortes espremidos e meio cortados nas duas beiradas da coluna.
 * O nó `wv9Cp` (`Stickers Decor`) é uma **superfície de 680 × 210** com os onze
 * espalhados por dentro dela, a 55% de opacidade e com recorte.
 *
 * A tabela abaixo é a transcrição literal desse nó — posição, largura e
 * inclinação de cada grupo, na grade de 680 × 210 do arquivo. Sortear posições
 * faria cada carga produzir uma composição diferente, e "decoração" não é
 * desculpa para instabilidade visual entre visitas.
 *
 * ## Por que as medidas viram `style` e não classe utilitária
 *
 * Porque são **coordenadas**, não degraus de escala. `left-[6.18%]` seria valor
 * arbitrário — exatamente o que `tp/no-raw-visual-values` recusa — e um degrau
 * de espaçamento não descreve "42 de 680". A proporção precisa vir da própria
 * grade do arquivo para a composição sobreviver ao redimensionamento da coluna,
 * e é a razão de a faixa carregar a razão de aspecto de 680/210: com ela, tudo
 * aqui escala junto e as distâncias relativas ficam as do desenho.
 *
 * ## Movimento suprimido
 *
 * FR-035: sob `prefers-reduced-motion` qualquer movimento é suprimido. A regra
 * global de `index.css` já zera transição e animação; a inclinação de cada
 * adesivo é **geometria estática** — o desenho nasce torto —, e não movimento a
 * suprimir.
 *
 * ## Tratamento por tema (FR-049)
 *
 * Os adesivos foram compostos contra o quase-preto. `sticker` é o utilitário que
 * carrega o tratamento por tema — no claro, um contorno suave que impede a arte
 * clara de desaparecer sobre o papel. **Cada um foi verificado individualmente
 * sobre o substrato claro** em T074; nenhum foi deixado invisível.
 */

/** A grade do nó `wv9Cp`. Toda medida abaixo é relativa a ela. */
const GRID_WIDTH = 680;
const GRID_HEIGHT = 210;

interface Sticker {
  readonly src: string;
  /** Canto superior esquerdo na grade do arquivo. */
  readonly x: number;
  readonly y: number;
  /** Largura do grupo no arquivo, já sem a inclinação. */
  readonly width: number;
  /**
   * Inclinação em graus **no sentido do CSS** (positivo = horário).
   *
   * O arquivo mede no sentido anti-horário, então o sinal está invertido em
   * relação ao valor bruto de `rotation` de cada grupo.
   */
  readonly tilt: number;
  /**
   * Classe extra de tratamento, quando a arte precisa de mais que o padrão.
   *
   * Literal e completa, nunca montada por interpolação: o scanner do Tailwind lê
   * o código como texto e não resolve expressão (`tp/no-dynamic-classname`).
   */
  readonly treatment?: string;
}

const STICKERS: readonly Sticker[] = [
  { src: vinyl1, x: 42, y: 17, width: 55, tilt: 8 },
  { src: cassette1, x: 211, y: 14, width: 57, tilt: -6 },
  { src: headphones1, x: 384, y: 18, width: 52, tilt: 5 },
  { src: boombox, x: 570, y: 22, width: 59, tilt: -8 },
  { src: cassette2, x: 60, y: 92, width: 60, tilt: -5 },
  { src: star1, x: 181, y: 86, width: 18, tilt: 0 },
  { src: playButton, x: 304, y: 93, width: 52, tilt: 10 },
  { src: star2, x: 491, y: 91, width: 18, tilt: -15 },
  { src: headphones2, x: 592, y: 107, width: 35, tilt: -12 },
  /*
    `sticker-faint`: medido em 1,40:1 sobre o substrato claro (T074) — abaixo do
    limiar em que a silhueta ainda é perceptível. É o único dos onze que precisa
    da variante reforçada; os demais ficam entre 1,67 e 2,80.
  */
  { src: vinyl2, x: 112, y: 142, width: 56, tilt: 6, treatment: 'sticker-faint' },
  { src: cassette3, x: 400, y: 142, width: 59, tilt: -4 },
];

/** Fração da grade, em porcentagem, com a precisão que o arquivo declara. */
function percent(value: number, total: number): string {
  return `${((value / total) * 100).toFixed(3)}%`;
}

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
          className={cx('sticker absolute', sticker.treatment)}
          style={{
            left: percent(sticker.x, GRID_WIDTH),
            top: percent(sticker.y, GRID_HEIGHT),
            width: percent(sticker.width, GRID_WIDTH),
            // A inclinação gira em torno do centro; o arquivo gira em torno do
            // canto. A diferença, nos ângulos usados aqui (4° a 15°), é de
            // poucos pixels — e girar pelo canto deslocaria cada peça da
            // posição que a tabela acima declara.
            rotate: `${sticker.tilt}deg`,
          }}
        />
      ))}
    </div>
  );
}
