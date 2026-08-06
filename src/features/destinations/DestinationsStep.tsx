import { PROVIDER_ORDER } from '@/domain/providers';
import { validateSelection } from '@/domain/validation';
import { nameOf } from '@/features/credential/providerText';
import { format, plural, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
import { Button } from '@/ui/Button';
import { StepHeading } from '@/ui/StepHeading';

import { DestinationSelector } from './DestinationSelector';

/**
 * Etapa 2: para onde a playlist vai (US1, FR-008 a FR-012, FR-043).
 *
 * O avanço é bloqueado com zero destinos (FR-011) e a mensagem explica o que
 * falta — não é um botão apagado sem explicação.
 *
 * A ordem de execução é declarada aqui, antes de começar: com dois destinos, o
 * usuário precisa saber que os serviços rodam **um por vez** e em que ordem,
 * porque isso muda o que ele vê a seguir (FR-015, FR-016).
 */
export function DestinationsStep() {
  const stepToken = useAppStore((state) => state.stepToken);
  const destinations = useAppStore((state) => state.destinations);
  const goToStep = useAppStore((state) => state.goToStep);

  const validation = validateSelection(destinations);
  const count = destinations.selected.length;

  const [first, second] = PROVIDER_ORDER;

  return (
    <section className="flex flex-col gap-4">
      <StepHeading
        title={t.destinations.heading}
        description={t.destinations.intro}
        focusToken={stepToken}
      />

      <DestinationSelector />

      <p className="field-message">
        {plural(count, t.destinations.selectedCountOne, t.destinations.selectedCountOther)}
      </p>

      {count > 1 && (
        <p className="field-message">
          {format(t.destinations.orderNotice, {
            first: first === undefined ? '' : nameOf(first),
            second: second === undefined ? '' : nameOf(second),
          })}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="ghost"
          onClick={() => {
            goToStep('credential');
          }}
        >
          {t.common.back}
        </Button>
        <Button
          variant="primary"
          disabled={!validation.ok}
          onClick={() => {
            goToStep('input');
          }}
        >
          {t.common.next}
        </Button>
      </div>

      {!validation.ok && <p className="field-message">{t.destinations.noneSelected}</p>}
    </section>
  );
}
