import { PulsingBar } from '@/ui/motion';

/**
 * A grade de esqueleto que ocupa o lugar das quatro informações do resultado
 * (009/FR-007 a FR-009; nó `SxRFw`).
 *
 * ## Espelha o `<dl>`, e a coincidência de classes é a promessa
 *
 * `grid gap-2 sm:grid-cols-2` são **as mesmas** classes do `<dl>` de resultado,
 * porque é o lugar dele que esta grade ocupa. Divergir aqui faria o cartão saltar
 * exatamente no instante em que o SC-004 exige que ele não salte.
 *
 * ## Uma tinta, e a distinção é dimensional
 *
 * O arquivo de design aparenta usar duas: `#252D3A` opaco no rótulo e branco a
 * 8% no valor. Resolvidas sobre `#161C25` elas dão **1,02:1 entre si** — não são
 * dois tons, são o mesmo tom escrito de duas maneiras. O que separa rótulo de
 * valor é altura e largura, e é isso que o FR-008 manda preservar.
 *
 * ## Larguras em fração, nunca em pixel
 *
 * 110 e 150 sobre uma coluna de ~228 são 48% e 66%. Fração preserva a relação em
 * qualquer largura; pixel fixo não sobrevive a 375px nem a 200% de zoom
 * (009/research §R4).
 */

/** Os quatro blocos do `<dl>`: nome, adicionados, ignorados, caminho. */
const BLOCOS = [0, 1, 2, 3] as const;

export function ResultSkeleton() {
  return (
    /*
      **`aria-hidden` na grade inteira** (FR-009). Ela não carrega informação
      nenhuma, e um leitor de tela que a alcançasse anunciaria oito caixas
      vazias. Não há nó focável dentro — são `<div>` sem controle —, então o
      atributo é suficiente e nada precisa de `tabIndex={-1}`.

      **No modo de cores forçadas as barras desaparecem**, e nenhum tratamento é
      acrescentado para trazê-las de volta (009/contracts/motion.md §6): elas são
      só preenchimento, o texto do cartão continua inteiro, e dar contorno a elas
      faria o esqueleto parecer conteúdo justamente para quem escolheu o modo que
      remove decoração.
    */
    <div aria-hidden className="grid gap-2 sm:grid-cols-2">
      {BLOCOS.map((indice) => (
        <div key={indice} className="flex flex-col gap-2">
          <PulsingBar className="bg-skeleton h-3 w-1/2 rounded-hair" />
          <PulsingBar className="bg-skeleton h-4 w-2/3 rounded-hair" />
        </div>
      ))}
    </div>
  );
}
