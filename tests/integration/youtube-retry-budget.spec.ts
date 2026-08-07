/**
 * Teto de execução da reserva de retentativa (`003/FR-010a`, SC-007,
 * invariante O4).
 *
 * A promessa que esta suíte protege é a mais forte da feature: **o consumo real
 * nunca excede a estimativa**, e isso vale por construção, não por folga de
 * margem. O runner reserva a vaga antes de emitir a requisição, e quando a
 * reserva acaba a linha chega à revisão dizendo o que aconteceu — não disfarçada
 * de "não encontrada".
 *
 * O cenário é deliberadamente o pior possível: **todas** as linhas retentariam.
 * É onde um decremento não sequencial estouraria o teto sem ninguém notar.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { parseLine } from '@/domain/parser';
import { runMatching } from '@/features/input/matchRunner';
import { retryReserveOf } from '@/services/providers/retryPlan';
import type { InputLine } from '@/domain/types';

import { requestsTo, setYouTubeCatalog } from '../msw/handlers';

import { useFastLimiters, wireYouTube } from './support/clients';

beforeEach(() => {
  wireYouTube();
  useFastLimiters();
  // Catálogo vazio: nenhuma linha acha nada, então **toda** linha elegível
  // tentaria de novo. É o cenário que estressa o teto.
  setYouTubeCatalog([]);
  localStorage.clear();
});

const signal = (): AbortSignal => new AbortController().signal;

/** Linhas com `feat.`: no catálogo de vídeo, as únicas que de fato retentam. */
function elegiveis(quantidade: number): InputLine[] {
  return Array.from({ length: quantidade }, (_unused, index) =>
    parseLine(`Faixa ${index} feat. Convidado ${index} - Artista ${index} & Outro`, index, `l${index}`),
  );
}

describe('O4 — o número de buscas é exatamente N + retryReserve, nunca mais', () => {
  it('todas as linhas elegíveis, orçamento cheio: N + R buscas', async () => {
    const lines = elegiveis(6);
    const reserva = retryReserveOf('youtube', lines);
    expect(reserva).toBe(6);

    await runMatching('youtube', lines, { signal: signal(), retryBudget: reserva });

    expect(requestsTo('ytSearch')).toHaveLength(lines.length + reserva);
  });

  it('orçamento parcial: o teto é respeitado exatamente', async () => {
    const lines = elegiveis(6);

    await runMatching('youtube', lines, { signal: signal(), retryBudget: 2 });

    // Seis primeiras consultas mais **duas** retentativas. Nem três.
    expect(requestsTo('ytSearch')).toHaveLength(8);
  });

  it('orçamento zero: nenhuma retentativa é emitida', async () => {
    const lines = elegiveis(6);

    await runMatching('youtube', lines, { signal: signal(), retryBudget: 0 });

    expect(requestsTo('ytSearch')).toHaveLength(6);
  });

  /**
   * As linhas são buscadas em paralelo, e a decisão de retentar acontece depois
   * de cada primeira resposta. Sem um ponto único que reserve a vaga antes de
   * emitir, várias linhas leriam o mesmo saldo e estourariam o teto juntas.
   */
  it('o decremento é sequencialmente consistente, mesmo com tudo em paralelo', async () => {
    const lines = elegiveis(20);

    await runMatching('youtube', lines, { signal: signal(), retryBudget: 5 });

    expect(requestsTo('ytSearch')).toHaveLength(25);
  });

  it('sem teto declarado, o provedor sem cota não é limitado', async () => {
    const lines = elegiveis(4);

    await runMatching('youtube', lines, { signal: signal() });

    // Sem `retryBudget`, o runner não impõe teto — é o caso do Spotify.
    expect(requestsTo('ytSearch')).toHaveLength(8);
  });
});

/**
 * Invariante M2 e `003/research §10`. A distinção existe porque a ação do
 * usuário é diferente: aqui a linha pode estar certa e o app é que desistiu; em
 * `not_found` puro, o texto provavelmente precisa de correção. Apresentar um
 * como o outro faria o usuário reescrever uma linha correta.
 */
describe('M2 — a linha barrada pelo teto diz que foi barrada', () => {
  it('recebe retry_skipped_quota, não not_found puro', async () => {
    const lines = elegiveis(4);

    const items = await runMatching('youtube', lines, { signal: signal(), retryBudget: 1 });

    const barradas = items.filter((item) => item.attentionReason === 'retry_skipped_quota');
    const semReserva = items.filter((item) => item.attentionReason === 'not_found');

    // Uma linha gastou a reserva; as outras três foram barradas.
    expect(barradas).toHaveLength(3);
    expect(semReserva).toHaveLength(1);

    // O `status` continua sendo o desfecho; o motivo é a causa.
    for (const item of barradas) {
      expect(item.status).toBe('not_found');
    }
  });

  it('com reserva sobrando, nenhuma linha é marcada como barrada', async () => {
    const lines = elegiveis(3);

    const items = await runMatching('youtube', lines, { signal: signal(), retryBudget: 10 });

    expect(items.every((item) => item.attentionReason === 'not_found')).toBe(true);
  });

  /** A linha **não** elegível nunca é marcada como barrada: ela não retentaria. */
  it('linha inelegível recebe not_found, mesmo com a reserva esgotada', async () => {
    const lines = [parseLine('Zoio de Lula - Charlie Brown Jr', 0, 'l0')];

    const items = await runMatching('youtube', lines, { signal: signal(), retryBudget: 0 });

    expect(requestsTo('ytSearch')).toHaveLength(1);
    expect(items[0]?.attentionReason).toBe('not_found');
  });
});

describe('O5 — a reserva é a mesma contada antes e gasta durante', () => {
  it('o número de retentativas emitidas nunca passa do que foi reservado', async () => {
    const lines = [
      ...elegiveis(5),
      parseLine('Zoio de Lula - Charlie Brown Jr', 5, 'l5'),
      parseLine('zoio de lula charlie brown jr', 6, 'l6'),
    ];

    const reserva = retryReserveOf('youtube', lines);
    // Cinco com `feat.`; a explícita comum e a livre não são elegíveis.
    expect(reserva).toBe(5);

    await runMatching('youtube', lines, { signal: signal(), retryBudget: reserva });

    const emitidas = requestsTo('ytSearch').length - lines.length;
    expect(emitidas).toBeLessThanOrEqual(reserva);
    expect(emitidas).toBe(5);
  });
});
