import { format, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { Stagger } from '@/ui/motion';

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
 *
 * ## O que a feature 010 acrescentou (FR-021b)
 *
 * Entrada própria, no papel `enter` — o mesmo da lista de revisão. O aviso vive
 * **fora** do bloco que transita entre etapas e permanece imóvel durante a
 * troca: ele não pertence a nenhuma etapa, sobrevive a todas, e transitá-lo
 * junto o faria sair e voltar a cada avanço, sugerindo que sumiu.
 *
 * Sendo um irmão só, a defasagem é zero e o papel degenera em entrada simples —
 * que é por que ele não custa entrada nova no catálogo
 * (`010/contracts/motion-catalog.md` §2.2).
 *
 * **O descartar continua imediato.** É ação comandada, e segurar a saída
 * atrasaria a confirmação de que o descarte aconteceu
 * (`010/contracts/surfaces.md` §1.5).
 */
export function DraftRecoveryBanner() {
  const notice = useAppStore((state) => state.draftNotice);

  if (notice === 'none') return null;

  return (
    <Stagger role="enter" as="div">
      <Aviso />
    </Stagger>
  );
}

function Aviso() {
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
        <p className="flex items-start gap-2">
          <Icon role="hint" className="text-state-uncertain mt-0.5" />
          <span>{notice === 'quota_failed' ? t.draft.quotaWarning : t.draft.quotaDegraded}</span>
        </p>
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
        <p className="flex items-start gap-2">
          <Icon role="hint" className="text-state-uncertain mt-0.5" />
          <span>{t.draft.keptAfterQuota}</span>
        </p>
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
        <p className="flex items-start gap-2">
          <Icon role="status-ok" className="text-state-confident mt-0.5" />
          <span>{t.draft.discarded}</span>
        </p>
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
