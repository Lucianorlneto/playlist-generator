import { PROVIDER_ORDER } from '@/domain/providers';
import { nameOf } from '@/features/credential/providerText';
import { format, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
import { Button } from '@/ui/Button';

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
          <div key={provider} className="border-rule bg-bg rounded-card border p-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`destino-${provider}`}
                checked={checked}
                disabled={disabled}
                aria-describedby={available ? undefined : reasonId}
                className="size-4"
                onChange={() => {
                  toggle(provider);
                }}
              />
              <label htmlFor={`destino-${provider}`} className="text-ink text-body font-semibold">
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
