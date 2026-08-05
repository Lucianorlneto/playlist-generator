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

export function StepHeading({ title, description, focusToken }: StepHeadingProps) {
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, [focusToken]);

  return (
    <header className="mb-4">
      <h2 ref={heading} tabIndex={-1} className="focus-ring text-ink text-xl font-bold">
        {title}
      </h2>
      {description !== undefined && <p className="text-ink-muted mt-1 text-sm">{description}</p>}
    </header>
  );
}
