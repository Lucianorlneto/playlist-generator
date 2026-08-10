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
 * - `position: absolute` com `inset-0` fora do fluxo — o conteúdo nunca espera
 *   por ela, e nada se desloca quando ela chega (FR-070, SC-020);
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
    /*
      **A camada não carrega a opacidade; a imagem carrega.**

      No arquivo de design a textura e o esmaecimento são dois retângulos
      **irmãos** — `Ambient Backdrop` a 22% e `Backdrop Fade` opaco por cima —, e
      reproduzir isso com o véu dentro do elemento esmaecido não funcionaria: ele
      herdaria os 22% e deixaria de esmaecer.

      **Nada aqui pode pintar `--bg` opaco acima desta camada.** `z-index: -10`
      faz dela um contexto de empilhamento negativo, pintado antes dos fundos dos
      descendentes de bloco em fluxo — foi assim que o `bg-bg` que a casca
      declarava apagou a textura por inteiro, sem nenhum sinal de erro. O
      substrato vive no `body`, que se propaga para a tela do documento e é
      pintado **antes** dos contextos negativos.

      **`absolute` e não `fixed`, e a troca é de fidelidade.** O arquivo ancora a
      textura na **área principal**, não na janela: em Destinos ela é um retângulo
      de 1144 × 832 dentro de um `Main` de 892, e em Configuração de 1144 × 359
      dentro de um `Main` de 1918. Presa à janela, a parada mais clara do degradê
      — os 40% do topo — caía atrás da barra superior, e o conteúdo começava já a
      meio caminho do esmaecimento. O contêiner que a hospeda não rola, então
      `absolute` mantém a mesma imobilidade que `fixed` dava.

      **Sem `isolation` no hospedeiro**, e isso é deliberado: isolar criaria um
      contexto de empilhamento cujo fundo é transparente, e o `mix-blend-mode:
      multiply` do tema claro deixaria de ter com o que se misturar.
    */
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
      <img
        src={ambientBackdrop}
        alt=""
        loading="lazy"
        decoding="async"
        className="ambient-backdrop size-full object-cover"
      />
      <span aria-hidden="true" className="ambient-backdrop-veil" />
    </div>
  );
}
