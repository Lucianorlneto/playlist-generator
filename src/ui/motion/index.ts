/**
 * O **único** ponto de entrada da biblioteca de movimento (FR-001 a FR-003,
 * `010/contracts/motion-catalog.md` §1 e §2).
 *
 * Exporta exatamente o catálogo, uma entrada por movimento autorizado:
 *
 * | Primitiva | Movimento | Propriedade | Degrau |
 * | --- | --- | --- | --- |
 * | `SpinningDisc` | giro contínuo do glifo | `rotate` | `spin` |
 * | `PulsingBar` | pulsação das barras de esqueleto | `opacity` | `pulse` |
 * | `CrossFade` | troca de conteúdo na mesma célula | `opacity` | `base` |
 * | `StepTransition` | troca de etapa, com direção | `opacity`, `x` | `base` |
 * | `Stagger` | entrada escalonada com teto | `opacity` + `y` \| `scale` | `base` |
 * | `Settle` | acomodação de posição em superfície ociosa | posição, por transformação | `settle` |
 *
 * ## A fechadura mudou de objeto na 010
 *
 * A 009 afirmava **"exatamente três"**. Esta feature afirma **quais são**: a
 * contagem nunca foi a invariante — era um proxy barato para ela. A invariante é
 * *toda animação do produto tem nome, papel e passou por revisão*, e um número
 * quebra quando um movimento novo entra **com** revisão, sem dizer qual mudou.
 *
 * Acrescentar uma primitiva custa **quatro edições no mesmo commit**: o arquivo,
 * este barril, a tabela de `010/contracts/motion-catalog.md` §2 e a asserção de
 * identidade em `tests/unit/motion-catalog.spec.ts`. Não é cerimônia — é o
 * FR-002, e é a revisão que se quer forçar.
 *
 * ## Nenhum reexport de `motion` nem de `motion.div`
 *
 * Um `export { motion }` devolveria a chave à fechadura: qualquer arquivo
 * passaria a poder animar o que quisesse, e o catálogo continuaria intacto.
 *
 * O precedente é literal e está em `src/ui/icons.ts`: uma biblioteca externa
 * entra por um ponto, e o ponto é fechado por lint — `tp/no-motion-library-import`
 * — **e** por teste, `tests/unit/motion-catalog.spec.ts`. As duas verificações
 * são redundantes de propósito: a de lint falha no editor, a de teste alcança
 * também os `.css` e sobrevive a uma supressão de lint.
 *
 * `scale.ts` **não é exportado daqui**: ele é dado, não movimento, e quem o
 * consome são as primitivas deste diretório. Uma superfície que precisasse de um
 * valor de tempo estaria configurando animação, que é o que o FR-004 proíbe.
 */

export { SpinningDisc } from './SpinningDisc';
export { PulsingBar } from './PulsingBar';
export { CrossFade } from './CrossFade';
export { StepTransition } from './StepTransition';
export { Stagger } from './Stagger';
export { Settle } from './Settle';
