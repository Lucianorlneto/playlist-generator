import ambientBackdrop from '@/assets/imgs/Ambient Backdrop.png';

/**
 * O fundo ambiente da área principal (FR-034, FR-048 a FR-050, FR-068, FR-070).
 *
 * ## Nenhuma referência remota sobrevive
 *
 * O arquivo de design buscava esta textura de uma URL de terceiro. Ela foi
 * produzida e versionada localmente, e é servida da própria origem pelo build
 * (FR-048). O portão é `e2e/no-remote-origin.spec.ts`, que falha se qualquer
 * requisição sair para fora — inclusive por recurso decorativo.
 *
 * ## Peso sem teto, proteção comportamental
 *
 * São ~617 KB, e FR-069 recusou explicitamente um teto de peso. A consequência
 * está registrada e a proteção é de **comportamento**, não de dimensão:
 *
 * - `position: fixed` com `inset-0` fora do fluxo — o conteúdo nunca espera por
 *   ela, e nada se desloca quando ela chega (FR-070, SC-020);
 * - `loading="lazy"` e `decoding="async"` — não participa da renderização
 *   inicial nem bloqueia a pintura (FR-050, FR-068);
 * - `aria-hidden` com `alt` vazio — invisível a tecnologia assistiva (FR-035);
 * - sem imagem, a tela é **plenamente utilizável e sem buraco**, porque a caixa
 *   é uma camada de fundo e não uma célula de layout (SC-014).
 *
 * ## Tratamento por tema é obrigatório
 *
 * Um único tratamento para os dois substratos é **erro**, não simplificação
 * (FR-049). A textura foi composta contra um quase-preto: sobre o off-white do
 * tema Papel ela suja o papel em vez de dar profundidade. O tratamento vive em
 * `src/styles/index.css`, sob `ambient-backdrop`, e difere em opacidade e em
 * modo de mistura entre os temas.
 */
export function AmbientBackdrop() {
  return (
    <div aria-hidden="true" className="ambient-backdrop pointer-events-none fixed inset-0 -z-10">
      <img
        src={ambientBackdrop}
        alt=""
        loading="lazy"
        decoding="async"
        className="size-full object-cover"
      />
    </div>
  );
}
