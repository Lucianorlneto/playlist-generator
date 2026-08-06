import { PROVIDER_ORDER } from '@/domain/providers';
import { validateAtLeastOneCredential } from '@/domain/validation';
import { AuthError } from '@/features/connect/AuthError';
import { t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
import { Button } from '@/ui/Button';
import { StepHeading } from '@/ui/StepHeading';

import { CredentialForm } from './CredentialForm';
import { textFor } from './providerText';
import { RedirectUriHint } from './RedirectUriHint';

/**
 * Etapa 1: configuração das credenciais (FR-001 a FR-007, FR-043).
 *
 * Um bloco por serviço, na ordem fixa. **Nenhum é obrigatório isoladamente** —
 * a saída da etapa exige apenas que exista ao menos uma credencial (FR-002).
 *
 * A autorização **não** acontece aqui. Ela pertence ao ciclo de cada serviço,
 * disparada quando aquele destino começa: pedir consentimento a um provedor que
 * o usuário ainda nem selecionou violaria SC-005.
 */
export function CredentialStep() {
  const stepToken = useAppStore((state) => state.stepToken);
  const credentials = useAppStore((state) => state.credentials);
  const authError = useAppStore((state) => state.authError);
  const goToStep = useAppStore((state) => state.goToStep);

  const validation = validateAtLeastOneCredential(credentials);

  return (
    <section className="flex flex-col gap-6">
      <StepHeading
        title={t.credential.heading}
        description={t.credential.intro}
        focusToken={stepToken}
      />

      <AuthError error={authError} />

      {PROVIDER_ORDER.map((provider) => {
        const text = textFor(provider);
        return (
          <section
            key={provider}
            aria-labelledby={`credencial-${provider}`}
            className="flex flex-col gap-3"
          >
            <h3 id={`credencial-${provider}`} className="text-ink text-base font-bold">
              {text.credentialHeading}
            </h3>
            <CredentialForm provider={provider} />
            <p className="field-message">{text.scopesNotice}</p>
            {text.setupNotices.map((notice) => (
              <p key={notice} className="field-message text-status-uncertain">
                {notice}
              </p>
            ))}
            <RedirectUriHint provider={provider} />
          </section>
        );
      })}

      <div className="flex flex-col gap-1">
        <div>
          <Button
            variant="primary"
            disabled={!validation.ok}
            onClick={() => {
              goToStep('destinations');
            }}
          >
            {t.common.next}
          </Button>
        </div>
        {!validation.ok && <p className="field-message">{t.credential.noneSaved}</p>}
      </div>
    </section>
  );
}
