import { useEffect, useState } from 'react';

import { isNarrowShell, subscribeToShellWidth } from '@/services/viewport/shellWidth';

/**
 * `true` abaixo do ponto de corte, onde a casca de três zonas colapsa.
 *
 * ## Por que consulta em JavaScript e não só CSS
 *
 * Esconder por CSS — `shell:hidden` na barra superior, `hidden shell:block` na
 * trilha — funcionaria e custaria menos código. O que ele não dá é o que FR-052
 * e FR-054 exigem: que exista **um único** nó. Duas cópias da ação de recomeçar,
 * uma escondida por `display: none`, saem da ordem de tabulação corretamente no
 * navegador — mas passam a existir para qualquer coisa que leia o DOM sem
 * aplicar CSS, o que inclui os testes de componente e algumas ferramentas de
 * auditoria.
 *
 * Trocar em JavaScript mantém a promessa num lugar só: abaixo do corte a trilha
 * **não é renderizada**, e não há segundo controle a coordenar.
 *
 * O acesso a `matchMedia` fica no serviço, não aqui — é a mesma fronteira que
 * `src/services/theme/systemPreference.ts` estabelece (Princípio III).
 */
export function useIsNarrowShell(): boolean {
  const [narrow, setNarrow] = useState(isNarrowShell);

  useEffect(() => {
    // A largura pode ter mudado entre a primeira renderização e o efeito —
    // troca de orientação durante o arranque é o caso real.
    setNarrow(isNarrowShell());
    return subscribeToShellWidth(setNarrow);
  }, []);

  return narrow;
}
