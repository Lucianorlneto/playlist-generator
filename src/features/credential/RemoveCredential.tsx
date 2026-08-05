import { useState } from 'react';

import { t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
import { Button } from '@/ui/Button';

export interface RemoveCredentialProps {
  onRemoved?: () => void;
}

/**
 * "Remover credencial" (FR-004).
 *
 * Ação deliberadamente separada de "Desconectar": desconectar encerra a sessão e
 * preserva a credencial; remover apaga a credencial do dispositivo. Confundir as
 * duas obrigaria o usuário a recuperar o Client ID no Developer Dashboard toda
 * vez que quisesse trocar de conta (US1 cenário 6).
 */
export function RemoveCredential({ onRemoved }: RemoveCredentialProps) {
  const removeCredential = useAppStore((state) => state.removeCredential);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <div>
        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            setConfirming(true);
          }}
        >
          {t.credential.remove}
        </Button>
        <p className="field-message">{t.credential.removeHint}</p>
      </div>
    );
  }

  return (
    <div role="group" aria-label={t.credential.removeHeading} className="flex flex-col gap-2">
      <p className="text-ink text-sm">{t.credential.removeConfirm}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            removeCredential();
            setConfirming(false);
            onRemoved?.();
          }}
        >
          {t.credential.remove}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setConfirming(false);
          }}
        >
          {t.common.cancel}
        </Button>
      </div>
    </div>
  );
}
