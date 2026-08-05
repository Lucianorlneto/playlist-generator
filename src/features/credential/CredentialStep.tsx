import { AuthError } from '@/features/connect/AuthError';
import { ConnectButton } from '@/features/connect/ConnectButton';
import { t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
import { Button } from '@/ui/Button';
import { StepHeading } from '@/ui/StepHeading';

import { CredentialForm } from './CredentialForm';
import { RedirectUriHint } from './RedirectUriHint';

/** Etapa 1 do fluxo linear: credencial e conexão (FR-041). */
export function CredentialStep() {
  const stepToken = useAppStore((state) => state.stepToken);
  const session = useAppStore((state) => state.session);
  const authError = useAppStore((state) => state.authError);
  const goToStep = useAppStore((state) => state.goToStep);

  return (
    <section className="flex flex-col gap-4">
      <StepHeading
        title={t.credential.heading}
        description={t.credential.intro}
        focusToken={stepToken}
      />

      <CredentialForm />
      <RedirectUriHint />
      <AuthError error={authError} />

      {session === null ? (
        <ConnectButton />
      ) : (
        <div>
          <Button
            variant="primary"
            onClick={() => {
              goToStep('input');
            }}
          >
            {t.common.next}
          </Button>
        </div>
      )}
    </section>
  );
}
