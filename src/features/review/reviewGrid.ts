/**
 * Grade compartilhada entre o cabeçalho de colunas e cada linha da revisão.
 *
 * Uma string literal única, em um módulo só: se cabeçalho e linha declarassem a
 * grade cada um por conta própria, elas divergiriam na primeira alteração e as
 * colunas deixariam de alinhar (research §14).
 *
 * Mobile-first: uma coluna empilhada por padrão, quatro colunas a partir de
 * `sm:` (640 px). Todas as colunas flexíveis usam `minmax(0, …)` — nenhuma
 * largura fixa em pixels, que é o que faria a página rolar na horizontal.
 */
export const REVIEW_GRID =
  'grid grid-cols-1 gap-2 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-center sm:gap-3';
