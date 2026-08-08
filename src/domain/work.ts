/**
 * Há trabalho a descartar? (`006/FR-021`).
 *
 * Fonte única de uma pergunta que o projeto já fazia em um lugar — a
 * restauração do rascunho — e que a `006` passou a fazer em outro: a
 * visibilidade do comando global de recomeço. Duas definições que discordassem
 * em silêncio produziriam um botão oferecido onde não há nada a descartar, ou
 * escondido onde há.
 *
 * Puro: sem store, sem armazenamento, sem DOM.
 */

import type { ExecutionQueue, InputLine } from '@/domain/types';

export interface WorkShape {
  rawText: string;
  lines: readonly InputLine[];
  queue: ExecutionQueue;
}

export interface HasWorkOptions {
  /**
   * Uma fila **montada** já conta como trabalho.
   *
   * A restauração e o botão fazem a mesma pergunta com fronteiras diferentes, e
   * a diferença é real. Um rascunho gravado com fila montada e nada mais não
   * vale restaurar — não há o que devolver ao usuário. Mas quem escolheu
   * destinos e avançou **tem** o que descartar, e esconder o botão dele seria o
   * oposto de FR-013.
   *
   * O parâmetro existe para manter essa diferença visível no ponto de chamada,
   * em vez de escondê-la em duas funções que se pareceriam.
   */
  queueCounts?: boolean;
}

export function hasWork(work: WorkShape, options: HasWorkOptions = {}): boolean {
  if (work.rawText.trim() !== '') return true;
  if (work.lines.length > 0) return true;

  if (options.queueCounts === true && work.queue.order.length > 0) return true;

  return work.queue.order.some((provider) => {
    const run = work.queue.runs[provider];
    return run !== undefined && (run.items.length > 0 || run.creation !== null);
  });
}
