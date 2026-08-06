import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ProviderId } from '@/domain/providers';
import {
  createLimiter,
  DEFAULT_BURST,
  DEFAULT_CONCURRENCY,
  DEFAULT_RATE_PER_SECOND,
  limiterFor,
  resetLimiters,
  type Limiter,
} from '@/services/rate-limiter';

/**
 * Medição de vazão do dimensionamento de produção (SC-015, FR-027).
 *
 * Relógio falso e latência simulada: o objetivo é medir o **limitador**, não a
 * rede. A latência de 400 ms por busca é o topo da faixa típica citada em
 * research §4, então o número aqui é conservador.
 */
const LATENCIA_MS = 400;

afterEach(() => {
  vi.useRealTimers();
  resetLimiters();
});

async function medirCom(
  limiter: Limiter,
  linhas: number,
): Promise<{ segundos: number; vazao: number }> {
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

async function medir(linhas: number): Promise<{ segundos: number; vazao: number }> {
  vi.useFakeTimers();
  return medirCom(
    createLimiter({
      ratePerSecond: DEFAULT_RATE_PER_SECOND,
      burst: DEFAULT_BURST,
      concurrency: DEFAULT_CONCURRENCY,
    }),
    linhas,
  );
}

/** Vazão do limitador **daquele provedor**, com a calibração de produção. */
async function medirProvedor(
  provider: ProviderId,
  linhas: number,
): Promise<{ segundos: number; vazao: number }> {
  vi.useFakeTimers();
  return medirCom(limiterFor(provider), linhas);
}

describe('Vazão da busca com o dimensionamento de produção', () => {
  it('o dimensionamento é o de research §4', () => {
    expect(DEFAULT_RATE_PER_SECOND).toBe(5);
    expect(DEFAULT_BURST).toBe(10);
    expect(DEFAULT_CONCURRENCY).toBe(4);
  });

  it('50 linhas concluem em menos de 30 s', async () => {
    const { segundos } = await medir(50);
    expect(segundos).toBeLessThan(30);
  });

  it('250 linhas concluem em menos de 2 min', async () => {
    const { segundos } = await medir(250);
    expect(segundos).toBeLessThan(120);
  });

  it('sustenta ao menos 2 linhas por segundo (FR-027)', async () => {
    const { vazao } = await medir(250);
    expect(vazao).toBeGreaterThanOrEqual(2);
  });
});

describe('Vazão por provedor (SC-015)', () => {
  it('o limitador é próprio de cada serviço, com calibração própria', async () => {
    vi.useFakeTimers();
    expect(limiterFor('spotify')).not.toBe(limiterFor('youtube'));

    // O YouTube é deliberadamente mais conservador (research §16): 4 req/s
    // contra 5. A diferença tem de aparecer no tempo medido, senão a calibração
    // por provedor seria decorativa.
    const spotify = await medirProvedor('spotify', 50);
    resetLimiters();
    vi.useRealTimers();
    vi.useFakeTimers();
    const youtube = await medirProvedor('youtube', 50);

    expect(youtube.segundos).toBeGreaterThan(spotify.segundos);
  });

  it('50 linhas nos dois destinos, em sequência, cabem em 2 min (SC-015)', async () => {
    // SC-015 mede o fluxo inteiro: os serviços rodam **um depois do outro**
    // (FR-016), então o orçamento é a soma, nunca o máximo.
    vi.useFakeTimers();
    const spotify = await medirProvedor('spotify', 50);
    resetLimiters();
    vi.useRealTimers();
    vi.useFakeTimers();
    const youtube = await medirProvedor('youtube', 50);

    expect(spotify.segundos + youtube.segundos).toBeLessThan(120);
  });
});
