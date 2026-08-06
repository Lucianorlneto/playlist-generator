import { useState } from 'react';

import { parseLine } from '@/domain/parser';
import type { ProviderId } from '@/domain/providers';
import type { MatchItem } from '@/domain/types';
import { matchLine } from '@/features/input/matchRunner';
import { t } from '@/i18n/pt-BR';
import { isAbortError } from '@/services/rate-limiter';
import { useAppStore } from '@/store';
import { Button } from '@/ui/Button';
import { TextField } from '@/ui/TextField';

export interface LineEditorProps {
  item: MatchItem;
  provider: ProviderId;
  onDone: () => void;
}

/**
 * Edição de uma linha com re-busca **apenas daquela linha**.
 *
 * A correção de texto vai para a **fonte única** de linhas, não só para este
 * item: é o que faz a linha corrigida aqui alimentar a busca do serviço seguinte
 * (FR-014). O que **não** propaga é a escolha de candidata — essa pertence a
 * esta execução e a mais nenhuma (SC-013).
 *
 * A busca dispara na confirmação — Enter ou saída do campo — nunca a cada tecla.
 * O `id` da linha é preservado na reanálise, e só este item é escrito de volta,
 * o que mantém intacto o estado de revisão de todas as demais linhas.
 */
export function LineEditor({ item, provider, onDone }: LineEditorProps) {
  const patchItem = useAppStore((state) => state.patchItem);
  const correctLine = useAppStore((state) => state.correctLine);
  const [text, setText] = useState(item.line.raw);
  const [running, setRunning] = useState(false);

  async function confirm(): Promise<void> {
    const trimmed = text.trim();
    if (running || trimmed === '' || trimmed === item.line.raw.trim()) {
      onDone();
      return;
    }

    setRunning(true);
    const parsed = parseLine(text, item.line.index, item.line.id);

    // `raw`, `id` e `index` da fonte única não mudam (invariante L2).
    correctLine(item.line.id, { title: parsed.title, artist: parsed.artist });
    patchItem(item.line.id, { status: 'searching', error: null });

    try {
      const line = useAppStore.getState().lines.find((entry) => entry.id === item.line.id) ?? parsed;
      const resolved = await matchLine(provider, line, new AbortController().signal);
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
