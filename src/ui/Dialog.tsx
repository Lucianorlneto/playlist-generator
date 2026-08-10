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

/**
 * Painel e véu.
 *
 * ## A analogia adotada (FR-063, FR-064)
 *
 * **O arquivo de design não desenha modal algum.** Silêncio do design não é
 * remoção: o diálogo de confirmação existe, é o que segura a promessa de
 * "nenhuma escrita sem confirmação", e precisa de um vocabulário visual.
 *
 * A analogia escolhida é o **painel**, a superfície mais próxima que o design
 * define: cartão de destino e painel lateral de apoio. Daí vêm as três decisões
 * deste bloco, e nenhuma foi inventada no olho:
 *
 * - `--radius-panel` (16px) em vez de `--radius-card` (12px). O diálogo é a
 *   superfície mais alta da pilha, e o degrau de raio mais generoso é o que o
 *   design reserva às superfícies que contêm outras;
 * - `--rule-strong` no contorno, porque a separação carrega significado — é ela
 *   que diz onde o modal termina e o véu começa;
 * - `--container-panel` para a largura, mais margem lateral pela escala. A medida
 *   é restrição de layout do sistema e vive em `index.css`, não escolhida dentro
 *   do componente.
 *
 * `shadow-card` é `none` no tema escuro por decisão — ali o painel se separa do
 * véu por luminosidade e pelo filete de 1px, que é como o escuro funciona
 * (`contracts/tokens.md` §4).
 *
 * A analogia está registrada no guia de estilo, como FR-064 exige.
 *
 * **Reconferido na 008** (FR-008, T021a): o diálogo repousa sobre o véu, não
 * sobre a área principal, e por isso a saída da moldura do `Wizard` não alterou
 * o substrato atrás dele. A analogia permanece a mesma e nada foi redesenhado —
 * silêncio do design continua não sendo ordem de remoção.
 */
const DIALOG_CLASSES =
  'bg-surface text-ink border-rule-strong m-auto w-full max-w-panel ' +
  'rounded-panel border p-6 shadow-card backdrop:bg-scrim';

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
