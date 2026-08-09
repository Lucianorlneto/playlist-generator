import { useEffect, useRef, type ReactNode } from 'react';

export interface StepHeadingProps {
  title: string;
  description?: ReactNode;
  /**
   * Muda a cada transição de etapa. Ao mudar, o foco vai para o cabeçalho — sem
   * isso quem navega por teclado ou leitor de tela continuaria no controle da
   * etapa anterior, sem saber que a tela trocou (FR-041, FR-046).
   */
  focusToken: number;
}

/**
 * O título da tela corrente.
 *
 * ## `--text-page`, o degrau novo da 007
 *
 * A escala ganhou um sexto degrau acima de `--text-step` justamente para esta
 * posição: o título da tela é a maior tipografia do sistema, e antes ele
 * dividia o degrau com os títulos de seção internos. `--text-step` (1,5rem)
 * ficou para eles — o cartão de fase do serviço, o bloco de linhas que
 * falharam, a configuração da playlist (`contracts/tokens.md` §3).
 *
 * ## Não repete a posição no fluxo
 *
 * FR-041: a posição atual é anunciada **uma única vez**, e quem a anuncia é a
 * trilha — pelo `aria-current="step"` do degrau corrente, ou pelo `StepSummary`
 * em largura estreita. Um "Etapa 3 de 5" também aqui faria o leitor de tela
 * ouvir a mesma informação duas vezes por transição.
 */
export function StepHeading({ title, description, focusToken }: StepHeadingProps) {
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, [focusToken]);

  return (
    <header className="mb-4 flex flex-col gap-0.5">
      <h2 ref={heading} tabIndex={-1} className="focus-ring text-ink text-page">
        {title}
      </h2>
      {description !== undefined && <p className="text-ink-muted text-body">{description}</p>}
    </header>
  );
}
