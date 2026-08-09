/**
 * Pontos de corte que existem **dos dois lados** — em CSS e em JavaScript.
 *
 * Este arquivo mora em `src/styles/` de propósito: ele é o espelho de
 * `--breakpoint-shell`, declarado no `@theme` de `index.css`, e a proximidade é
 * a única pista física de que os dois precisam andar juntos.
 *
 * **A duplicação não tem como ser evitada.** CSS não lê constante de JavaScript,
 * `@media` não aceita `var()`, e a casca precisa da medida nos dois lugares: o
 * CSS a usa para colapsar rótulos, o JavaScript para decidir se a trilha é
 * renderizada. A feature 005 tinha o mesmo par com `--breakpoint-gutter` e o
 * resolvia com um comentário; a 007 acrescenta o teste —
 * `tests/components/shell.spec.tsx` falha se as duas cópias divergirem.
 *
 * O valor foi medido em T042: a menor largura em que a trilha de 18.5rem e a
 * coluna de leitura de 42.5rem coexistem sem aperto.
 */
export const SHELL_BREAKPOINT_REM = 64;
