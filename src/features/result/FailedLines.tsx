import type { ProviderId } from '@/domain/providers';
import { lineNumeral } from '@/domain/run/numeral';
import { nameOf } from '@/features/credential/providerText';
import { format, t } from '@/i18n/pt-BR';
import { CopyButton } from '@/ui/CopyButton';

export interface FailedLinesProps {
  provider: ProviderId;
  lines: string[];
  /**
   * `line.index` de cada entrada, na mesma ordem de `lines`.
   *
   * Opcional porque um rascunho gravado antes da 005 não o traz. Sem ele a lista
   * aparece sem numeral, em vez de a tela quebrar.
   */
  indices?: number[];
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
export function FailedLines({ provider, lines, indices = [] }: FailedLinesProps) {
  if (lines.length === 0) return null;

  const service = nameOf(provider);

  return (
    <section className="border-rule bg-bg rounded-card border p-3">
      <h3 className="text-ink text-body font-bold">
        {format(t.result.failedHeading, { service })}
      </h3>
      <p className="field-message">{t.result.failedHint}</p>
      {/*
        **Onde a assinatura prova o argumento dela.** O numeral que a pessoa viu
        na revisão reaparece aqui, ao lado da linha que não entrou — é a resposta
        gráfica para "quais das minhas 60 linhas falharam?" (design.md §5).

        A goteira colapsa junto com o resto abaixo do breakpoint, e o numeral
        continua tabular pelo `data-numeral`, para que a coluna alinhe mesmo
        misturando `08` e `11`.
      */}
      <ul className="mt-2 flex flex-col gap-1">
        {lines.map((line, position) => {
          const index = indices[position];
          return (
            <li key={`${line}-${String(position)}`} className="gutter-row">
              {index === undefined ? (
                <span aria-hidden="true" />
              ) : (
                <span aria-hidden="true" className="data-numeral text-accent-text">
                  {lineNumeral(index)}
                </span>
              )}
              <span className="text-ink text-body break-words">{line}</span>
            </li>
          );
        })}
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
