import type { ProviderId } from '@/domain/providers';
import { t } from '@/i18n/pt-BR';
import { providerFor } from '@/services/providers/registry';
import { CopyButton } from '@/ui/CopyButton';

import { textFor } from './providerText';
import { computeJavaScriptOrigin, computeRedirectUri, usesRejectedLocalhost } from './redirectUri';

export interface RedirectUriHintProps {
  provider: ProviderId;
  /** Injetáveis para teste; em produção vêm do cálculo em tempo de execução. */
  redirectUri?: string;
  javaScriptOrigin?: string;
}

/**
 * Instruções de obtenção do Client ID e o Redirect URI **exato** a cadastrar,
 * com botão de copiar (FR-005).
 *
 * O valor nunca é hardcoded: vem de `computeRedirectUri`, então o texto exibido
 * é sempre o endereço real de onde a aplicação está sendo servida — inclusive em
 * uma hospedagem estática em subdiretório.
 *
 * A origem JavaScript aparece só nos provedores que a exigem
 * (`setup.needsJavaScriptOrigin`). É dado da capacidade, não ramificação por
 * serviço.
 */
export function RedirectUriHint({ provider, redirectUri, javaScriptOrigin }: RedirectUriHintProps) {
  const uri = redirectUri ?? computeRedirectUri();
  const origin = javaScriptOrigin ?? computeJavaScriptOrigin();
  const localhostRisk = usesRejectedLocalhost(uri);
  const text = textFor(provider);
  const setup = providerFor(provider).setup;

  return (
    <section className="border-rule bg-bg rounded-card border p-3">
      <h4 className="text-ink text-body font-bold">{text.howToHeading}</h4>
      <ol className="text-ink-muted mt-2 list-decimal space-y-1 pl-6 text-body">
        {text.howToSteps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="mt-2 text-body">
        <a href={setup.consoleUrl} target="_blank" rel="noopener noreferrer">
          {text.consoleLinkLabel}
        </a>
      </p>

      <h4 className="text-ink mt-4 text-body font-bold">{t.credential.redirectUriHeading}</h4>
      <p className="field-message">{t.credential.redirectUriHint}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="border-rule bg-surface text-ink rounded-card border px-2 py-1 text-body break-all">
          {uri}
        </code>
        <CopyButton value={uri} label={t.credential.copyRedirectUri} />
      </div>

      {setup.needsJavaScriptOrigin && (
        <>
          <h4 className="text-ink mt-4 text-body font-bold">{t.credential.javascriptOriginHeading}</h4>
          <p className="field-message">{t.credential.javascriptOriginHint}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="border-rule bg-surface text-ink rounded-card border px-2 py-1 text-body break-all">
              {origin}
            </code>
            <CopyButton value={origin} label={t.credential.copyJavascriptOrigin} />
          </div>
        </>
      )}

      {/* O aviso é sempre exibido; quando a aplicação de fato está em `localhost`
          ele vira alerta, porque aí a autorização vai falhar de verdade. */}
      <p role={localhostRisk ? 'alert' : undefined} className="field-message text-state-uncertain">
        {t.credential.redirectUriLocalhostWarning}
      </p>
    </section>
  );
}
