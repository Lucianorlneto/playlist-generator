import { format, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
import { Button } from '@/ui/Button';

const formatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/**
 * Avisos sobre o rascunho (FR-037 a FR-039, FR-042).
 *
 * Recuperar trabalho sem avisar seria tão ruim quanto perdê-lo: o usuário
 * precisa saber por que a tela não está vazia e ter como começar do zero.
 * "Descartar rascunho" preserva as credenciais — são coisas separadas, e é a
 * **única** ação, além do sucesso completo, que apaga trabalho (Princípio V).
 *
 * Um rascunho da versão anterior é restaurado como fluxo Spotify de destino
 * único, sem aviso além deste banner (FR-042).
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
        className="border-state-uncertain-edge bg-state-uncertain-tint text-ink rounded-card border p-3 text-body"
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

  if (notice === 'kept_after_quota') {
    return (
      <div
        role="status"
        className="border-state-uncertain-edge bg-state-uncertain-tint text-ink rounded-card border p-3 text-body"
      >
        <p>{t.draft.keptAfterQuota}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              if (window.confirm(t.draft.discardConfirm)) discardDraft();
            }}
          >
            {t.draft.discard}
          </Button>
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
      </div>
    );
  }

  if (notice === 'discarded') {
    return (
      <div role="status" className="border-rule bg-surface rounded-card border p-3 text-body">
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
    /*
      A faixa perdeu o fundo âmbar suave e ganhou uma guia de 3px à esquerda
      (contracts/components.md §10). A informação migrou de preenchimento para
      estrutura, que é o que o FR-047 pede: fundo tingido em âmbar era
      exatamente o que fazia esta faixa competir visualmente com o botão
      primário.

      A guia é `guide-edge`, um utilitário de `index.css`, e não
      `border-l-accent`: uma barra sólida é preenchimento — o único uso que o
      FR-050 autoriza para o âmbar cheio — e mantê-la fora do componente permite
      à regra de lint recusar `border-accent` sem exceção
      (contracts/token-migration.md §6.5).
    */
    <div role="status" className="guide-edge border-rule bg-surface rounded-card border p-3 text-body">
      <p className="text-ink font-semibold">
        {notice === 'migrated' ? t.draft.migrated : t.draft.recoveredHeading}
      </p>
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
