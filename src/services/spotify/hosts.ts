/**
 * Lista fechada de destinos de rede da aplicação (FR-010).
 *
 * Nenhuma requisição pode sair para um host fora daqui. A lista é um módulo
 * próprio porque é verificada por teste (`tests/unit/no-secrets.spec.ts`) e
 * espelhada na CSP de `vite.config.ts`.
 */

export const ACCOUNTS_ORIGIN = 'https://accounts.spotify.com';
export const API_ORIGIN = 'https://api.spotify.com';
export const IMAGE_ORIGIN = 'https://i.scdn.co';

export const ALLOWED_ORIGINS: readonly string[] = [ACCOUNTS_ORIGIN, API_ORIGIN, IMAGE_ORIGIN];

export const AUTHORIZE_URL = `${ACCOUNTS_ORIGIN}/authorize`;
export const TOKEN_URL = `${ACCOUNTS_ORIGIN}/api/token`;

export function isAllowedUrl(url: string): boolean {
  try {
    const origin = new URL(url).origin;
    return ALLOWED_ORIGINS.includes(origin);
  } catch {
    return false;
  }
}

/** Constrói uma URL da Web API a partir de um caminho `/v1/...`. */
export function apiUrl(path: string, params?: Record<string, string | number | undefined>): string {
  const url = new URL(path, API_ORIGIN);
  if (params !== undefined) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}
