import { useLayoutEffect } from 'react';

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
import { Stagger } from './motion';

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
 * A 010 acrescentou a entrada escalonada, e ela é suprimida pelo interruptor da
 * própria primitiva: `Stagger` consulta `useReducedMotion()`, porque a regra
 * global de CSS **não alcança** a biblioteca (010/FR-014).
 *
 * ## A entrada escalonada, uma vez por sessão (010/FR-032, FR-032a)
 *
 * Os onze assentam com `opacity` e `scale` por cima da inclinação, no papel
 * `decor`. A inclinação não muda: `rotate` é propriedade individual no `style`
 * em linha, e a biblioteca compõe `transform` — as duas convivem, e o ângulo
 * final é o da tabela (`010/contracts/surfaces.md` §5.1).
 *
 * A camada continua `absolute inset-0` e nunca esteve no fluxo, de modo que
 * nenhum quadro da entrada desloca conteúdo acima dela (FR-033).
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

/**
 * Já encenou nesta sessão? (FR-032a, `010/data-model.md` §4.1)
 *
 * Valor de **módulo, em memória**. Não entra no store porque nada além deste
 * componente precisa dele, e uma fatia nova existiria só para carregar um
 * booleano decorativo. Não é persistido porque um rascunho recuperado não deve
 * carregar o que já foi encenado — e recarregar a página é uma sessão nova, em
 * que reencenar é o comportamento certo.
 */
let jaEncenou = false;

/**
 * O sinalizador é lido e escrito por **função**, e nunca por atribuição direta
 * dentro do componente.
 *
 * Não é estilo: `react-hooks/globals` recusa reatribuir um módulo durante o
 * render, e com razão — sob `StrictMode` o render é invocado duas vezes em
 * desenvolvimento, e a segunda invocação leria o valor que a primeira acabou de
 * escrever. A leitura fica no render, a escrita fica no efeito, e as duas
 * invocações enxergam o mesmo estado.
 */
function primeiraAparicao(): boolean {
  return !jaEncenou;
}

function marcarEncenado(): void {
  jaEncenou = true;
}

/**
 * Devolve o sinalizador ao estado de sessão nova.
 *
 * **Existe para os testes**, e o prefixo diz isso. A alternativa seria exportar
 * o próprio sinalizador e deixá-lo gravável de fora, o que daria a qualquer tela
 * o poder de reencenar a decoração — exatamente o que o FR-032a recusa.
 */
export function __reencenarAdesivos(): void {
  jaEncenou = false;
}

export function Stickers() {
  /*
    Quem monta primeiro encena; a segunda visita a Destinos recebe os adesivos já
    postos (FR-032a).

    A marcação vai no efeito, e não no render, e isso importa: sob `StrictMode` o
    render roda duas vezes em desenvolvimento, e marcar durante ele faria a
    segunda passada decidir o contrário da primeira — a primeira aparição nunca
    encenaria. O efeito roda depois das duas, e nenhum render posterior desta
    montagem reconsulta o sinalizador.
  */
  const encenar = primeiraAparicao();
  useLayoutEffect(marcarEncenado, []);

  const pecas = STICKERS.map((sticker) => (
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
  ));

  /*
    Fora da primeira aparição, a camada é a mesma de sempre — sem primitiva no
    caminho. Montar `Stagger` e pedir que ele não anime seria maquinário ligado
    para não fazer nada, e a segunda visita é o caso comum.
  */
  if (!encenar) {
    return (
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {pecas}
      </div>
    );
  }

  /*
    `Stagger` **é** a camada: ele renderiza o contêiner e anima os filhos diretos.
    Um envoltório por adesivo criaria bloco de contenção para os
    `position: absolute` deles — a composição inteira desabaria no canto de uma
    caixa de altura zero (contracts/motion-catalog.md §2.2).
  */
  return (
    <Stagger
      role="decor"
      as="div"
      decorative
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {pecas}
    </Stagger>
  );
}
