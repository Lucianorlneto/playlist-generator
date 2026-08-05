/**
 * Retorno do consentimento (research §2).
 *
 * A aplicação não tem rota `/callback`: o retorno cai na própria raiz com
 * `?code=` ou `?error=` na query. Este módulo detecta isso no carregamento,
 * valida o `state`, consome o registro PKCE e **limpa a query** com
 * `history.replaceState` — sem a limpeza, um F5 tentaria reusar um código que já
 * foi consumido, e o usuário veria um erro que não cometeu.
 */

import type { Session } from '@/domain/types';
import { computeRedirectUri } from '@/features/credential/redirectUri';
import { buildSession, exchangeCode } from '@/services/spotify/auth';
import { AppError, fromAuthorizeError, toAppError } from '@/services/spotify/errors';
import { getProfileWithToken } from '@/services/spotify/profile';
import { takePkce } from '@/services/storage/pkceRepo';

export type CallbackOutcome =
  { kind: 'none' } | { kind: 'connected'; session: Session } | { kind: 'error'; error: AppError };

/** Remove `code`, `state` e `error` da barra de endereço, preservando o resto. */
export function stripAuthParams(): void {
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

export async function handleAuthCallback(clientId: string | null): Promise<CallbackOutcome> {
  if (typeof window === 'undefined') return { kind: 'none' };

  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const errorCode = params.get('error');
  const state = params.get('state');

  if (code === null && errorCode === null) return { kind: 'none' };

  // A query sai da URL antes de qualquer await: o código é de uso único.
  stripAuthParams();

  const pkce = takePkce();

  if (errorCode !== null) {
    return { kind: 'error', error: fromAuthorizeError(errorCode) };
  }

  if (pkce === null || state === null || state !== pkce.state) {
    return { kind: 'error', error: new AppError('auth_state_mismatch') };
  }

  if (clientId === null) {
    return { kind: 'error', error: new AppError('auth_invalid_client') };
  }

  try {
    const tokens = await exchangeCode({
      clientId,
      code: code as string,
      redirectUri: computeRedirectUri(),
      codeVerifier: pkce.codeVerifier,
    });
    const user = await getProfileWithToken(tokens.accessToken);
    return { kind: 'connected', session: buildSession(tokens, user) };
  } catch (error) {
    return { kind: 'error', error: toAppError(error) };
  }
}
