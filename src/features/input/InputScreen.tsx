import { useMemo } from 'react';

import { parseInput } from '@/domain/parser';
import { pendingItem } from '@/domain/types';
import { format, plural, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
import { Button } from '@/ui/Button';
import { StepHeading } from '@/ui/StepHeading';
import { TextArea } from '@/ui/TextArea';

import { runMatching } from './matchRunner';

/** Acima disso o aviso de duração aparece (edge case da spec). */
export const LARGE_LIST_THRESHOLD = 500;

/** Etapa 2: colar a lista e disparar a busca (FR-012, FR-026). */
export function InputScreen() {
  const stepToken = useAppStore((state) => state.stepToken);
  const rawText = useAppStore((state) => state.rawText);
  const setRawText = useAppStore((state) => state.setRawText);
  const running = useAppStore((state) => state.search.running);

  const lineCount = useMemo(
    () => rawText.split(/\r?\n/u).filter((line) => line.trim() !== '').length,
    [rawText],
  );

  const empty = rawText.trim() === '';

  async function startSearch(): Promise<void> {
    const store = useAppStore.getState();
    const lines = parseInput(store.rawText);
    if (lines.length === 0) return;

    const controller = new AbortController();
    store.setItems(lines.map((line) => pendingItem(line)));
    store.startSearch(lines.length, controller);
    store.goToStep('review');

    const items = await runMatching(lines, {
      signal: controller.signal,
      onProgress: (done) => {
        useAppStore.getState().reportSearchProgress(done);
      },
      onItem: (item) => {
        useAppStore.getState().patchItem(item.line.id, item);
      },
    });

    const current = useAppStore.getState();
    if (!controller.signal.aborted) current.setItems(items);
    current.finishSearch(controller.signal.aborted);
  }

  return (
    <section className="flex flex-col gap-4">
      <StepHeading title={t.input.heading} description={t.input.intro} focusToken={stepToken} />

      <TextArea
        label={t.input.textareaLabel}
        hint={t.input.separatorsHint}
        placeholder={t.input.placeholder}
        rows={12}
        value={rawText}
        spellCheck={false}
        onChange={(event) => {
          setRawText(event.target.value);
        }}
      />

      <p className="text-ink-muted text-sm">
        {plural(lineCount, t.input.lineCountOne, t.input.lineCountOther)}
      </p>

      {lineCount > LARGE_LIST_THRESHOLD && (
        <p role="status" className="field-message text-status-uncertain">
          {format(t.input.largeListWarning, { count: lineCount })}
        </p>
      )}

      {empty && <p className="field-message">{t.input.emptyHint}</p>}

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={empty || running} onClick={() => void startSearch()}>
          {running ? t.input.searching : t.input.search}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            useAppStore.getState().goToStep('credential');
          }}
        >
          {t.common.back}
        </Button>
      </div>
    </section>
  );
}
