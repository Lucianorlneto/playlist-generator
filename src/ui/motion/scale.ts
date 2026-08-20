/**
 * A escala de movimento — **a origem única de todo valor de tempo e de curva**
 * (FR-006, FR-007, FR-013; `010/contracts/motion-scale.md` §1).
 *
 * O par de `007/contracts/tokens.md`: aquilo é a origem única dos valores
 * **visuais**, isto é a dos valores de **tempo**. A disciplina e o motivo são os
 * mesmos — sem escala finita, cada superfície nova traz o seu próprio "0,35s,
 * quase-`easeOut`", e o sistema perde a propriedade que o torna reconhecível.
 *
 * ## Duas camadas, uma origem
 *
 * Este arquivo é a origem; o bloco `@theme` de `src/styles/index.css` é o
 * espelho, e `tests/unit/motion-scale.spec.ts` falha se as duas divergirem —
 * **e também se um token existir em apenas uma delas**, no mesmo molde de
 * `tests/unit/no-secrets.spec.ts`.
 *
 * O movimento do catálogo roda em JavaScript e precisa dos números **como
 * números**; `transition-colors` de `Button`, de `Toggle` e o conector da trilha
 * precisam deles **como texto**. Ler o CSS de dentro de uma primitiva —
 * `getComputedStyle` — colocaria acesso ao DOM na camada errada, custaria uma
 * leitura de layout por montagem e não funcionaria em `happy-dom`, onde os
 * testes de componente rodam (research §R5).
 *
 * ## Este é o único arquivo isento de `tp/no-raw-motion-values`
 *
 * Nem as próprias primitivas são isentas: elas importam daqui como qualquer
 * outro consumidor.
 */

/**
 * As durações **em milissegundos**, que é a unidade do contrato e a do CSS.
 *
 * | Nome | Papel |
 * | --- | --- |
 * | `quick` | microinteração de periferia — cor de chip, marcação de cartão, disco da trilha |
 * | `base` | o orçamento **herdado** do sistema: conector da trilha, fusão cruzada, troca de etapa |
 * | `settle` | acomodação de posição, o único momento em que o olho **segue** um objeto |
 * | `theme` | a fusão da troca de tema — a maior mudança visual que o produto faz |
 * | `spin` | período do giro (009, inalterado) |
 * | `pulse` | período da pulsação (009, inalterado) |
 *
 * **`base` é herdado, não escolhido**: é o orçamento que `docs/style-guide.md` já
 * fixava para o conector da trilha antes da 009. O sistema tem **um** tempo de
 * transição; os outros degraus existem porque têm papel que só eles atendem:
 *
 * - `quick` é mais curto porque microinteração de periferia acontece longe do
 *   olho. Nos 200ms de `base` a mudança de um chip no canto oposto termina
 *   depois que o olhar já passou.
 * - `settle` é mais longo porque é o único momento em que o olho precisa
 *   **seguir** um objeto de um lugar a outro. Uma acomodação de posição em 200ms
 *   lê como um salto com borrão.
 * - `theme` é o mais longo dos quatro porque é o único que muda a **tela inteira
 *   de uma vez**. Os outros movem uma zona; a troca de tema recolore cada
 *   superfície, cada filete e cada tratamento de imagem no mesmo quadro. A
 *   duração aqui é proporcional à **quantidade** de mudança, não à distância
 *   percorrida — em `base` a troca de tema lê como um piscar do monitor.
 *
 * **`spin` e `pulse` não são durações de transição** — são períodos de ciclo.
 * Estão aqui porque a origem única vale para todo valor de tempo, mas nenhuma
 * transição pode usá-los e nenhum ciclo pode usar os quatro primeiros.
 */
export const DURACAO_MS = {
  quick: 120,
  base: 200,
  settle: 320,
  theme: 400,
  spin: 1000,
  pulse: 1200,
} as const;

/** A unidade da biblioteca é o segundo; a do contrato e a do CSS é o milissegundo. */
function segundos(ms: number): number {
  return ms / 1000;
}

