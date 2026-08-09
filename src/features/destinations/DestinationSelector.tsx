import { PROVIDER_ORDER } from '@/domain/providers';
import { nameOf } from '@/features/credential/providerText';
import { format, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
import { Button } from '@/ui/Button';
import { cx } from '@/ui/cx';
import { Icon } from '@/ui/Icon';

/**
 * Mapas explícitos de literais, nunca concatenação: o scanner do Tailwind lê o
 * código como texto e não resolve expressão (`tp/no-dynamic-classname`).
 */
const PROVIDER_ICON = {
  spotify: 'provider-spotify',
  youtube: 'provider-youtube',
} as const;

/**
 * A cor de marca como **acento identificador** (FR-023).
 *
 * Entra por `text-*`, que tinge o glifo — o ícone herda `currentColor`. Nunca
 * por `bg-*`: preenchimento sólido significa acionável neste sistema (FR-024), e
 * um cartão pintado de verde Spotify diria "clique aqui" em vez de "este é o
 * Spotify". A regra de lint `tp/no-raw-visual-values` recusa `bg-brand-*`.
 */
const BRAND_INK = {
  spotify: 'text-brand-spotify',
  youtube: 'text-brand-youtube',
} as const;

/**
 * Seletor de múltipla escolha dos destinos (FR-008 a FR-010).
 *
 * Duas exigências que a implementação carrega literalmente:
 *
 * - **o motivo do bloqueio é escrito**, não deduzido de um controle apagado
 *   (FR-009). "Sem Client ID de X cadastrado" diz o que fazer; um `disabled` sem
 *   texto não diz nada;
 * - **há atalho para resolver** — o botão volta à configuração, em vez de exigir
 *   que o usuário encontre o caminho sozinho.
 *
 * A ordem vem de `PROVIDER_ORDER`, nunca desta tela (invariante P1).
 */
export function DestinationSelector() {
  const credentials = useAppStore((state) => state.credentials);
  const destinations = useAppStore((state) => state.destinations);
  const toggle = useAppStore((state) => state.toggleDestination);
  const goToStep = useAppStore((state) => state.goToStep);

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-ink text-body font-bold">{t.destinations.groupLabel}</legend>

      {PROVIDER_ORDER.map((provider) => {
        const service = nameOf(provider);
        const available = credentials[provider] !== null;
        const checked = destinations.selected.includes(provider);
        const disabled = !available || destinations.locked;
        const reasonId = `destino-motivo-${provider}`;

        return (
          /*
            **A anatomia do cartão de destino** (FR-020, FR-023).

            `--radius-panel` porque é a superfície mais alta desta tela — contém
            controle, rótulo e, quando falta credencial, um bloco de motivo com a
            própria ação. `--surface` e não `--bg`: é cartão sobre a área
            principal, e o degrau de luminosidade é o que o separa dela.

            O cartão do destino **selecionado** ganha contorno `--rule-strong` em
            vez de `--rule`. A distinção é de contorno e não de preenchimento:
            preencher o selecionado o faria parecer o botão da tela.
          */
          <div
            key={provider}
            className={cx(
              'bg-surface rounded-panel border p-4',
              checked ? 'border-rule-strong' : 'border-rule',
              disabled ? 'opacity-60' : null,
            )}
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id={`destino-${provider}`}
                checked={checked}
                disabled={disabled}
                aria-describedby={available ? undefined : reasonId}
                className="focus-ring accent-accent size-4 shrink-0"
                onChange={() => {
                  toggle(provider);
                }}
              />
              {/*
                O acento identificador. Decorativo: o nome do serviço está
                escrito no rótulo ao lado, e o ícone nunca é o único portador
                (FR-042).
              */}
              <Icon
                role={PROVIDER_ICON[provider]}
                className={cx('text-step', BRAND_INK[provider])}
              />
              <label
                htmlFor={`destino-${provider}`}
                className="text-ink text-section min-w-0 cursor-pointer"
              >
                {format(t.destinations.selectLabel, { service })}
              </label>
            </div>

            {!available && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <p id={reasonId} className="field-message">
                  {format(t.destinations.unavailableReason, { service })}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    goToStep('credential');
                  }}
                >
                  {format(t.destinations.unavailableAction, { service })}
                </Button>
              </div>
            )}
          </div>
        );
      })}

      {destinations.locked && <p className="field-message">{t.destinations.lockedNotice}</p>}
    </fieldset>
  );
}
