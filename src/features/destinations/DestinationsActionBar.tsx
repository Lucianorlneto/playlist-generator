import { ActionBar } from '@/app/ActionBar';
import { validateSelection } from '@/domain/validation';
import { plural, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';

/**
 * A faixa de ações da etapa de Destinos (FR-016 a FR-019).
 *
 * Os dois textos vêm do dicionário existente, não de chaves novas: a contagem de
 * destinos e a explicação de "nenhum selecionado" já eram escritas nesta tela,
 * dentro dela. A feature 007 as **move** para a faixa, onde o olho já está
 * quando procura o botão — não as reescreve. Texto novo para a mesma ideia
 * produziria duas frases divergentes para o mesmo estado.
 */
export function DestinationsActionBar() {
  const destinations = useAppStore((state) => state.destinations);
  const goToStep = useAppStore((state) => state.goToStep);

  const validation = validateSelection(destinations);
  const count = destinations.selected.length;

  return (
    <ActionBar
      state={plural(count, t.destinations.selectedCountOne, t.destinations.selectedCountOther)}
      blockedReason={validation.ok ? null : t.destinations.noneSelected}
      advanceLabel={t.common.next}
      onAdvance={() => {
        goToStep('input');
      }}
      onBack={() => {
        goToStep('credential');
      }}
    />
  );
}
