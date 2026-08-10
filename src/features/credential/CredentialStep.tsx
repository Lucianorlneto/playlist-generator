import { PROVIDER_ORDER } from '@/domain/providers';
import { AuthError } from '@/features/connect/AuthError';
import { t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
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
  const authError = useAppStore((state) => state.authError);

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
        **Não há ação de avançar aqui.** Ela vive na faixa fixa do rodapé, junto
        com a contagem de serviços configurados e o motivo do bloqueio
        (`CredentialActionBar`, nó `fVjnY`).

        A 007 punha o botão ao pé desta lista, argumentando que a etapa não tem
        uma decisão única a confirmar — tem um cartão por serviço, cada um com a
        sua. A parte correta do argumento sobrevive: **salvar e remover
        permanecem nos cartões**, porque são sobre aquele Client ID. O avanço não
        era um deles, e ao pé de uma página de dois mil pixels ele só existia
        depois de rolar tudo.
      */}
    </section>
  );
}
