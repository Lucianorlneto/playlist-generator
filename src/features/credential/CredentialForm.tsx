import { useState } from 'react';

import type { ProviderId } from '@/domain/providers';
import { format, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
import { looksLikeClientId } from '@/store/credentialSlice';
import { Button } from '@/ui/Button';
import { LiveRegion } from '@/ui/LiveRegion';
import { TextField } from '@/ui/TextField';

import { MaskedValue } from './MaskedValue';
import { nameOf, textFor } from './providerText';
import { RemoveCredential } from './RemoveCredential';

export interface CredentialFormProps {
  provider: ProviderId;
}

/**
 * Campo de credencial de **um** serviço (FR-001 a FR-004).
 *
 * Um formulário por provedor, independentes: cadastrar o Client ID de um não
 * exige nem afeta o outro (FR-002, FR-006). Sem credencial salva, mostra o campo
 * vazio; com credencial salva, mostra o valor mascarado e o botão de revelar — o
 * campo não é pré-preenchido, para que a credencial nunca apareça em texto claro
 * sem ação explícita.
 *
 * Formato divergente gera **aviso**, nunca bloqueio: o formato pode mudar e a
 * autorização é a validação real.
 */
export function CredentialForm({ provider }: CredentialFormProps) {
  const credential = useAppStore((state) => state.credentials[provider]);
  const revealed = useAppStore((state) => state.credentialRevealed === provider);
  const formatWarning = useAppStore((state) => state.credentialFormatWarning[provider]);
  const setCredential = useAppStore((state) => state.setCredential);
  const toggleReveal = useAppStore((state) => state.toggleCredentialReveal);

  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<string | null>(null);

  const text = textFor(provider);
  const service = nameOf(provider);

  function submit(): void {
    const value = draft.trim();
    if (value === '') {
      setError(t.credential.emptyError);
      return;
    }
    setError(null);
    setCredential(provider, value);
    setDraft('');
    setAnnouncement(format(t.credential.saved, { service }));
  }

  if (credential !== null) {
    return (
      <div className="flex flex-col gap-3">
        <MaskedValue
          value={credential.clientId}
          revealed={revealed}
          provider={provider}
          onToggle={() => {
            toggleReveal(provider);
          }}
        />
        {formatWarning && <p className="field-message text-state-uncertain">{text.formatWarning}</p>}
        <RemoveCredential
          provider={provider}
          onRemoved={() => {
            setAnnouncement(format(t.credential.removed, { service }));
          }}
        />
        <LiveRegion message={announcement} />
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <TextField
        label={text.credentialLabel}
        hint={text.credentialHint}
        placeholder={text.placeholder}
        value={draft}
        error={error}
        warning={draft.trim() !== '' && !looksLikeClientId(provider, draft) ? text.formatWarning : null}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => {
          setDraft(event.target.value);
          if (error !== null) setError(null);
        }}
      />
      <div>
        <Button type="submit" variant="primary">
          {t.credential.save}
        </Button>
      </div>
      <LiveRegion message={announcement} />
    </form>
  );
}
