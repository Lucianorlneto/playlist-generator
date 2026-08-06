import type { ProviderId } from '@/domain/providers';
import { nameOf } from '@/features/credential/providerText';
import { format, t } from '@/i18n/pt-BR';
import { CopyButton } from '@/ui/CopyButton';

export interface FailedLinesProps {
  provider: ProviderId;
  lines: string[];
}

/**
 * Linhas sem correspondência **naquele serviço**, na ordem original, com cópia
 * em bloco (FR-041).
 *
 * A cópia é por serviço, não consolidada: uma linha pode ter sido encontrada no
 * Spotify e não no YouTube, e juntar as duas listas produziria um texto que não
 * serve para tentar de novo em lugar nenhum.
 *
 * O texto copiado é o `raw` de cada linha — exatamente o que o usuário digitou.
 * Copiar uma versão normalizada obrigaria a reescrever tudo.
 */
export function FailedLines({ provider, lines }: FailedLinesProps) {
  if (lines.length === 0) return null;

  const service = nameOf(provider);

  return (
    <section className="border-border bg-surface-muted rounded-lg border p-3">
      <h3 className="text-ink text-sm font-bold">
        {format(t.result.failedHeading, { service })}
      </h3>
      <p className="field-message">{t.result.failedHint}</p>
      <ul className="mt-2 flex flex-col gap-1">
        {lines.map((line, index) => (
          <li key={`${line}-${index}`} className="text-ink font-mono text-sm break-words">
            {line}
          </li>
        ))}
      </ul>
      <div className="mt-2">
        <CopyButton
          value={lines.join('\n')}
          label={format(t.result.copyFailed, { service })}
        />
      </div>
    </section>
  );
}
