import { useState } from 'react';

import { isSubsetOf, removedIds } from '@/domain/run/lines';
import type { ProviderId } from '@/domain/providers';
import type { InputLine } from '@/domain/types';
import { nameOf } from '@/features/credential/providerText';
import { format, plural, t } from '@/i18n/pt-BR';
import { Button } from '@/ui/Button';

export interface ListReductionProps {
  provider: ProviderId;
  /** Linhas que o destino receberia hoje, na ordem da fonte única. */
  lines: InputLine[];
  /** Ids atualmente destinados ao serviço — o conjunto de partida. */
  lineIds: string[];
  /** Quantas linhas cabem no saldo, quando a entrada veio do bloqueio de cota. */
  maxLinesThatFit?: number;
  onConfirm: (lineIds: string[]) => void;
  onCancel: () => void;
}

/**
 * Ajuste da lista para um destino ainda não iniciado (FR-013).
 *
 * **Modo somente-remoção**, e isso é a regra inteira: não há campo de texto,
 * nem reordenação, nem inclusão. A lista de um destino posterior é sempre um
 * subconjunto ordenado da anterior — `isSubsetOf` valida o resultado antes de
 * confirmar, e a interface simplesmente não oferece as operações que ele
 * recusaria.
 *
 * Lista vazia é apresentada como **"pular destino"**, não como erro: é o que o
 * caso de borda da spec pede, e é honesto — nada será criado naquela conta.
 */
export function ListReduction({
  provider,
  lines,
  lineIds,
  maxLinesThatFit,
  onConfirm,
  onCancel,
}: ListReductionProps) {
  const [kept, setKept] = useState<string[]>(lineIds);

  const service = nameOf(provider);
  const removed = removedIds(lineIds, kept);
  const valid = isSubsetOf(lineIds, kept);

  function toggle(id: string): void {
    setKept((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : // Reinserção respeita a ordem original: nunca reordena (FR-013).
          lineIds.filter((entry) => current.includes(entry) || entry === id),
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-ink text-base font-bold">
        {format(t.reduction.heading, { service })}
      </h3>
      <p className="field-message">{t.reduction.intro}</p>

      {maxLinesThatFit !== undefined && (
        <p className="field-message">
          {format(t.reduction.fitHint, { count: maxLinesThatFit })}
        </p>
      )}

      <ul
        aria-label={format(t.reduction.listLabel, { service })}
        className="flex flex-col gap-1"
      >
        {lines.map((line) => {
          const inList = kept.includes(line.id);
          return (
            <li
              key={line.id}
              className="border-border bg-surface flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2"
            >
              <span
                className={
                  inList
                    ? 'text-ink font-mono text-sm break-words'
                    : 'text-ink-muted font-mono text-sm break-words line-through'
                }
              >
                {line.raw}
              </span>
              <Button
                size="sm"
                variant={inList ? 'danger' : 'ghost'}
                onClick={() => {
                  toggle(line.id);
                }}
              >
                {format(inList ? t.reduction.removeLine : t.reduction.restoreLine, {
                  line: line.raw,
                })}
              </Button>
            </li>
          );
        })}
      </ul>

      <p className="text-ink text-sm font-semibold">
        {plural(kept.length, t.reduction.remainingOne, t.reduction.remainingOther)}
      </p>
      {removed.length > 0 && (
        <p className="field-message">
          {plural(removed.length, t.reduction.removedCountOne, t.reduction.removedCountOther)}
        </p>
      )}
      {kept.length === 0 && (
        <p role="status" className="field-message text-status-uncertain">
          {format(t.reduction.emptyMeansSkip, { service })}
        </p>
      )}
      {!valid && <p className="field-message text-status-not-found">{t.reduction.notASubset}</p>}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          disabled={!valid}
          onClick={() => {
            onConfirm(kept);
          }}
        >
          {t.reduction.confirm}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {t.common.cancel}
        </Button>
      </div>
    </section>
  );
}
