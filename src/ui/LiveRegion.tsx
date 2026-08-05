export interface LiveRegionProps {
  /** `null` mantém a região presente e vazia — remover o nó silenciaria o anúncio. */
  message: string | null;
  politeness?: 'polite' | 'assertive';
  /** Torna o texto visível além de anunciado. */
  visible?: boolean;
}

/**
 * Região viva. O nó existe sempre, mesmo sem mensagem: leitores de tela só
 * anunciam mudanças dentro de uma região que já estava no documento.
 */
export function LiveRegion({ message, politeness = 'polite', visible = false }: LiveRegionProps) {
  return (
    <span
      aria-live={politeness}
      aria-atomic="true"
      className={visible ? 'text-ink-muted text-sm' : 'sr-only'}
    >
      {message ?? ''}
    </span>
  );
}
