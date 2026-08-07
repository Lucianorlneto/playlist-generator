/**
 * Cota fantasma no `401` — pré-requisito da reconexão (`004/Q1` a `Q3`,
 * [provider-contract §4](../../specs/004-youtube-reconnect/contracts/provider-contract.md)).
 *
 * `http.ts` registrava consumo assim que a resposta chegava, **antes** de olhar o
 * status, justificando-se com "a resposta chegou, logo o provedor contabilizou".
 * A premissa é verdadeira para `403` e `5xx` e **falsa para `401`**: requisição
 * rejeitada por credencial inválida não é cobrada.
 *
 * A consequência não é acadêmica. Em uma lista de 100 linhas, um token morto
 * gravava 10.000 unidades fantasma — o orçamento diário inteiro. O usuário
 * reconectaria para ser barrado por um esgotamento que não provocou, e o custo
 * exibido no modal de reconexão seria mentira. Por isso este conserto vem
 * **antes** de qualquer medição de consumo da feature: com a cota fantasma ainda
 * gravando, os testes de retomada mediriam um valor que a própria feature muda.
 *
 * O arquivo é isolado de propósito: a fase Foundational não compartilha arquivo
 * de teste com nenhuma história.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { makeLine } from '../fixtures/factories';
import { runMatching } from '@/features/input/matchRunner';
import { YOUTUBE_QUOTA } from '@/domain/providers';
import { unitsUsedToday } from '@/services/providers/youtube/quota';
import { clearConsumption } from '@/services/storage/quotaRepo';

import { programUnauthorized, requestsTo, setYouTubeCatalog, program, YT_RESPONSES } from '../msw/handlers';
import { useFastLimiters, wireYouTube } from './support/clients';

const N = 3;

function linhas(total: number) {
  return Array.from({ length: total }, (_, index) =>
    makeLine({ id: `l${index}`, index, raw: `Faixa ${index} - Artista` }),
  );
}

beforeEach(() => {
  useFastLimiters();
  wireYouTube();
  clearConsumption('youtube');
  setYouTubeCatalog([]);
});

describe('Q1/Q3 — `401` não registra consumo de cota', () => {
  it(`${N} linhas respondendo 401 não gravam unidade alguma`, async () => {
    programUnauthorized('ytSearch', N);

    await runMatching('youtube', linhas(N), { signal: new AbortController().signal });

    // Antes do conserto: 100·N unidades fantasma.
    expect(unitsUsedToday()).toBe(0);
    expect(requestsTo('ytSearch')).toHaveLength(N);
  });

  it('uma única busca rejeitada por credencial não move o registro', async () => {
    programUnauthorized('ytSearch', 1);

    await runMatching('youtube', linhas(1), { signal: new AbortController().signal });

    expect(unitsUsedToday()).toBe(0);
  });
});

describe('Q2 — todos os demais status continuam registrando', () => {
  it('`403` de cota esgotada registra a unidade da busca', async () => {
    program('ytSearch', YT_RESPONSES.quotaExceeded());

    await runMatching('youtube', linhas(1), { signal: new AbortController().signal });

    // A requisição chegou e foi processada do outro lado: o custo é real.
    expect(unitsUsedToday()).toBe(YOUTUBE_QUOTA.costs.search);
  });

  it('`5xx` registra cada tentativa emitida', async () => {
    // Três tentativas de transporte (MAX_TRANSIENT_ATTEMPTS), todas cobradas.
    program('ytSearch', YT_RESPONSES.serverError(), YT_RESPONSES.serverError(), YT_RESPONSES.serverError());

    await runMatching('youtube', linhas(1), { signal: new AbortController().signal });

    expect(unitsUsedToday()).toBe(YOUTUBE_QUOTA.costs.search * requestsTo('ytSearch').length);
  }, 15_000);

  it('busca bem-sucedida continua registrando busca e enriquecimento', async () => {
    setYouTubeCatalog([
      { id: 'v0', title: 'Faixa 0', channel: 'Artista', duration: 'PT3M0S' },
    ]);

    await runMatching('youtube', linhas(1), { signal: new AbortController().signal });

    // Derivado das requisições realmente emitidas, e não de um número fixo: o
    // caminho feliz pode incluir a consulta alternativa de `003/FR-009`, e o que
    // se afirma aqui é que **toda** resposta bem-sucedida continua sendo
    // contabilizada — não quantas houve.
    const esperado =
      YOUTUBE_QUOTA.costs.search * requestsTo('ytSearch').length +
      YOUTUBE_QUOTA.costs.enrich * requestsTo('ytVideos').length;

    expect(requestsTo('ytSearch').length).toBeGreaterThan(0);
    expect(unitsUsedToday()).toBe(esperado);
  });
});
