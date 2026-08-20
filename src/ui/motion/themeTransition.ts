/**
 * A fusão da troca de tema (010/FR-029, degrau `theme` da escala).
 *
 * ## Por que não é uma primitiva do catálogo
 *
 * O catálogo governa a **biblioteca de movimento**: seis componentes, cada um
 * com papel, e uma fechadura em volta do `import`. Este arquivo não importa a
 * biblioteca e não renderiza nada — ele decide **se** a troca de tema atravessa
 * a transição de vista do navegador. A animação em si é do navegador, e o tempo
 * dela mora no CSS, ao lado do resto da escala.
 *
 * Mora em `src/ui/motion/` mesmo assim, e o motivo é o mesmo de `scale.ts`:
 * decisão de movimento se decide num lugar só. Não é exportado pelo barril —
 * ele reexporta o catálogo, e nada além.
 *
 * ## O que a transição de vista faz, e por que ela é a ferramenta certa aqui
 *
 * Ela fotografa a tela antes, aplica a mudança e funde a foto velha na nova.
 * Uma `transition-colors` global alcançaria só o que é cor, e a troca de tema
 * neste produto move mais que cor: o tratamento por tema dos adesivos, o véu da
 * fotografia do painel e a textura do fundo ambiente trocam por regra de
 * `[data-theme]`. Fundir metade da tela e saltar a outra metade é pior do que
 * não fundir.
 *
 * ## O que a fusão custa, dito com precisão
 *
 * A API **não** aplica a mudança de forma síncrona: ela fotografa o estado
 * atual e chama `mudar` no quadro seguinte. O atributo `data-theme`, portanto,
 * troca um quadro depois do clique.
 *
 * Isso não é visível e não atrasa nada — a fotografia já está na tela —, mas é
 * observável por quem lê o DOM logo depois de acionar o controle. **O estado do
 * store continua síncrono**: `effectiveTheme` muda no mesmo tique, e é dele que
 * o `ThemeControl` tira qual segmento está selecionado. O que espera um quadro é
 * só a pintura, que é justamente o que se quer fundir.
 *
 * A página segue interativa durante a fusão: a camada de pseudo-elementos não
 * recebe ponteiro.
 */

/** O que a API expõe, e é só o que este arquivo usa. */
interface DocumentoComTransicaoDeVista {
  startViewTransition?: (callback: () => void) => unknown;
}

/**
 * Há suporte e a pessoa não pediu menos movimento?
 *
 * As duas metades são necessárias e nenhuma cobre a outra:
 *
 * - **Suporte** porque a API é recente. Sem ela a troca acontece seca, que é
 *   exatamente o comportamento de antes desta mudança — degradar aqui não custa
 *   informação nenhuma, custa um enfeite.
 * - **Preferência** porque a fusão cobre a tela inteira, e é o movimento mais
 *   amplo que o produto faz. A regra de CSS em `index.css` também a suprime; a
 *   redundância é deliberada, e é a mesma disciplina de cada primitiva consultar
 *   o próprio `useReducedMotion()`.
 */
function deveFundir(documento: Document): boolean {
  if (typeof (documento as DocumentoComTransicaoDeVista).startViewTransition !== 'function') {
    return false;
  }

  /*
    `matchMedia` pode não existir no ambiente de teste. Ausência é tratada como
    "sem preferência declarada" e não como "reduzir": o modo de falha certo aqui
    é o comportamento padrão, e quem de fato pediu menos movimento é atendido
    pela consulta quando ela existe — e pela regra de CSS sempre.
  */
  if (typeof window.matchMedia !== 'function') return true;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Aplica `mudar` atravessando a fusão, quando ela for cabível.
 *
 * O chamador não sabe se houve fusão, e não deve saber: em todo caminho a
 * mudança é aplicada exatamente uma vez, e de forma síncrona do ponto de vista
 * do DOM.
 *
 * **Trocas em sequência rápida resolvem no estado final** (FR-018a). O navegador
 * descarta a fusão em curso quando outra começa, e a última vence — que é o
 * mesmo contrato de interrupção do resto do catálogo.
 */
export function comFusaoDeTema(mudar: () => void, documento: Document = document): void {
  if (!deveFundir(documento)) {
    mudar();
    return;
  }

  (documento as DocumentoComTransicaoDeVista).startViewTransition?.(mudar);
}
