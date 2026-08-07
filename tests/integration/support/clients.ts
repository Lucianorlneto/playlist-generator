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
import { requestLog, type RecordedRequest } from '../../msw/handlers';

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

// ---------------------------------------------------------------------------
// Contagem de requisições por provedor (`004/T003`)
// ---------------------------------------------------------------------------

/**
 * A que provedor pertence cada ponto de contato registrado pelo mock.
 *
 * A lista é exaustiva de propósito: um endpoint novo que não apareça aqui vira
 * erro de tipo, e não uma contagem silenciosamente errada. É essa contagem que
 * sustenta V5 ("a retomada emite requisição só para as linhas que faltam"), V11
 * ("nenhuma requisição após a detecção") e V12 (consumo total igual ao de uma
 * execução ininterrupta) — todas afirmações sobre **quantas** requisições
 * saíram, não sobre o resultado delas.
 */
const PROVIDER_OF: Record<RecordedRequest['endpoint'], ProviderId> = {
  token: 'spotify',
  me: 'spotify',
  myPlaylists: 'spotify',
  search: 'spotify',
  createPlaylist: 'spotify',
  addTracks: 'spotify',
  authorize: 'spotify',
  image: 'spotify',
  ytChannels: 'youtube',
  ytSearch: 'youtube',
  ytVideos: 'youtube',
  ytPlaylists: 'youtube',
  ytCreatePlaylist: 'youtube',
  ytPlaylistItems: 'youtube',
  ytImage: 'youtube',
};

/** Requisições já emitidas àquele provedor, na ordem em que saíram. */
export function requestsOf(provider: ProviderId): RecordedRequest[] {
  return requestLog.filter((entry) => PROVIDER_OF[entry.endpoint] === provider);
}

/** Quantas requisições saíram para aquele provedor. */
export function requestCountOf(provider: ProviderId): number {
  return requestsOf(provider).length;
}

/**
 * Marca o ponto atual do registro e devolve um leitor do que veio **depois**.
 *
 * É o que permite dizer "nenhuma requisição foi emitida a partir daqui" sem
 * zerar um registro que outra asserção do mesmo teste ainda vai ler.
 */
export function countRequestsFrom(provider: ProviderId): () => number {
  const mark = requestLog.length;
  return () =>
    requestLog.slice(mark).filter((entry) => PROVIDER_OF[entry.endpoint] === provider).length;
}
