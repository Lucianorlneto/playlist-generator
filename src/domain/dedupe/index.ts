/**
 * Detecção de duplicatas em duas passagens (research §7, FR-018).
 *
 * 1. **Duplicata de entrada**: mesma chave `{título}|{artista}` normalizados.
 * 2. **Duplicata de resultado**: linhas diferentes que escolheram a mesma faixa.
 *    É o que cobre "Song (Radio Edit)" e "Song" resolvendo para a mesma `uri`.
 *
 * A primeira ocorrência fica intacta; as seguintes recebem `duplicateOf` e são
 * desmarcadas. A ordem nunca é alterada (FR-019) — duplicatas permanecem
 * visíveis na posição em que foram escritas.
 */

import { normalizeText } from '@/domain/normalize';
import type { MatchItem } from '@/domain/types';

export function inputKey(item: MatchItem): string {
  return `${normalizeText(item.line.title)}|${normalizeText(item.line.artist)}`;
}

export function markDuplicates(items: MatchItem[]): MatchItem[] {
  const firstByInputKey = new Map<string, string>();
  const firstByUri = new Map<string, string>();

  return items.map((item) => {
    if (item.status === 'discarded' || item.line.parseStatus === 'unparsed') {
      return item.duplicateOf === null ? item : { ...item, duplicateOf: null };
    }

    const key = inputKey(item);
    const hasKey = key !== '|';

    let duplicateOf: string | null = null;

    if (hasKey) {
      const first = firstByInputKey.get(key);
      if (first === undefined) {
        firstByInputKey.set(key, item.line.id);
      } else {
        duplicateOf = first;
      }
    }

    if (item.selectedUri !== null) {
      const first = firstByUri.get(item.selectedUri);
      if (first === undefined) {
        firstByUri.set(item.selectedUri, item.line.id);
      } else if (duplicateOf === null) {
        duplicateOf = first;
      }
    }

    if (duplicateOf === null) {
      return item.duplicateOf === null ? item : { ...item, duplicateOf: null };
    }

    return { ...item, duplicateOf, included: false };
  });
}
