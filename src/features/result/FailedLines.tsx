import { t } from '@/i18n/pt-BR';
import { CopyButton } from '@/ui/CopyButton';

export interface FailedLinesProps {
  lines: string[];
}

/**
 * Linhas sem correspondência, na ordem original, com cópia em bloco
 * (FR-039, FR-040).
 *
 * O texto copiado é o `raw` de cada linha — exatamente o que o usuário digitou.
 * Copiar uma versão normalizada obrigaria a reescrever tudo para tentar de novo.
 */
export function FailedLines({ lines }: FailedLinesProps) {
  if (lines.length === 0) return null;

  return (
    <section className="border-border bg-surface-muted rounded-lg border p-3">
      <h3 className="text-ink text-sm font-bold">{t.result.failedHeading}</h3>
      <p className="field-message">{t.result.failedHint}</p>
      <ul className="mt-2 flex flex-col gap-1">
        {lines.map((line, index) => (
          <li key={`${line}-${index}`} className="text-ink font-mono text-sm break-words">
            {line}
          </li>
        ))}
      </ul>
      <div className="mt-2">
        <CopyButton value={lines.join('\n')} label={t.result.copyFailed} />
      </div>
    </section>
  );
}
