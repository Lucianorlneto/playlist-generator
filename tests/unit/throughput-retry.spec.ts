/**
 * Vazão no cenário em que uma fração das linhas exige **segunda** tentativa
 * (SC-009, `003/FR-009`).
 *
 * `throughput.spec.ts` mede uma requisição por linha e permanece **intocada** —
 * ela é a prova de não regressão do dimensionamento da 002. Esta suíte cobre a
 * cláusula que aquela não exercita: a retentativa passa pelo **mesmo**
 * limitador, então uma linha que retenta ocupa duas vagas na fila, e o piso de
 * 2 linhas/s tem de continuar valendo com esse acréscimo.
 *
 * São duas garantias distintas convivendo, não uma substituindo a outra: se
 * alguém trocar esta pela outra, a regressão de vazão sob retentativa passa a
 * ser invisível.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ProviderId } from '@/domain/providers';
import { limiterFor, resetLimiters, type Limiter } from '@/services/rate-limiter';

/** Mesma latência simulada de `throughput.spec.ts`: o topo da faixa típica. */
const LATENCIA_MS = 400;

afterEach(() => {
  vi.useRealTimers();
  resetLimiters();
});

/**
 * Mede a vazão de `linhas` linhas em que `fracaoQueRetenta` delas emitem **duas**
 * requisições em sequência — a segunda só depois de a primeira voltar, como o
 * runner faz.
 */
async function medirComRetentativa(
  limiter: Limiter,
  linhas: number,
  fracaoQueRetenta: number,
): Promise<{ segundos: number; vazao: number; requisicoes: number }> {
  const controller = new AbortController();
  const inicio = Date.now();

  let requisicoes = 0;
  let concluidas = 0;
  let ultimaConclusao = inicio;

  const buscar = async (): Promise<void> => {
    await limiter.run(async () => {
      requisicoes += 1;
      await new Promise<void>((resolve) => setTimeout(resolve, LATENCIA_MS));
    }, controller.signal);
  };

  const tarefas = Array.from({ length: linhas }, async (_unused, index) => {
    await buscar();
    // A retentativa é sequencial em relação à primeira daquela linha: só se
    // sabe que ela é necessária depois de a primeira resposta chegar.
    if (index % Math.max(1, Math.round(1 / fracaoQueRetenta)) === 0) await buscar();
    concluidas += 1;
    ultimaConclusao = Date.now();
  });

  await vi.advanceTimersByTimeAsync(600_000);
  await Promise.all(tarefas);

  const segundos = (ultimaConclusao - inicio) / 1000;
  expect(concluidas).toBe(linhas);
  return { segundos, vazao: linhas / Math.max(segundos, 0.001), requisicoes };
}

async function medir(
  provider: ProviderId,
  linhas: number,
  fracao: number,
): Promise<{ segundos: number; vazao: number; requisicoes: number }> {
  vi.useFakeTimers();
  return medirComRetentativa(limiterFor(provider), linhas, fracao);
}

describe('SC-009 — a vazão se sustenta quando parte das linhas retenta', () => {
  it('com 20% retentando, mantém ao menos 2 linhas por segundo', async () => {
    const { vazao, requisicoes } = await medir('spotify', 250, 0.2);

    expect(requisicoes).toBe(300);
    expect(vazao).toBeGreaterThanOrEqual(2);
  });

  it('no pior caso — TODAS as linhas retentam — ainda mantém 2 linhas por segundo', async () => {
    const { vazao, requisicoes } = await medir('spotify', 250, 1);

    // Duas requisições por linha: é o teto do que a retentativa pode custar.
    expect(requisicoes).toBe(500);
    expect(vazao).toBeGreaterThanOrEqual(2);
  });

  it('50 linhas com retentativa integral concluem em menos de 60 s', async () => {
    const { segundos } = await medir('spotify', 50, 1);
    expect(segundos).toBeLessThan(60);
  });

  /**
   * O limitador do catálogo de vídeo é deliberadamente mais conservador. Ele é
   * também onde a retentativa é mais rara (research §6), mas o piso precisa
   * valer lá mesmo no cenário que não acontece na prática.
   */
  it('o catálogo de vídeo sustenta o piso mesmo retentando tudo', async () => {
    const { vazao } = await medir('youtube', 250, 1);
    expect(vazao).toBeGreaterThanOrEqual(2);
  });

  it('a retentativa custa tempo, e o custo é proporcional — não explosivo', async () => {
    const semRetentativa = await medir('spotify', 100, 0);
    resetLimiters();
    vi.useRealTimers();
    const comRetentativa = await medir('spotify', 100, 1);

    expect(comRetentativa.segundos).toBeGreaterThan(semRetentativa.segundos);
    // Dobrar as requisições não pode mais que dobrar o tempo com folga: se
    // passasse disso, haveria contenção além da vazão do limitador.
    expect(comRetentativa.segundos).toBeLessThan(semRetentativa.segundos * 2.5);
  });
});
