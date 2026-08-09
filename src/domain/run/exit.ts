/**
 * Para onde o fluxo vai depois de um pulo (`006/FR-002` a FR-004).
 *
 * Pular um destino tem três desfechos possíveis, e escolher entre eles depende
 * só da fila. Como o Princípio III manda, a escolha é função pura em
 * `src/domain/` — não aritmética de índice repetida em cada tela.
 *
 * O defeito que este módulo existe para fechar: até a `006`, pular apenas
 * encerrava a execução. A fila não andava, e a etapa seguia exibindo a mesma
 * execução — agora encerrada e sem resultado — como "Criando playlist no
 * {serviço}…". Com destino único, o único botão oferecido ali levava a uma tela
 * em branco sem saída (`006/research §1`, §2).
 *
 * **Invariante E1 — total**: para qualquer fila com pelo menos um destino, a
 * resposta é exatamente um dos três construtores. Não há `null` nem quarto caso,
 * e é isso que garante que nenhum pulo termina em tela indefinida.
 *
 * **Invariante E2 — pura**: sem rede, DOM, armazenamento ou relógio. É o que
 * permite à interface consultá-la para decidir se confirma e à ação consultá-la
 * de novo para navegar, sem risco de as duas divergirem.
 */

import type { ProviderId } from '@/domain/providers';
import type { ExecutionQueue, ServiceRun } from '@/domain/types';

export type FlowExit =
  | { kind: 'next'; provider: ProviderId }
  /** Último destino, mas algum outro chegou a rodar: há o que relatar. */
  | { kind: 'summary' }
  /** Último destino e todos foram pulados: nada a relatar, nada a aproveitar. */
  | { kind: 'discard' };

/**
 * Um destino "rodou" quando tem desfecho diferente de pulado.
 *
 * O critério é `outcome`, **não** `phase`: a fase de uma execução encerrada não
 * separa "falhou depois de a playlist existir" de "falhou antes", e a fronteira
 * de FR-003 é exatamente essa — o que importa é ter acontecido, não ter dado
 * certo. `null` é o destino que nunca começou, e conta como não-rodado.
 */
function ran(run: ServiceRun | undefined): boolean {
  return run !== undefined && run.outcome !== null && run.outcome !== 'skipped';
}

/**
 * `queue` é a fila de **antes** do pulo, e `provider`, o destino que está sendo
 * pulado.
 *
 * A ordem das regras importa: a primeira é sobre **posição** e as demais sobre
 * **desfecho**. Um destino anterior concluído não impede que pular o primeiro de
 * dois vá para o segundo.
 */
export function exitAfterSkip(queue: ExecutionQueue, provider: ProviderId): FlowExit {
  const next = queue.order[queue.order.indexOf(provider) + 1];
  if (next !== undefined) return { kind: 'next', provider: next };

  // Invariante E3: neste ponto todos os destinos anteriores já encerraram, porque
  // a fila só anda quando a execução corrente tem desfecho (invariante Q2 de
  // `queue.ts`). Não há destino em andamento a considerar.
  const algumRodou = queue.order.some((id) => ran(queue.runs[id]));
  return algumRodou ? { kind: 'summary' } : { kind: 'discard' };
}
