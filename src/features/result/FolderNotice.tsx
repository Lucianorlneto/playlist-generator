import type { ProviderId } from '@/domain/providers';
import { textFor } from '@/features/credential/providerText';
import { t } from '@/i18n/pt-BR';

export interface FolderNoticeProps {
  provider: ProviderId;
}

/**
 * Avisos de honestidade sobre limites da plataforma (FR-027, FR-028).
 *
 * Acompanha **toda** criação bem-sucedida, com o texto daquele serviço:
 *
 * - nenhuma das duas plataformas expõe pastas de playlist a aplicativos de
 *   terceiros — dizer isso impede o usuário de procurar um campo que não existe;
 * - no YouTube, a declaração adicional de que a playlist criada é do **YouTube**,
 *   não do YouTube Music. É a diferença que mais gera expectativa errada, e o
 *   Princípio de honestidade proíbe deixá-la implícita.
 */
export function FolderNotice({ provider }: FolderNoticeProps) {
  const text = textFor(provider);

  return (
    <section className="border-rule bg-bg rounded-card border p-3">
      <h3 className="text-ink text-body font-bold">{t.result.folderNoticeHeading}</h3>
      <p className="text-ink-muted mt-1 text-body">{text.folderNotice}</p>
      {text.resultNotices.map((notice) => (
        <p key={notice} className="text-ink-muted mt-2 text-body">
          {notice}
        </p>
      ))}
    </section>
  );
}
