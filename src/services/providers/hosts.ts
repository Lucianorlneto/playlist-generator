/**
 * Lista fechada de destinos de rede da aplicação, por provedor (Princípio II).
 *
 * Nenhuma requisição pode sair para um host fora daqui. O Princípio II exige
 * literalmente que a lista seja "mantida em um único módulo de hosts
 * autorizados" — por isso este arquivo substitui `services/spotify/hosts.ts`, e
 * não é refatoração opcional: um segundo provedor sob `services/spotify/` seria
 * contradição literal do princípio.
 *
 * A tabela é verificada entrada a entrada por `tests/unit/no-secrets.spec.ts`,
 * falhando tanto por host **ausente** quanto por host **excedente**, e espelhada
 * na CSP de `vite.config.ts`.
 *
 * `https://open.spotify.com`, `https://developer.spotify.com`,
 * `https://www.youtube.com` e `https://console.cloud.google.com` aparecem
 * **apenas como link exibido ao usuário**, nunca como destino de requisição
 * (research §14).
 */

import type { ProviderId } from '@/domain/providers';

export const PROVIDER_HOSTS: Record<ProviderId, readonly string[]> = {
  spotify: ['https://accounts.spotify.com', 'https://api.spotify.com', 'https://i.scdn.co'],
  youtube: ['https://accounts.google.com', 'https://www.googleapis.com', 'https://i.ytimg.com'],
};

export const ALLOWED_ORIGINS: readonly string[] = Object.values(PROVIDER_HOSTS).flat();

// --- Spotify ---------------------------------------------------------------

export const SPOTIFY_ACCOUNTS_ORIGIN = 'https://accounts.spotify.com';
export const SPOTIFY_API_ORIGIN = 'https://api.spotify.com';
export const SPOTIFY_AUTHORIZE_URL = `${SPOTIFY_ACCOUNTS_ORIGIN}/authorize`;
export const SPOTIFY_TOKEN_URL = `${SPOTIFY_ACCOUNTS_ORIGIN}/api/token`;

// --- YouTube ---------------------------------------------------------------

export const GOOGLE_ACCOUNTS_ORIGIN = 'https://accounts.google.com';
export const GOOGLE_API_ORIGIN = 'https://www.googleapis.com';
/** Navegação de página inteira, nunca `fetch` — por isso fora de `connect-src`. */
export const GOOGLE_AUTHORIZE_URL = `${GOOGLE_ACCOUNTS_ORIGIN}/o/oauth2/v2/auth`;

/** Origem da API de cada provedor — a base de toda URL construída. */
const API_ORIGIN: Record<ProviderId, string> = {
  spotify: SPOTIFY_API_ORIGIN,
  youtube: GOOGLE_API_ORIGIN,
};

export function isAllowedUrl(url: string): boolean {
  try {
    return ALLOWED_ORIGINS.includes(new URL(url).origin);
  } catch {
    return false;
  }
}

/** `true` quando a URL pertence ao provedor indicado — e a nenhum outro. */
export function isAllowedForProvider(provider: ProviderId, url: string): boolean {
  try {
    return PROVIDER_HOSTS[provider].includes(new URL(url).origin);
  } catch {
    return false;
  }
}

export type UrlParams = Record<string, string | number | boolean | undefined>;

/**
 * Constrói uma URL da API de um provedor a partir de um caminho.
 * Spotify: `/v1/…` · YouTube: `/youtube/v3/…`.
 */
export function apiUrlFor(provider: ProviderId, path: string, params?: UrlParams): string {
  const url = new URL(path, API_ORIGIN[provider]);
  if (params !== undefined) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}
