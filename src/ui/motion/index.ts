/**
 * O **único** ponto de entrada da biblioteca de movimento (009/FR-010b,
 * 009/contracts/motion.md §1).
 *
 * Exporta exatamente **três** primitivas, uma por movimento autorizado:
 *
 * | Primitiva | Movimento | Propriedade |
 * | --- | --- | --- |
 * | `SpinningDisc` | giro contínuo do glifo | `transform: rotate` |
 * | `PulsingBar` | pulsação das barras de esqueleto | `opacity` |
 * | `CrossFade` | fusão cruzada esqueleto → resultado | `opacity` |
 *
 * **Nenhum reexport de `motion` nem de `motion.div`.** Um `export { motion }`
 * devolveria a chave à fechadura: qualquer arquivo passaria a poder animar o que
 * quisesse, e a contagem de três continuaria passando.
 *
 * O precedente é literal e está em `src/ui/icons.ts`: uma biblioteca externa
 * entra por um ponto, e o ponto é fechado por lint — `tp/no-motion-library-import`
 * — **e** por teste, `tests/unit/motion-surface.spec.ts`. As duas verificações
 * são redundantes de propósito: a de lint falha no editor, a de teste alcança
 * também os `.css` e sobrevive a uma supressão de lint.
 */

export { SpinningDisc } from './SpinningDisc';
export { PulsingBar } from './PulsingBar';
export { CrossFade } from './CrossFade';
