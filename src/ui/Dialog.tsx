import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Diálogo modal sobre o elemento `<dialog>` nativo (`004/ui-contract §1`).
 *
 * **Sem biblioteca, por decisão escrita** (`004/research §8`): o elemento nativo
 * já entrega contenção de foco, `Esc`, camada de topo e semântica de modal para
 * leitor de tela. A constituição põe o ônus da prova em quem quer adicionar
 * dependência, e aqui não há o que uma biblioteca faria melhor — ela
 * reimplementaria em JavaScript o que o navegador implementa em C++.
 *
 * Três consequências de usar o nativo, e todas são o motivo da escolha:
 *
 * 1. **Nenhum `z-index`** (U6). A camada de topo do navegador fica acima de
 *    qualquer contexto de empilhamento da página, inclusive dos que ainda não
 *    existem — é a única solução que não envelhece.
 * 2. **`Esc` já funciona**, e chega como o evento `close` (U2). Não há atalho de
 *    teclado escrito à mão para manter.
 * 3. **A contenção de foco é do navegador**, e por isso não é afirmada por teste
 *    de componente: happy-dom não emula a camada de topo. A prova está em
 *    Playwright (D1 do plan.md).
 *
 * `open` é a fonte da verdade, e o efeito reconcilia o elemento com ela. O
 * caminho inverso — o elemento fechando sozinho por `Esc` — volta pelo `onClose`,
 * para que o estado de quem chama nunca fique dessincronizado do que está na
 * tela.
 */
export interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** Id do título. O diálogo é **sempre** rotulado: sem título não há diálogo. */
  labelledBy: string;
  children: ReactNode;
}

const DIALOG_CLASSES =
  'bg-surface text-ink border-border-strong m-auto w-[min(32rem,calc(100vw-2rem))] ' +
  'rounded-xl border p-5 shadow-lg backdrop:bg-black/40';

export function Dialog({ open, onClose, labelledBy, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  /** Quem tinha o foco antes de abrir — para devolvê-lo ao fechar (U4). */
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (element === null) return;

    if (open) {
      if (element.hasAttribute('open')) return;
      previousFocus.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      // Sempre `showModal`, nunca `show` (U1): o não-modal não cria camada de
      // topo nem contém o foco, e seria um diálogo apenas de aparência.
      element.showModal();
      focusFirst(element);
      return;
    }

    if (element.hasAttribute('open')) element.close();
    // O foco volta ao ponto de partida mesmo quando o fechamento veio de fora,
    // e não de `Esc` — os dois caminhos passam por aqui.
    previousFocus.current?.focus();
    previousFocus.current = null;
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      className={DIALOG_CLASSES}
      onClose={onClose}
      onCancel={onClose}
    >
      {children}
    </dialog>
  );
}

/**
 * Foco no primeiro elemento focável (U3).
 *
 * O navegador já foca algo ao abrir um modal, mas o critério dele inclui o
 * próprio diálogo quando não encontra candidato — e um foco no contêiner não
 * anuncia ação alguma a quem usa leitor de tela.
 */
function focusFirst(element: HTMLDialogElement): void {
  const focusable = element.querySelector<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), ' +
      'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  );
  focusable?.focus();
}
