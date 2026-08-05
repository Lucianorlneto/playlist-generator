import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createLimiter,
  DEFAULT_BURST,
  DEFAULT_CONCURRENCY,
  DEFAULT_RATE_PER_SECOND,
} from '@/services/rate-limiter';

/**
 * Medição de vazão do dimensionamento de produção (SC-005, SC-010, FR-027).
 *
 * Relógio falso e latência simulada: o objetivo é medir o **limitador**, não a
 * rede. A latência de 400 ms por busca é o topo da faixa típica citada em
 * research §4, então o número aqui é conservador.
 */
const LATENCIA_MS = 400;

afterEach(() => {
  vi.useRealTimers();
});

async function medir(linhas: number): Promise<{ segundos: number; vazao: number }> {
  vi.useFakeTimers();
  const limiter = createLimiter({
    ratePerSecond: DEFAULT_RATE_PER_SECOND,
    burst: DEFAULT_BURST,
    concurrency: DEFAULT_CONCURRENCY,
  });
  const controller = new AbortController();
  const inicio = Date.now();

  let concluidas = 0;
  // O instante da última conclusão, não o fim da janela oferecida: avançar o
  // relógio 300 s não significa que a busca levou 300 s.
  let ultimaConclusao = inicio;
  const tarefas = Array.from({ length: linhas }, () =>
    limiter.run(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, LATENCIA_MS));
      concluidas += 1;
      ultimaConclusao = Date.now();
    }, controller.signal),
  );

  await vi.advanceTimersByTimeAsync(300_000);
  await Promise.all(tarefas);

  const segundos = (ultimaConclusao - inicio) / 1000;
  expect(concluidas).toBe(linhas);
  return { segundos, vazao: linhas / Math.max(segundos, 0.001) };
}

describe('Vazão da busca com o dimensionamento de produção', () => {
  it('o dimensionamento é o de research §4', () => {
    expect(DEFAULT_RATE_PER_SECOND).toBe(5);
    expect(DEFAULT_BURST).toBe(10);
    expect(DEFAULT_CONCURRENCY).toBe(4);
  });

  it('50 linhas concluem em menos de 30 s (SC-010)', async () => {
    const { segundos } = await medir(50);
    expect(segundos).toBeLessThan(30);
  });

  it('250 linhas concluem em menos de 2 min (SC-005, SC-010)', async () => {
    const { segundos } = await medir(250);
    expect(segundos).toBeLessThan(120);
  });

  it('sustenta ao menos 2 linhas por segundo (FR-027)', async () => {
    const { vazao } = await medir(250);
    expect(vazao).toBeGreaterThanOrEqual(2);
  });
});
