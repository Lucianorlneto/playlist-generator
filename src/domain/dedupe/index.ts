/**
 * Detecção de duplicatas em duas passagens (`001/research §7`, FR-018).
 *
 * 1. **Duplicata de entrada**: mesmo **texto pesquisável** normalizado.
 * 2. **Duplicata de resultado**: linhas diferentes que escolheram a mesma faixa.
 *    É o que cobre "Song (Radio Edit)" e "Song" resolvendo para a mesma `uri`.
 *
 * A primeira ocorrência fica intacta; as seguintes recebem `duplicateOf` e são
 * desmarcadas. A ordem nunca é alterada (FR-019) — duplicatas permanecem
 * visíveis na posição em que foram escritas.
 */

import { normalizeText } from '@/domain/normalize';
import type { MatchItem } from '@/domain/types';

/**
 * Chave de duplicata de entrada: `normalizeText` do **texto pesquisável**
 * (`003/FR-020`, research §9).
 *
 * O par `título|artista` deixou de servir quando a linha passou a poder não ter
 * artista. `Zoio de Lula - Charlie Brown Jr` e `zoio de lula charlie brown jr`
 * produziam chaves diferentes (`zoio de lula|charlie brown jr` contra
 * `zoio de lula charlie brown jr|`) e escapavam da detecção. Com a chave
 * unificada, as duas colapsam na mesma string.
 *
 * **Limite aceito e registrado**: `Song (feat. X) - Artist` produz `song artist`
 * — o _featured_ é extraído do título —, enquanto a forma livre `song feat x
 * artist` produz outra chave. As duas só se encontram na deduplicação por
 * resultado, depois da escolha. Uniformizar exigiria descartar informação que a
 * forma explícita fornece de propósito.
 */
export function inputKey(item: MatchItem): string {
  const { line } = item;
  return normalizeText(line.shape === 'free' ? line.title : `${line.title} ${line.artist}`);
}

export function markDuplicates(items: MatchItem[]): MatchItem[] {
  const firstByInputKey = new Map<string, string>();
  const firstByUri = new Map<string, string>();

  return items.map((item) => {
    if (item.status === 'discarded' || item.line.parseStatus === 'unparsed') {
      return item.duplicateOf === null ? item : { ...item, duplicateOf: null };
    }

    const key = inputKey(item);
    // A guarda de chave vazia acompanha a invariante L2: chave vazia é
    // exatamente a linha sem conteúdo alfanumérico.
    const hasKey = key !== '';

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
