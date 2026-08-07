/**
 * Ligação entre os construtores de consulta de cada provedor e as funções puras
 * de elegibilidade (`src/domain/retry/`).
 *
 * Existe para que **um único lugar** declare como cada catálogo monta as suas
 * duas consultas. Três consumidores dependem dessa resposta e precisam da mesma:
 * o runner (para decidir se emite a retentativa), a estimativa de cota (para
 * reservar `R`) e a migração v2→v3 (para recalcular a reserva de um rascunho
 * antigo). Se cada um montasse a consulta por conta própria, a invariante O4
 * — consumo real nunca acima da estimativa — deixaria de valer por construção e
 * passaria a depender de três implementações concordarem.
 *
 * Importa `{provider}/search.ts` diretamente, e não o adaptador: os construtores
 * são funções puras de `InputLine`, sem rede, e importar `{provider}/index.ts`
 * criaria um ciclo com o `searchRunner`.
 */

import { retryReserveFor } from '@/domain/retry';
import type { ProviderId } from '@/domain/providers';
import type { InputLine } from '@/domain/types';

import { primaryQuery as spotifyPrimary, retryQuery as spotifyRetry } from './spotify/search';
import { primaryQuery as youtubePrimary, retryQuery as youtubeRetry } from './youtube/search';

interface QueryShape {
  primary: (line: InputLine) => string;
  retry: (line: InputLine) => string;
  /** A primária é por campos quando a linha é explícita (`003/research §6`). */
  fieldedPrimary: boolean;
}

const SHAPES: Record<ProviderId, QueryShape> = {
  spotify: { primary: spotifyPrimary, retry: spotifyRetry, fieldedPrimary: true },
  youtube: { primary: youtubePrimary, retry: youtubeRetry, fieldedPrimary: false },
};

export function queryShapeOf(provider: ProviderId): QueryShape {
  return SHAPES[provider];
}

/**
 * Linhas elegíveis a retentativa naquele catálogo — o `R` da fórmula de cota.
 *
 * Invariante O5: função apenas do texto das linhas, determinística, calculável
 * antes de qualquer requisição e idêntica se recalculada.
 */
export function retryReserveOf(provider: ProviderId, lines: readonly InputLine[]): number {
  const shape = SHAPES[provider];
  return retryReserveFor(lines, shape.primary, shape.retry, shape.fieldedPrimary);
}
