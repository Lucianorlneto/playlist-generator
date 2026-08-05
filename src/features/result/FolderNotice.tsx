import { t } from '@/i18n/pt-BR';

/**
 * Aviso sobre pastas (FR-037, SC-007).
 *
 * Acompanha **toda** criação bem-sucedida. A plataforma não expõe pastas de
 * playlist para aplicações de terceiros; dizer isso explicitamente é o que
 * impede o usuário de procurar um campo que, por FR-038, não existe.
 */
export function FolderNotice() {
  return (
    <section className="border-border bg-surface-muted rounded-lg border p-3">
      <h3 className="text-ink text-sm font-bold">{t.result.folderNoticeHeading}</h3>
      <p className="text-ink-muted mt-1 text-sm">{t.result.folderNotice}</p>
    </section>
  );
}
