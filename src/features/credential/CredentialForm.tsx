import { useState } from 'react';

import { t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
import { looksLikeClientId } from '@/store/credentialSlice';
import { Button } from '@/ui/Button';
import { LiveRegion } from '@/ui/LiveRegion';
import { TextField } from '@/ui/TextField';

import { MaskedValue } from './MaskedValue';
import { RemoveCredential } from './RemoveCredential';

/**
 * Campo de credencial (FR-001 a FR-004).
 *
 * Sem credencial salva, mostra o campo vazio. Com credencial salva, mostra o
 * valor mascarado e o botão de revelar — o campo não é pré-preenchido, para que
 * a credencial nunca apareça em texto claro sem ação explícita (SC-004).
 *
 * Formato divergente gera **aviso**, nunca bloqueio: o formato pode mudar e a
 * autorização é a validação real (data-model.md → Credential).
 */
export function CredentialForm() {
  const credential = useAppStore((state) => state.credential);
  const revealed = useAppStore((state) => state.credentialRevealed);
  const formatWarning = useAppStore((state) => state.credentialFormatWarning);
  const setCredential = useAppStore((state) => state.setCredential);
  const toggleReveal = useAppStore((state) => state.toggleCredentialReveal);

  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<string | null>(null);

  function submit(): void {
    const value = draft.trim();
    if (value === '') {
      setError(t.credential.emptyError);
      return;
    }
    setError(null);
    setCredential(value);
    setDraft('');
    setAnnouncement(t.credential.saved);
  }

  if (credential !== null) {
    return (
      <section className="flex flex-col gap-3">
        <MaskedValue value={credential.clientId} revealed={revealed} onToggle={toggleReveal} />
        {formatWarning && (
          <p className="field-message text-status-uncertain">{t.credential.formatWarning}</p>
        )}
        <RemoveCredential
          onRemoved={() => {
            setAnnouncement(t.credential.removed);
          }}
        />
        <LiveRegion message={announcement} />
      </section>
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
        label={t.credential.fieldLabel}
        hint={t.credential.fieldHint}
        placeholder={t.credential.placeholder}
        value={draft}
        error={error}
        warning={
          draft.trim() !== '' && !looksLikeClientId(draft) ? t.credential.formatWarning : null
        }
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
