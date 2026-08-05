/**
 * Perfil do usuário — `GET /v1/me` (contrato §4).
 *
 * Consome apenas `id` e `display_name`; nenhum escopo adicional é necessário
 * (research §3). Quando o nome de exibição vem vazio ou nulo, o `id` assume o
 * lugar: o caminho efetivo de FR-036 não pode aparecer com um buraco.
 */

import type { SpotifyUser } from '@/domain/types';

import { apiRequest } from './client';
import { fromHttpStatus, fromNetworkError } from './errors';
import { apiUrl } from './hosts';

interface ProfileResponse {
  id: string;
  display_name?: string | null;
}

function toUser(payload: ProfileResponse): SpotifyUser {
  const displayName = payload.display_name;
  return {
    id: payload.id,
    displayName:
      typeof displayName === 'string' && displayName.trim() !== '' ? displayName : payload.id,
  };
}

/** Caminho normal: sessão já existe e o cliente aplica renovação e repetição. */
export async function getProfile(signal?: AbortSignal): Promise<SpotifyUser> {
  const payload = await apiRequest<ProfileResponse>('/v1/me', {
    ...(signal === undefined ? {} : { signal }),
  });
  return toUser(payload);
}

/**
 * Caminho de conexão: chamado logo após a troca do código, quando ainda não
 * existe sessão gravada para o cliente HTTP consultar. Por isso o token vai
 * explícito, e não pelo `apiRequest`.
 */
export async function getProfileWithToken(
  accessToken: string,
  signal?: AbortSignal,
): Promise<SpotifyUser> {
  let response: Response;
  try {
    response = await fetch(apiUrl('/v1/me'), {
      headers: { Authorization: `Bearer ${accessToken}` },
      ...(signal === undefined ? {} : { signal }),
    });
  } catch (error) {
    throw fromNetworkError(error);
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw fromHttpStatus(response.status, { body: payload });
  }

  return toUser(payload as ProfileResponse);
}
