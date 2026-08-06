/**
 * Retorno do consentimento, roteado por provedor (research §1 e §2).
 *
 * A aplicação não tem rota `/callback`: o retorno cai na própria raiz. O que
 * muda entre os serviços é **onde** a resposta vem:
 *
 * - Spotify (authorization code): na **query** — `?code=…&state=…`;
 * - YouTube (implicit): no **fragmento** — `#access_token=…&state=…`.
 *
 * Nos dois casos os parâmetros saem da barra de endereço **antes de qualquer
 * `await`**. No Spotify porque um F5 tentaria reusar um código já consumido; no
 * YouTube porque um token no fragmento sobrevive no histórico e pode vazar no
 * `Referer` — e essa é a razão mais forte das duas.
 */

import { PROVIDER_ORDER, type ProviderId } from '@/domain/providers';
import type { ProviderSession } from '@/domain/types';
import { computeRedirectUri } from '@/features/credential/redirectUri';
import { AppError, toAppError } from '@/services/providers/errors';
import { providerFor } from '@/services/providers/registry';

export type CallbackOutcome =
  | { kind: 'none' }
  | { kind: 'connected'; session: ProviderSession }
  | { kind: 'error'; provider: ProviderId; error: AppError };

/** Remove `code`, `state` e `error` da query, preservando o resto. */
export function stripQueryParams(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  let touched = false;
  for (const param of ['code', 'state', 'error']) {
    if (url.searchParams.has(param)) {
      url.searchParams.delete(param);
      touched = true;
    }
  }
  if (!touched) return;
  const query = url.searchParams.toString();
  window.history.replaceState(
    null,
    '',
    `${url.pathname}${query === '' ? '' : `?${query}`}${url.hash}`,
  );
}

/** Lê o fragmento e o apaga do histórico na mesma operação. */
export function takeFragmentParams(): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams();

  const raw = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  const params = new URLSearchParams(raw);

  if (params.has('access_token') || params.has('error')) {
    const { pathname, search } = window.location;
    window.history.replaceState(null, '', `${pathname}${search}`);
  }

  return params;
}

/** Qual provedor está voltando, se algum. `null` quando não há retorno. */
function detectProvider(query: URLSearchParams, fragment: URLSearchParams): ProviderId | null {
  if (fragment.has('access_token') || fragment.has('error')) return 'youtube';
  if (query.has('code') || query.has('error')) return 'spotify';
  return null;
}

export async function handleAuthCallback(
  credentials: Partial<Record<ProviderId, string | null>>,
): Promise<CallbackOutcome> {
  if (typeof window === 'undefined') return { kind: 'none' };

  const query = new URLSearchParams(window.location.search);
  const fragment = takeFragmentParams();
  const provider = detectProvider(query, fragment);

  if (provider === null) return { kind: 'none' };

  // A query sai da URL antes de qualquer await, pelo mesmo motivo do fragmento.
  if (provider === 'spotify') stripQueryParams();

  const clientId = credentials[provider] ?? null;
  if (clientId === null) {
    return { kind: 'error', provider, error: new AppError('auth_invalid_client', { provider }) };
  }

  try {
    const session = await providerFor(provider).completeAuthorization({
      provider,
      clientId,
      redirectUri: computeRedirectUri(),
      params: provider === 'youtube' ? fragment : query,
    });
    return { kind: 'connected', session };
  } catch (error) {
    return { kind: 'error', provider, error: toAppError(error, provider) };
  }
}

/** Ordem fixa — usada para varrer credenciais na inicialização. */
export const CALLBACK_PROVIDERS = PROVIDER_ORDER;
