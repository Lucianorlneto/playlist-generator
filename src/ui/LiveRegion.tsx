import { cx } from './cx';

export interface LiveRegionProps {
  /** `null` mantém a região presente e vazia — remover o nó silenciaria o anúncio. */
  message: string | null;
  politeness?: 'polite' | 'assertive';
  /** Torna o texto visível além de anunciado. */
  visible?: boolean;
  /**
   * Classe adicional para quando a mensagem visível é dado numérico.
   *
   * Existe para `SearchProgress` poder pedir `data-numeral` sem que este
   * componente passe a conhecer o assunto de quem o usa.
   */
  className?: string;
}

/**
 * Região viva. O nó existe sempre, mesmo sem mensagem: leitores de tela só
 * anunciam mudanças dentro de uma região que já estava no documento.
 */
export function LiveRegion({
  message,
  politeness = 'polite',
  visible = false,
  className,
}: LiveRegionProps) {
  return (
    <span
      aria-live={politeness}
      aria-atomic="true"
      className={cx(visible ? 'text-ink-muted text-body' : 'sr-only', visible ? className : null)}
    >
      {message ?? ''}
    </span>
  );
}
