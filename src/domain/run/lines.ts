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

import type { InputLine } from '@/domain/types';

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
}

/**
 * Aplica correção de texto à fonte única.
 *
 * Altera `title`, `artist` e `featuredArtists`; **nunca** `raw`, `id` nem
 * `index` (invariante L2). `raw` é o que a lista de linhas não encontradas
 * copia — reescrevê-lo devolveria ao usuário um texto que ele nunca digitou, e
 * `id`/`index` são o que liga a linha às execuções de cada serviço.
 *
 * `parseStatus` é **derivado**, não preservado: corrigir uma linha que o parser
 * não entendeu é justamente o caso de uso da edição, e manter o `unparsed`
 * antigo faria a busca devolver a linha intocada para sempre. A regra é a mesma
 * do parser — título e artista não vazios (`parser/index.ts`).
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
      // Reafirmado explicitamente: nem um spread acidental pode alterá-los.
      raw: line.raw,
      id: line.id,
      index: line.index,
    };
    updated.parseStatus =
      updated.title.trim() !== '' && updated.artist.trim() !== '' ? 'parsed' : 'unparsed';

    if (
      updated.title !== line.title ||
      updated.artist !== line.artist ||
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
