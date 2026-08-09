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

      {PROVIDER_ORDER.map((provider, index) => {
        const text = textFor(provider);
        return (
          /*
            **O cartão por serviço, com o passo numerado** (FR-061).

            O arquivo de design numera os passos da configuração, e o numeral
            está no cartão e não numa coluna reservada — a goteira da 005 saiu
            (FR-029). Cada cartão contém o que explica **e** a ação sobre aquele
            Client ID: salvar e remover pertencem ao serviço, não à etapa, e é
            por isso que esta tela não tem barra de ações no rodapé.
          */
          <section
            key={provider}
            aria-labelledby={`credencial-${provider}`}
            className="border-rule bg-surface rounded-panel flex flex-col gap-3 border p-4"
          >
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="bg-accent-tint text-accent-text border-accent-text rounded-pill text-data flex size-6 shrink-0 items-center justify-center border font-semibold"
              >
                {index + 1}
              </span>
              <h3 id={`credencial-${provider}`} className="text-ink text-section">
                {text.credentialHeading}
              </h3>
            </div>

            <CredentialForm provider={provider} />
            <p className="field-message">{text.scopesNotice}</p>
            {text.setupNotices.map((notice) => (
              <p key={notice} className="field-message text-state-uncertain">
                {notice}
              </p>
            ))}
            <RedirectUriHint provider={provider} />
          </section>
        );
      })}

      {/*
        A ação de avançar fica **aqui**, e não numa barra de rodapé: FR-016 fecha
        a lista de etapas com faixa em Destinos e Entrada, e a Configuração não
        está nela. O motivo é que esta etapa não tem uma decisão única a
        confirmar — ela tem um cartão por serviço, cada um com a sua.
      */}
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
