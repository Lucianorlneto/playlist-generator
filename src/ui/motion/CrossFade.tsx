import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

import type { ReactNode } from 'react';

/**
 * O orçamento de 200ms, o mesmo que o guia de estilo já fixa para o conector da
 * trilha (009/FR-010a). O sistema tem um tempo de transição, não vários.
 */
const FUSAO = { duration: 0.2 } as const;

export interface CrossFadeProps {
  /** O bloco que **sai**. Fica fora do fluxo assim que `to` existe. */
  readonly from: ReactNode | null;
  /** O bloco que **entra**. É ele que define a altura, do primeiro quadro ao último. */
  readonly to: ReactNode | null;
}

/**
 * Fusão cruzada entre dois blocos que dividem a mesma célula
 * (009/FR-010a, 009/contracts/motion.md §2.3).
 *
 * ## Por que o que sai fica fora do fluxo
 *
 * As duas alternativas óbvias falham (009/research §R7):
 *
 * - **Empilhar os dois na mesma célula de grade** faz a altura ser a do maior
 *   durante os 200ms. O caminho efetivo da playlist quebra em duas linhas quando
 *   é longo, então a altura saltaria — e voltaria — dentro da transição.
 * - **`AnimatePresence mode="wait"`** espera a saída terminar antes de montar a
 *   entrada, produzindo 200ms de cartão vazio. É o mesmo salto que o SC-004
 *   proíbe, só que em duas etapas.
 *
 * Com o bloco que sai em `position: absolute`, a altura do contêiner é sempre a
 * do conteúdo real. E `opacity` não dispara recálculo de layout (FR-017a).
 *
 * ## Por que o `absolute` mora no envoltório, e não no nó que anima
 *
 * `AnimatePresence` mantém o filho removido em cena com **as propriedades que
 * ele tinha quando saiu** — e `from` e `to` trocam no mesmo render. Se a classe
 * dependesse do nó que anima, o bloco que sai congelaria em fluxo e a célula
 * teria as duas alturas somadas durante a transição. O envoltório é nosso e
 * re-renderiza a cada passada, então ele já está absoluto quando a saída começa.
 *
 * ## Os dois slots são anuláveis
 *
 * Com os dois nulos o componente devolve `null`, e não uma caixa vazia: sem
 * isso o `gap-4` da seção criaria um respiro fantasma no estado de erro de
 * escrita, onde não há nem esqueleto nem informações
 * (009/contracts/loading-card.md §5.1.2).
 */
export function CrossFade({ from, to }: CrossFadeProps) {
  const reduzido = useReducedMotion();

  if (from === null && to === null) return null;

  /*
    Sob movimento reduzido a troca acontece em **um quadro**: nenhum estado
    intermediário, nenhuma sobreposição, nenhum `AnimatePresence` a orquestrar.
    `to ?? from` é o estado final de cada momento — o conteúdo real assim que
    ele existe, o esqueleto antes disso.
  */
  if (reduzido === true) return <div className="relative">{to ?? from}</div>;

  return (
    <div className="relative">
      {/* O que entra define a altura, e por isso fica no fluxo. */}
      <AnimatePresence initial={false}>
        {to !== null && (
          <motion.div
            key="to"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={FUSAO}
          >
            {to}
          </motion.div>
        )}
      </AnimatePresence>

      {/*
        `initial={false}` nos dois: montar já com o conteúdo real — voltar a um
        serviço concluído, por exemplo — não é uma troca, e não deve animar. A
        fusão só existe quando um substitui o outro em cena.
      */}
      <div className={to !== null ? 'absolute inset-x-0 top-0' : 'block'}>
        <AnimatePresence initial={false}>
          {from !== null && (
            <motion.div
              key="from"
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={FUSAO}
            >
              {from}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
