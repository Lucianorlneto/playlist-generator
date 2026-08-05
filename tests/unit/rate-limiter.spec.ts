import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  abortableDelay,
  createLimiter,
  isAbortError,
  onWaitStateChange,
  waitAnnounced,
  type WaitState,
} from '@/services/rate-limiter';

afterEach(() => {
  vi.useRealTimers();
});

describe('Token bucket e concorrência (research §4)', () => {
  it('sustenta vazão bem acima do mínimo de 2 linhas/s (SC-010)', async () => {
    vi.useFakeTimers();
    const limiter = createLimiter({ ratePerSecond: 5, burst: 10, concurrency: 4 });
    const controller = new AbortController();

    let concluidas = 0;
    const tarefas = Array.from({ length: 20 }, () =>
      limiter.run(async () => {
        concluidas += 1;
      }, controller.signal),
    );

    const inicio = Date.now();
    await vi.advanceTimersByTimeAsync(5000);
    await Promise.all(tarefas);
    const decorrido = Date.now() - inicio;

    expect(concluidas).toBe(20);
    // 10 de rajada + 10 a 5/s = ~2 s para 20 linhas → 10 linhas/s.
    const vazao = concluidas / Math.max(decorrido / 1000, 0.001);
    expect(vazao).toBeGreaterThanOrEqual(2);
  });

  it('nunca ultrapassa o teto de concorrência', async () => {
    vi.useFakeTimers();
    const limiter = createLimiter({ ratePerSecond: 100, burst: 100, concurrency: 4 });
    const controller = new AbortController();

    let simultaneas = 0;
    let pico = 0;
    const liberar: Array<() => void> = [];

    const tarefas = Array.from({ length: 12 }, () =>
      limiter.run(async () => {
        simultaneas += 1;
        pico = Math.max(pico, simultaneas);
        await new Promise<void>((resolve) => liberar.push(resolve));
        simultaneas -= 1;
      }, controller.signal),
    );

    await vi.advanceTimersByTimeAsync(0);
    expect(pico).toBeLessThanOrEqual(4);

    while (liberar.length > 0) {
      liberar.pop()?.();
      await vi.advanceTimersByTimeAsync(0);
    }
    await Promise.all(tarefas);
    expect(pico).toBeLessThanOrEqual(4);
  });

  it('espera pelo token quando a rajada acaba', async () => {
    vi.useFakeTimers();
    const limiter = createLimiter({ ratePerSecond: 2, burst: 2, concurrency: 4 });
    const controller = new AbortController();

    let concluidas = 0;
    const tarefas = Array.from({ length: 4 }, () =>
      limiter.run(async () => {
        concluidas += 1;
      }, controller.signal),
    );

    await vi.advanceTimersByTimeAsync(0);
    expect(concluidas).toBe(2);

    await vi.advanceTimersByTimeAsync(1000);
    await Promise.all(tarefas);
    expect(concluidas).toBe(4);
  });
});

describe('Cancelamento durante a espera (FR-026, SC-011)', () => {
  it('interrompe tarefas que aguardam token', async () => {
    vi.useFakeTimers();
    const limiter = createLimiter({ ratePerSecond: 1, burst: 1, concurrency: 4 });
    const controller = new AbortController();

    let executadas = 0;
    const tarefas = Array.from({ length: 5 }, () =>
      limiter
        .run(async () => {
          executadas += 1;
        }, controller.signal)
        .catch((error: unknown) => error),
    );

    await vi.advanceTimersByTimeAsync(0);
    expect(executadas).toBe(1);

    controller.abort();
    const resultados = await Promise.all(tarefas);

    expect(executadas).toBe(1);
    expect(resultados.slice(1).every((resultado) => isAbortError(resultado))).toBe(true);
  });

  it('interrompe tarefas que aguardam vaga na fila', async () => {
    vi.useFakeTimers();
    const limiter = createLimiter({ ratePerSecond: 100, burst: 100, concurrency: 1 });
    const controller = new AbortController();
    const bloqueio: { liberar: () => void } = { liberar: () => undefined };

    const primeira = limiter.run(
      () =>
        new Promise<void>((resolve) => {
          bloqueio.liberar = resolve;
        }),
      controller.signal,
    );
    const segunda = limiter.run(async () => undefined, controller.signal).catch((e: unknown) => e);

    await vi.advanceTimersByTimeAsync(0);
    controller.abort();

    expect(isAbortError(await segunda)).toBe(true);
    bloqueio.liberar();
    await primeira;
  });

  it('abortableDelay rejeita imediatamente com o sinal já abortado', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(abortableDelay(10_000, controller.signal)).rejects.toSatisfy(isAbortError);
  });

  it('abortableDelay não deixa o timer pendurado após o cancelamento', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const pendente = abortableDelay(30_000, controller.signal).catch((e: unknown) => e);

    controller.abort();
    expect(isAbortError(await pendente)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('Estado de espera observável (SC-011)', () => {
  it('publica e retira o estado de espera', async () => {
    vi.useFakeTimers();
    const observado: Array<WaitState | null> = [];
    const unsubscribe = onWaitStateChange((state) => observado.push(state));

    const espera = waitAnnounced(1000, 'retry_after');
    await vi.advanceTimersByTimeAsync(1000);
    await espera;

    expect(observado[0]).toBeNull();
    expect(observado[1]?.reason).toBe('retry_after');
    expect(observado.at(-1)).toBeNull();
    unsubscribe();
  });

  it('retira o estado de espera mesmo quando a espera é cancelada', async () => {
    vi.useFakeTimers();
    const observado: Array<WaitState | null> = [];
    const unsubscribe = onWaitStateChange((state) => observado.push(state));
    const controller = new AbortController();

    const espera = waitAnnounced(30_000, 'rate_limit', controller.signal).catch((e: unknown) => e);
    controller.abort();
    await espera;

    expect(observado.at(-1)).toBeNull();
    unsubscribe();
  });

  it('espera de duração não positiva não anuncia nada', async () => {
    const observado: Array<WaitState | null> = [];
    const unsubscribe = onWaitStateChange((state) => observado.push(state));

    await waitAnnounced(0, 'retry_after');

    expect(observado).toEqual([null]);
    unsubscribe();
  });
});
