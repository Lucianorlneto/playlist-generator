import { computeRedirectUri } from '@/features/credential/redirectUri';
import { t } from '@/i18n/pt-BR';
import type { AppError } from '@/services/spotify/errors';
import { CopyButton } from '@/ui/CopyButton';

export interface AuthErrorProps {
  error: AppError | null;
  redirectUri?: string;
}

/**
 * Erro de autorização com causa provável e próximo passo (FR-042).
 *
 * Quando a falha é de Redirect URI, a mensagem traz o endereço **exato** a
 * cadastrar com botão de copiar — sem isso o usuário teria de adivinhar qual dos
 * endereços possíveis o app usa (US4 cenário 4). `access_denied` cita a lista de
 * usuários permitidos de apps em modo de desenvolvimento, que é a causa mais
 * comum e a menos óbvia.
 */
export function AuthError({ error, redirectUri }: AuthErrorProps) {
  if (error === null) return null;

  const showRedirectUri = error.kind === 'auth_redirect_uri_mismatch';
  const uri = redirectUri ?? computeRedirectUri();

  return (
    <div
      role="alert"
      className="border-danger bg-danger-soft text-ink rounded-lg border p-3 text-sm"
    >
      <p className="font-bold">{error.info.title}</p>
      <p className="mt-1">{error.info.cause}</p>
      <p className="mt-1">{error.info.nextStep}</p>

      {showRedirectUri && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <code className="border-border bg-surface rounded-lg border px-2 py-1 break-all">
            {uri}
          </code>
          <CopyButton value={uri} label={t.credential.copyRedirectUri} />
        </div>
      )}
    </div>
  );
}
