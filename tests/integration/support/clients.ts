/**
 * Ligação dos clientes HTTP nos testes de integração.
 *
 * Faz o mesmo que `bootstrap.wireProviderClients`, com sessões de teste e sem
 * tocar no store — o que permite exercitar as políticas do cliente (renovação,
 * backoff, desambiguação do 403) sem montar a aplicação inteira.
 */

import type { ProviderId } from '@/domain/providers';
import type { ProviderSession } from '@/domain/types';
import { configureProviderClient } from '@/services/providers/http';
import { createRefresher } from '@/services/providers/spotify/auth';
import { recordConsumption } from '@/services/providers/youtube/quota';
import { classifyYouTubeError } from '@/services/providers/youtube/errors';
import { limiterFor } from '@/services/rate-limiter';

import { makeSession } from '../../fixtures/factories';

export const SPOTIFY_CLIENT_ID = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
export const YOUTUBE_CLIENT_ID = '123-abc.apps.googleusercontent.com';

export interface WireOptions {
  session?: ProviderSession | null;
  onSave?: (session: ProviderSession) => void;
  onClear?: () => void;
}

/** Limitador sem espera: as políticas de vazão têm testes próprios. */
export function useFastLimiters(): void {
  for (const provider of ['spotify', 'youtube'] as ProviderId[]) {
    limiterFor(provider).configure({ ratePerSecond: 10_000, burst: 10_000, concurrency: 4 });
  }
}

export function wireSpotify(options: WireOptions = {}): { current: ProviderSession | null } {
  const state: { current: ProviderSession | null } = {
    current: options.session ?? makeSession('spotify'),
  };

  configureProviderClient('spotify', {
    getSession: () => state.current,
    saveSession: (session) => {
      state.current = session;
      options.onSave?.(session);
    },
    clearSession: () => {
      state.current = null;
      options.onClear?.();
    },
    refresh: createRefresher(() => SPOTIFY_CLIENT_ID),
  });

  return state;
}

export function wireYouTube(options: WireOptions = {}): { current: ProviderSession | null } {
  const state: { current: ProviderSession | null } = {
    current: options.session ?? makeSession('youtube'),
  };

  configureProviderClient('youtube', {
    getSession: () => state.current,
    saveSession: (session) => {
      state.current = session;
      options.onSave?.(session);
    },
    clearSession: () => {
      state.current = null;
      options.onClear?.();
    },
    // Sem `refresh`: a capacidade declara que não há renovação silenciosa.
    recordConsumption,
    classifyError: classifyYouTubeError,
  });

  return state;
}

export function wireBoth(): void {
  wireSpotify();
  wireYouTube();
}
