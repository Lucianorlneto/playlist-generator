import { computeRedirectUri } from '@/features/credential/redirectUri';
import { t } from '@/i18n/pt-BR';
import { buildAuthorizeUrl } from '@/services/spotify/auth';
import { toAppError } from '@/services/spotify/errors';
import { useAppStore } from '@/store';
import { Button } from '@/ui/Button';

export interface ConnectButtonProps {
  /** Injetável para teste: em produção é a navegação real do navegador. */
  navigate?: (url: string) => void;
}

export function ConnectButton({ navigate }: ConnectButtonProps) {
  const credential = useAppStore((state) => state.credential);
  const connecting = useAppStore((state) => state.connecting);
  const setConnecting = useAppStore((state) => state.setConnecting);
  const setAuthError = useAppStore((state) => state.setAuthError);

  async function connect(): Promise<void> {
    if (credential === null) return;
    setConnecting(true);
    try {
      const { url } = await buildAuthorizeUrl(credential.clientId, computeRedirectUri());
      if (navigate === undefined) {
        window.location.assign(url);
      } else {
        navigate(url);
      }
    } catch (error) {
      setAuthError(toAppError(error));
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="primary"
        disabled={credential === null || connecting}
        onClick={() => void connect()}
      >
        {connecting ? t.connect.connecting : t.connect.connect}
      </Button>
      {credential === null && <p className="field-message">{t.connect.needsCredential}</p>}
      <p className="field-message">{t.connect.scopesNotice}</p>
    </div>
  );
}
