import { useState } from 'react';

import { parseLine } from '@/domain/parser';
import type { MatchItem } from '@/domain/types';
import { matchLine } from '@/features/input/matchRunner';
import { t } from '@/i18n/pt-BR';
import { isAbortError } from '@/services/rate-limiter';
import { useAppStore } from '@/store';
import { Button } from '@/ui/Button';
import { TextField } from '@/ui/TextField';

export interface LineEditorProps {
  item: MatchItem;
  onDone: () => void;
}

/**
 * Edição de uma linha com re-busca **apenas daquela linha** (FR-017).
 *
 * A busca dispara na confirmação — Enter ou saída do campo — nunca a cada tecla.
 * O `id` da linha é preservado na re-análise, e só este item é escrito de volta
 * no store, o que mantém intacto o estado de revisão de todas as demais linhas.
 */
export function LineEditor({ item, onDone }: LineEditorProps) {
  const patchItem = useAppStore((state) => state.patchItem);
  const [text, setText] = useState(item.line.raw);
  const [running, setRunning] = useState(false);

  async function confirm(): Promise<void> {
    const trimmed = text.trim();
    if (running || trimmed === '' || trimmed === item.line.raw.trim()) {
      onDone();
      return;
    }

    setRunning(true);
    const line = parseLine(text, item.line.index, item.line.id);
    patchItem(item.line.id, { line, status: 'searching', error: null });

    try {
      const resolved = await matchLine(line, new AbortController().signal);
      patchItem(item.line.id, {
        line: resolved.line,
        status: resolved.status,
        candidates: resolved.candidates,
        selectedUri: resolved.selectedUri,
        included: resolved.included,
        error: resolved.error,
        previousStatus: null,
      });
    } catch (error) {
      if (!isAbortError(error)) {
        patchItem(item.line.id, { status: 'not_found', error: t.errors.searchLineFailed.title });
      }
    } finally {
      setRunning(false);
      onDone();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <TextField
        label={t.review.editLineLabel}
        hint={t.review.editLineHint}
        value={text}
        autoFocus
        disabled={running}
        onChange={(event) => {
          setText(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            void confirm();
          }
          if (event.key === 'Escape') onDone();
        }}
        onBlur={() => {
          void confirm();
        }}
      />
      <div className="flex gap-2">
        <Button size="sm" variant="primary" disabled={running} onClick={() => void confirm()}>
          {running ? t.input.searching : t.review.reSearch}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          {t.common.cancel}
        </Button>
      </div>
    </div>
  );
}
