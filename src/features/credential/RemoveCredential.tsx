import { useState } from 'react';

import type { ProviderId } from '@/domain/providers';
import { format, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
import { Button } from '@/ui/Button';

import { nameOf } from './providerText';

export interface RemoveCredentialProps {
  provider: ProviderId;
  onRemoved?: () => void;
}

/**
 * "Remover credencial" de **um** serviço (FR-006).
 *
 * Ação deliberadamente separada de "Desconectar": desconectar encerra a sessão e
 * preserva a credencial; remover apaga a credencial do dispositivo. Confundir as
 * duas obrigaria o usuário a recuperar o Client ID no painel do provedor toda
 * vez que quisesse trocar de conta.
 *
 * Remover também desmarca o destino correspondente — e **apenas** ele. A regra
 * vive no domínio; a tela só dispara a ação.
 */
export function RemoveCredential({ provider, onRemoved }: RemoveCredentialProps) {
  const removeCredential = useAppStore((state) => state.removeCredential);
  const [confirming, setConfirming] = useState(false);

  const service = nameOf(provider);
  const label = format(t.credential.remove, { service });

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
          {label}
        </Button>
        <p className="field-message">{format(t.credential.removeHint, { service })}</p>
      </div>
    );
  }

  return (
    <div role="group" aria-label={t.credential.removeHeading} className="flex flex-col gap-2">
      <p className="text-ink text-sm">{format(t.credential.removeConfirm, { service })}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            removeCredential(provider);
            setConfirming(false);
            onRemoved?.();
          }}
        >
          {label}
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
