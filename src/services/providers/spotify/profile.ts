/**
 * Perfil do usuário — `GET /v1/me` (001/contrato §4).
 *
 * Consome apenas `id` e `display_name`; nenhum escopo adicional é necessário.
 * Quando o nome de exibição vem vazio ou nulo, o `id` assume o lugar: o caminho
 * efetivo de FR-027 não pode aparecer com um buraco.
 */

import type { ProviderUser } from '@/domain/types';
import { fromHttpStatus, fromNetworkError } from '@/services/providers/errors';
import { apiUrlFor } from '@/services/providers/hosts';
import { apiRequest } from '@/services/providers/http';

const PROVIDER = 'spotify' as const;

interface ProfileResponse {
  id: string;
  display_name?: string | null;
}

function toUser(payload: ProfileResponse): ProviderUser {
  const displayName = payload.display_name;
  return {
    id: payload.id,
    displayName:
      typeof displayName === 'string' && displayName.trim() !== '' ? displayName : payload.id,
  };
}

/** Caminho normal: sessão já existe e o cliente aplica renovação e repetição. */
export async function getProfile(signal?: AbortSignal): Promise<ProviderUser> {
  const payload = await apiRequest<ProfileResponse>(PROVIDER, '/v1/me', {
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
): Promise<ProviderUser> {
  let response: Response;
  try {
    response = await fetch(apiUrlFor(PROVIDER, '/v1/me'), {
      headers: { Authorization: `Bearer ${accessToken}` },
      ...(signal === undefined ? {} : { signal }),
    });
  } catch (error) {
    throw fromNetworkError(error, PROVIDER);
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw fromHttpStatus(response.status, { provider: PROVIDER, body: payload });
  }

  return toUser(payload as ProfileResponse);
}
