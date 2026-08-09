import { useMemo } from 'react';

import { parseInput } from '@/domain/parser';
import { format, plural, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
import { StepHeading } from '@/ui/StepHeading';
import { TextArea } from '@/ui/TextArea';

/** Acima disso o aviso de duração aparece (caso de borda da spec). */
export const LARGE_LIST_THRESHOLD = 500;

/**
 * Etapa 3: colar a lista (FR-014).
 *
 * O texto, o nome e a visibilidade são informados **uma vez** e valem para todos
 * os destinos. Sair daqui monta a fila e entrega o controle ao ciclo do primeiro
 * serviço — a busca não começa nesta tela, porque no YouTube ela precisa passar
 * antes pela estimativa de cota (FR-029, SC-011).
 */
export function InputScreen() {
  const stepToken = useAppStore((state) => state.stepToken);
  const rawText = useAppStore((state) => state.rawText);
  const setRawText = useAppStore((state) => state.setRawText);

  const lineCount = useMemo(
    () => rawText.split(/\r?\n/u).filter((line) => line.trim() !== '').length,
    [rawText],
  );

  /**
   * Quantas linhas provavelmente exigirão escolha manual (US4/AC1).
   *
   * A previsão é a das linhas **sem artista declarado**: são elas que dependem
   * da regra de margem e, quando o título é comum, vão para o humano. É uma
   * estimativa de esforço, não uma promessa — por isso "provavelmente" no texto.
   * Contá-la aqui custa uma análise local do texto, nenhuma requisição.
   */
  const manualLikely = useMemo(
    () => parseInput(rawText).filter((line) => line.parseStatus === 'parsed' && line.artist === '')
      .length,
    [rawText],
  );

  const empty = rawText.trim() === '';

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

      <p className="text-ink-muted text-body">
        {plural(lineCount, t.input.lineCountOne, t.input.lineCountOther)}
      </p>

      {!empty && (
        <p className="field-message">
          {manualLikely === 0
            ? t.input.manualEffortNone
            : plural(manualLikely, t.input.manualEffortOne, t.input.manualEffortOther)}
        </p>
      )}

      {lineCount > LARGE_LIST_THRESHOLD && (
        <p role="status" className="field-message text-state-uncertain">
          {format(t.input.largeListWarning, { count: lineCount })}
        </p>
      )}

      {/*
        As ações e a explicação de lista vazia **saíram desta tela** na feature
        007 e vivem na barra de ações do rodapé do conteúdo (FR-016). O que ficou
        aqui é o campo e o que ele diz sobre o que foi colado.
      */}
    </section>
  );
}
