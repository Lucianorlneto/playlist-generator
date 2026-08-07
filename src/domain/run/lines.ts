/**
 * Fonte única de linhas e o que atravessa (ou não) a fronteira entre serviços
 * (FR-013, FR-014, research §13).
 *
 * A regra tem duas metades, e as duas são verificadas aqui:
 *
 * - **correção de texto propaga**: corrigir "Bohemin Rapsody" na revisão do
 *   primeiro serviço corrige a linha que o segundo vai buscar. É a única coisa
 *   que atravessa;
 * - **redução só remove**: a lista de um destino posterior é sempre um
 *   **subconjunto ordenado** da anterior. Acrescentar, alterar ou reordenar é
 *   recusado — sem isso, "os dois destinos receberam listas diferentes" viraria
 *   um estado que o resumo não consegue descrever com honestidade (SC-018).
 */

import { normalizeText } from '@/domain/normalize';
import type { InputLine, LineShape, ServiceRun } from '@/domain/types';

/**
 * Validação de FR-013: `next` é subconjunto de `previous` **preservando a
 * ordem**. Recusa acréscimo, alteração e reordenação.
 */
export function isSubsetOf(previous: readonly string[], next: readonly string[]): boolean {
  if (next.length > previous.length) return false;

  let cursor = 0;
  for (const id of next) {
    const found = previous.indexOf(id, cursor);
    if (found < 0) return false;
    cursor = found + 1;
  }
  return true;
}

/** Ids removidos de `previous` para chegar a `next`, na ordem original. */
export function removedIds(previous: readonly string[], next: readonly string[]): string[] {
  const kept = new Set(next);
  return previous.filter((id) => !kept.has(id));
}

export interface TextPatch {
  title?: string;
  artist?: string;
  featuredArtists?: string[];
  /** Nova na 003: acrescentar ou remover o separador muda a forma da linha. */
  shape?: LineShape;
}

/**
 * Aplica correção de texto à fonte única.
 *
 * Altera `title`, `artist`, `featuredArtists` e `shape`; **nunca** `raw`, `id`
 * nem `index`. `raw` é o que a lista de linhas não encontradas copia —
 * reescrevê-lo devolveria ao usuário um texto que ele nunca digitou —, e
 * `id`/`index` são o que liga a linha às execuções de cada serviço.
 *
 * `parseStatus` é **derivado**, não preservado: corrigir uma linha que o parser
 * não entendeu é justamente o caso de uso da edição, e manter o `unparsed`
 * antigo faria a busca devolver a linha intocada para sempre.
 *
 * A regra de derivação passou a ser a **nova** L2 (`003/FR-004`): inválida só
 * quando não sobra conteúdo alfanumérico. A regra antiga — título **e** artista
 * não vazios — condenaria toda linha corrigida para a forma livre, que é
 * exatamente o que esta feature passou a permitir.
 */
export function applyTextCorrection(
  lines: InputLine[],
  lineId: string,
  patch: TextPatch,
): InputLine[] {
  let changed = false;

  const next = lines.map((line) => {
    if (line.id !== lineId) return line;

    const updated: InputLine = {
      ...line,
      ...(patch.title === undefined ? {} : { title: patch.title }),
      ...(patch.artist === undefined ? {} : { artist: patch.artist }),
      ...(patch.featuredArtists === undefined
        ? {}
        : { featuredArtists: [...patch.featuredArtists] }),
      ...(patch.shape === undefined ? {} : { shape: patch.shape }),
      // Reafirmado explicitamente: nem um spread acidental pode alterá-los.
      raw: line.raw,
      id: line.id,
      index: line.index,
    };

    // Invariante L1: a forma livre não declara artista nem artista secundário.
    if (updated.shape === 'free') {
      updated.artist = '';
      updated.featuredArtists = [];
    }

    updated.parseStatus =
      normalizeText(`${updated.title} ${updated.artist}`) === '' ? 'unparsed' : 'parsed';

    if (
      updated.title !== line.title ||
      updated.artist !== line.artist ||
      updated.shape !== line.shape ||
      updated.parseStatus !== line.parseStatus ||
      updated.featuredArtists.join('\u0000') !== line.featuredArtists.join('\u0000')
    ) {
      changed = true;
      return updated;
    }
    return line;
  });

  return changed ? next : lines;
}

/** Linhas correspondentes a um conjunto de ids, na ordem da fonte única. */
export function linesFor(lines: readonly InputLine[], lineIds: readonly string[]): InputLine[] {
  const wanted = new Set(lineIds);
  return lines.filter((line) => wanted.has(line.id));
}

/**
 * Ids das linhas deste destino **ainda não resolvidas** (`004/data-model §4`).
 *
 * Fonte única de duas coisas que precisam concordar: o custo da retomada exibido
 * no diálogo (FR-013) e a lista efetivamente buscada quando a sessão volta
 * (FR-013b). Calculá-las por caminhos diferentes é o que faria SC-008 — desvio
 * nulo entre o informado e o real — depender de disciplina em vez de construção.
 *
 * O critério é `status === 'pending'`, e ele carrega a distinção do invariante
 * A3: pendente significa "ainda não busquei", nunca "busquei e não achei". Uma
 * linha sem item algum também é pendência — é o estado da execução que nem
 * chegou a começar. `searching` entra pelo mesmo motivo: a requisição saiu, mas
 * a resposta não voltou, e a linha continua sem resultado.
 *
 * Linha `unparsed` fica **de fora**: buscá-la de novo violaria `003/FR-011` e
 * gastaria cota com `---` e emoji, que o parser já recusou por não terem
 * conteúdo alfanumérico.
 *
 * Invariante A4: o resultado é subconjunto de `run.lineIds` preservando aquela
 * ordem — e não a ordem de `items`, que a concorrência da busca não garante.
 */
export function remainingLineIds(run: ServiceRun): string[] {
  const resolved = new Set(
    run.items
      .filter((item) => item.status !== 'pending' && item.status !== 'searching')
      .map((item) => item.line.id),
  );
  return run.lineIds.filter((id) => !resolved.has(id));
}
