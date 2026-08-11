/**
 * Os segundos que faltam numa espera por limitação de taxa
 * (009/FR-018a, 009/data-model.md §3).
 *
 * Vive no domínio porque é **regra** — arredondar para cima, nunca mostrar
 * negativo — e não I/O. O `setInterval` que a chama a cada segundo é I/O e fica
 * no componente, que é a fronteira do Princípio III.
 */

/**
 * Quantos segundos inteiros faltam até `resumesAt`, a partir de `agora`.
 *
 * **`agora` é parâmetro, e a ausência de `Date.now()` aqui dentro é a decisão.**
 * O Princípio III proíbe relógio ambiente no domínio, e a razão é prática antes
 * de ser doutrinária: um contador que lê o relógio por dentro é intestável sem
 * congelar o tempo do processo inteiro.
 *
 * - **Piso em zero**: uma espera vencida mostra `0`, nunca um número negativo —
 *   o relógio do cliente pode estar adiantado em relação ao instante que o
 *   serviço devolveu.
 * - **Arredondamento para cima**: com 200ms restantes ainda falta "1 segundo".
 *   Arredondar para baixo mostraria `0` durante quase um segundo inteiro, e um
 *   contador parado em zero lê como travamento.
 *
 * `WaitState.resumesAt` de `src/services/rate-limiter.ts` já é epoch em
 * milissegundos; nada é acrescentado àquele tipo.
 */
export function segundosRestantes(resumesAt: number, agora: number): number {
  return Math.max(0, Math.ceil((resumesAt - agora) / 1000));
}
