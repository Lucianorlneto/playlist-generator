import { ActionBar } from '@/app/ActionBar';
import { parseInput } from '@/domain/parser';
import { plural, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';

/**
 * A faixa de ações da etapa de Entrada (FR-016 a FR-019).
 *
 * Sair daqui monta a fila e entrega o controle ao ciclo do primeiro serviço — a
 * busca **não** começa nesta tela, porque no YouTube ela precisa passar antes
 * pela estimativa de cota. A sequência é a mesma de antes da feature 007; o que
 * mudou é onde o botão que a dispara aparece.
 */
export function InputActionBar() {
  const rawText = useAppStore((state) => state.rawText);
  const running = useAppStore((state) => state.search.running);
  const goToStep = useAppStore((state) => state.goToStep);

  const lineCount = rawText.split(/\r?\n/u).filter((line) => line.trim() !== '').length;
  const empty = rawText.trim() === '';

  function start(): void {
    const store = useAppStore.getState();
    const lines = parseInput(store.rawText);
    if (lines.length === 0) return;

    store.setLines(lines);
    store.buildQueue();
    store.startQueue();
    store.goToStep('service');
  }

  return (
    <ActionBar
      state={plural(lineCount, t.input.lineCountOne, t.input.lineCountOther)}
      // Lista vazia é algo que o usuário precisa **fazer**; busca em curso é
      // algo que ele precisa **esperar**. A faixa distingue os dois, para não
      // acusar o usuário de não ter feito nada quando o aplicativo é que está
      // ocupado.
      blockedReason={empty ? t.input.emptyHint : null}
      busy={running}
      advanceLabel={t.input.start}
      onAdvance={start}
      onBack={() => {
        goToStep('destinations');
      }}
    />
  );
}
