import { PROVIDER_ORDER } from '@/domain/providers';
import { nameOf } from '@/features/credential/providerText';
import { format, plural, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
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

      {/*
        As ações **saíram desta tela** na feature 007 e vivem na barra de ações
        do rodapé do conteúdo, junto com a contagem de destinos e a explicação de
        "nenhum selecionado" (FR-016). O que ficou aqui é o que a etapa é: o
        seletor e o que ele exige saber.
      */}
    </section>
  );
}
