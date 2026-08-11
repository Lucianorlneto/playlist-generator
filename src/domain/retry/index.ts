/**
 * Elegibilidade de nova tentativa de busca (`003/FR-009`, research §6).
 *
 * Domínio puro, e é aqui de propósito: a elegibilidade depende **só do texto da
 * linha**, é decidida antes de qualquer requisição, e o número de linhas
 * elegíveis é o que a estimativa de cota precisa reservar. Colocá-la em
 * `services/` violaria o Princípio III e a tornaria intestável sem mock.
 *
 * A regra é uma só, aplicada aos dois provedores (decisão Q2 da spec): **retenta
 * quando a consulta alternativa é de fato outra**. Consulta idêntica não é
 * retentativa, é a mesma requisição pela segunda vez — e no serviço que tem cota
 * ela custaria 100 unidades para receber a mesma resposta.
 *
 * É essa condição que torna a decisão Q2 barata: no catálogo de vídeo a consulta
 * primária de uma linha explícita já é `"{título} {artista}"` em texto livre, e a
 * de retentativa é a linha inteira — normalizadas, quase sempre a mesma string.
 * O teto prático de 60 linhas não se move.
 */

import { normalizeText } from '@/domain/normalize';
import type { InputLine } from '@/domain/types';

/** A contagem regressiva da espera por limitação de taxa (009/FR-018a). */
export { segundosRestantes } from './countdown';

/** Consulta emitida a um catálogo, já na forma que o adaptador enviará. */
export interface QueryPlan {
  /** Consulta primária. Por campos no Spotify, texto livre no YouTube. */
  primary: string;
  /** Consulta de retentativa, ou `null` quando não haveria uma diferente. */
  retry: string | null;
}

export type BuildQuery = (line: InputLine) => string;

/**
 * Decide se a linha tem uma segunda consulta a oferecer.
 *
 * `fieldedPrimary: true` (Spotify) declara que **a primária daquele provedor é
 * por campos quando a linha é explícita**. Nesse caso ela é estruturalmente
 * diferente do texto livre — restringe a correspondência a campos e falha quando
 * a grafia do artista diverge —, então a alternativa sempre pode trazer
 * resultado novo, e comparar as strings seria comparar incomparáveis
 * (`track:"…" artist:"…"` contra texto corrido).
 *
 * A ressalva importa: na linha **livre** nem o Spotify emite consulta por
 * campos, e ali a comparação volta a valer. Sem isso, toda linha sem separador
 * reservaria uma retentativa que repetiria a primeira consulta.
 *
 * `false` (YouTube) compara as duas normalizadas e devolve `null` quando
 * colapsam na mesma coisa.
 */
export function planQueries(
  line: InputLine,
  buildPrimary: BuildQuery,
  buildRetry: BuildQuery,
  fieldedPrimary: boolean,
): QueryPlan {
  const primary = buildPrimary(line);
  const retry = buildRetry(line);

  if (retry.trim() === '') return { primary, retry: null };
  if (fieldedPrimary && line.shape === 'explicit') return { primary, retry };

  return {
    primary,
    retry: normalizeText(primary) === normalizeText(retry) ? null : retry,
  };
}

/**
 * Quantas linhas da lista são elegíveis a retentativa — o `R` da fórmula de
 * cota e o teto de execução das invariantes O4/O5.
 *
 * Determinístico e recalculável: rodar de novo sobre as mesmas linhas dá o mesmo
 * número, que é o que permite à migração v2→v3 reconstruí-lo em vez de confiar
 * no valor gravado.
 */
export function retryReserveFor(
  lines: readonly InputLine[],
  buildPrimary: BuildQuery,
  buildRetry: BuildQuery,
  fieldedPrimary: boolean,
): number {
  let count = 0;
  for (const line of lines) {
    if (line.parseStatus === 'unparsed') continue;
    if (planQueries(line, buildPrimary, buildRetry, fieldedPrimary).retry !== null) count += 1;
  }
  return count;
}