/**
 * As mesmas durações **em segundos**, que é a unidade que a biblioteca consome.
 *
 * Derivadas, nunca redigitadas: um segundo conjunto de literais seria uma
 * terceira camada a divergir, e o teste de espelho só vigia duas.
 */
export const DURACAO = {
  quick: segundos(DURACAO_MS.quick),
  base: segundos(DURACAO_MS.base),
  settle: segundos(DURACAO_MS.settle),
  theme: segundos(DURACAO_MS.theme),
  spin: segundos(DURACAO_MS.spin),
  pulse: segundos(DURACAO_MS.pulse),
} as const;

/**
 * As três curvas, como pontos de controle de Bézier
 * (`010/contracts/motion-scale.md` §1.3).
 *
 * | Nome | Papel |
 * | --- | --- |
 * | `standard` | entradas e trocas — o movimento chega e para |
 * | `through` | ciclos de ida e volta |
 * | `linear` | rotação contínua |
 *
 * Três. Uma quarta exige papel declarado que nenhuma das três atenda.
 *
 * ## Por que os números, e não os nomes da biblioteca
 *
 * `standard` e `through` são **exatamente** o `easeOut` e o `easeInOut` da
 * biblioteca, que por sua vez são as definições das palavras-chave `ease-out` e
 * `ease-in-out` do CSS. Escrever os pontos de controle é o que torna o espelho em
 * CSS uma comparação de números em vez de uma tabela de equivalência entre dois
 * vocabulários — e uma tabela de equivalência seria a terceira camada que este
 * arquivo existe para não ter.
 *
 * **Não são as curvas do Tailwind.** O `--ease-out` padrão dele é
 * `cubic-bezier(0, 0, 0.2, 1)`, um valor de outra linhagem; adotá-lo mudaria a
 * pulsação e o giro que a 009 já mediu.
 *
 * `linear` fica como palavra-chave porque é o caminho rápido da biblioteca: um
 * Bézier `[0, 0, 1, 1]` é matematicamente a mesma reta, mas paga uma resolução
 * de curva por quadro num giro que nunca para.
 */
export const CURVA: {
  /*
    Tupla **mutável** por dentro, e não `as const`: a definição de Bézier que a
    biblioteca aceita é `[number, number, number, number]`, e uma tupla
    `readonly` não é atribuível a ela. Os nomes do objeto continuam `readonly`,
    que é onde a imutabilidade importa — o que não pode acontecer é uma
    superfície trocar a curva de um papel.
  */
  readonly standard: [number, number, number, number];
  readonly through: [number, number, number, number];
  readonly linear: 'linear';
} = {
  standard: [0, 0, 0.58, 1],
  through: [0.42, 0, 0.58, 1],
  linear: 'linear',
};

/**
 * O escalonamento: passo entre irmãos consecutivos e **teto absoluto** da
 * defasagem acumulada, em milissegundos (FR-013, SC-009).
 */
export const ESCALONAMENTO_MS = {
  passo: 40,
  teto: 240,
} as const;

/**
 * A defasagem do irmão de índice `i`, **em segundos**.
 *
 * ```text
 * atraso(i) = min(i × passo, teto)
 * ```
 *
 * **O teto é o requisito, não o passo** (FR-013, SC-009). O `stagger()` da
 * biblioteca distribui proporcionalmente e não tem teto: 120 linhas a 40ms
 * fariam a última esperar 4,8s. Com o teto ela espera 240ms — o mesmo que a
 * última de uma lista de oito.
 *
 * Acima do sexto irmão a defasagem satura e as seguintes entram juntas. É o
 * comportamento certo: o papel do escalonamento é dar sequência à leitura das
 * primeiras, não fazer alguém esperar a centésima vigésima (research §R7).
 */
export function atrasoEscalonado(indice: number): number {
  const ms = Math.min(indice * ESCALONAMENTO_MS.passo, ESCALONAMENTO_MS.teto);
  return segundos(ms);
}
