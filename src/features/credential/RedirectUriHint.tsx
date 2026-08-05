import { t } from '@/i18n/pt-BR';
import { CopyButton } from '@/ui/CopyButton';

import { computeRedirectUri, usesRejectedLocalhost } from './redirectUri';

export interface RedirectUriHintProps {
  /** Injetável para teste; em produção vem do cálculo em tempo de execução. */
  redirectUri?: string;
}

/**
 * Instruções de obtenção do Client ID e o Redirect URI **exato** a cadastrar,
 * com botão de copiar (FR-011).
 *
 * O valor nunca é hardcoded: vem de `computeRedirectUri`, então o texto exibido
 * é sempre o endereço real de onde a aplicação está sendo servida — inclusive em
 * uma hospedagem estática em subdiretório.
 */
export function RedirectUriHint({ redirectUri }: RedirectUriHintProps) {
  const uri = redirectUri ?? computeRedirectUri();
  const localhostRisk = usesRejectedLocalhost(uri);

  return (
    <section className="border-border bg-surface-muted rounded-lg border p-3">
      <h3 className="text-ink text-sm font-bold">{t.credential.howToHeading}</h3>
      <ol className="text-ink-muted mt-2 list-decimal space-y-1 pl-5 text-sm">
        {t.credential.howToSteps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="mt-2 text-sm">
        <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener noreferrer">
          {t.credential.dashboardLinkLabel}
        </a>
      </p>

      <h3 className="text-ink mt-4 text-sm font-bold">{t.credential.redirectUriHeading}</h3>
      <p className="field-message">{t.credential.redirectUriHint}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="border-border bg-surface text-ink rounded-lg border px-2 py-1 text-sm break-all">
          {uri}
        </code>
        <CopyButton value={uri} label={t.credential.copyRedirectUri} />
      </div>
      {/* O aviso é sempre exibido; quando a aplicação de fato está em `localhost`
          ele vira alerta, porque aí a autorização vai falhar de verdade. */}
      <p role={localhostRisk ? 'alert' : undefined} className="field-message text-status-uncertain">
        {t.credential.redirectUriLocalhostWarning}
      </p>
    </section>
  );
}
