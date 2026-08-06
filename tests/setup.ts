import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { Window } from 'happy-dom';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { resetLimiters, resetWaitState } from '@/services/rate-limiter';
import { resetProviderClients } from '@/services/providers/http';
import { useAppStore } from '@/store';

import { resetMockSpotify } from './msw/handlers';
import { server } from './msw/server';

/**
 * O Node 26 define um `globalThis.localStorage` próprio que fica `undefined` sem
 * a flag `--localstorage-file`, e esse acessor vence o do happy-dom quando o
 * ambiente é instalado. Reinstalamos as duas áreas a partir de uma janela
 * happy-dom para que o `Storage.prototype` continue sendo o mesmo que os testes
 * espionam.
 */
if (globalThis.localStorage === undefined || globalThis.sessionStorage === undefined) {
  const donor = new Window();
  Object.defineProperty(globalThis, 'localStorage', {
    value: donor.localStorage,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: donor.sessionStorage,
    configurable: true,
    writable: true,
  });
}

// `onUnhandledRequest: 'error'` é o que transforma os contratos de API em
// contrato executável: qualquer requisição para um endpoint fora da lista quebra
// o teste em vez de vazar silenciosamente (Princípio II).
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

/** Estado inicial do store, capturado antes de qualquer teste tocá-lo. */
const pristineState = useAppStore.getState();

afterEach(() => {
  cleanup();
  useAppStore.setState(pristineState, true);
  server.resetHandlers();
  resetMockSpotify();
  resetWaitState();
  resetLimiters();
  resetProviderClients();
  localStorage.clear();
  sessionStorage.clear();
});

afterAll(() => {
  server.close();
});
