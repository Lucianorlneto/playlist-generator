import { format, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
import { Button } from '@/ui/Button';

const formatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/**
 * Avisos sobre o rascunho (FR-044, FR-045).
 *
 * Recuperar trabalho sem avisar seria tão ruim quanto perdê-lo: o usuário
 * precisa saber por que a tela não está vazia e ter como começar do zero.
 * "Descartar rascunho" preserva a credencial — são coisas separadas.
 */
export function DraftRecoveryBanner() {
  const notice = useAppStore((state) => state.draftNotice);
  const savedAt = useAppStore((state) => state.draftSavedAt);
  const setDraftNotice = useAppStore((state) => state.setDraftNotice);
  const discardDraft = useAppStore((state) => state.discardDraft);

  if (notice === 'none') return null;

  if (notice === 'quota_degraded' || notice === 'quota_failed') {
    return (
      <div
        role="status"
        className="border-status-uncertain bg-status-uncertain-soft text-ink rounded-lg border p-3 text-sm"
      >
        <p>{notice === 'quota_failed' ? t.draft.quotaWarning : t.draft.quotaDegraded}</p>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setDraftNotice('none');
          }}
        >
          {t.common.close}
        </Button>
      </div>
    );
  }

  if (notice === 'discarded') {
    return (
      <div role="status" className="border-border bg-surface rounded-lg border p-3 text-sm">
        <p>{t.draft.discarded}</p>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setDraftNotice('none');
          }}
        >
          {t.common.close}
        </Button>
      </div>
    );
  }

  return (
    <div role="status" className="border-accent bg-accent-soft rounded-lg border p-3 text-sm">
      <p className="text-ink font-semibold">{t.draft.recoveredHeading}</p>
      <p className="text-ink-muted mt-1">
        {format(t.draft.recoveredBody, {
          when: savedAt === null ? '—' : formatter.format(new Date(savedAt)),
        })}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            setDraftNotice('none');
          }}
        >
          {t.draft.continue}
        </Button>
        <Button
          size="sm"
          variant="danger"
          onClick={() => {
            if (window.confirm(t.draft.discardConfirm)) discardDraft();
          }}
        >
          {t.draft.discard}
        </Button>
      </div>
    </div>
  );
}
