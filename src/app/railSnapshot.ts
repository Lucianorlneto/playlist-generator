import type { RailSnapshot } from '@/domain/rail';
import { isFinished } from '@/domain/run/machine';
import { runsInOrder } from '@/domain/run/queue';
import { useAppStore } from '@/store';

/**
 * O instantâneo que `composeRail` consome, lido da store uma vez só.
 *
 * **Existe porque há dois consumidores**: a trilha larga (`StepRail`) e o resumo
 * compacto (`StepSummary`), que são a mesma informação em duas larguras. Montar
 * o instantâneo em cada um deles é a duplicação que produz o caso em que a
 * trilha diz uma coisa e o resumo diz outra na mesma sessão — e foi exatamente
 * isso que aconteceu quando a 008 trocou a fonte dos destinos: o `StepRail` foi
 * corrigido e o `StepSummary` continuou lendo `queue.order`, sem que nada
 * falhasse até o `typecheck` reclamar de um campo novo.
 *
 * A leitura fica aqui, na camada de orquestração, e a **decisão** continua em
 * `src/domain/rail/` — este módulo não escolhe nada, só busca.
 */
export function useRailSnapshot(): RailSnapshot {
  const current = useAppStore((state) => state.step);
  const queue = useAppStore((state) => state.queue);
  const lines = useAppStore((state) => state.lines);
  const credentials = useAppStore((state) => state.credentials);
  const destinations = useAppStore((state) => state.destinations);

  return {
    current,
    /*
      **A seleção viva, e não `queue.order`** (008/FR-028, `data-model.md` §3).

      A `ExecutionQueue` só é construída por `buildQueue()`, ao sair da etapa
      Entrada — enquanto a etapa Destinos é a corrente, `queue.order` está
      vazia. Sob a regra da 007 isso era invisível, porque só degrau concluído
      derivava e a etapa Destinos concluída sempre vinha depois da fila
      construída. Com FR-028 a linha precisa derivar **com a etapa Destinos
      corrente**, e a fila ainda não existe nesse instante.

      Não é uma segunda fonte de ordem: `destinations.selected` já é mantido
      ordenado por `orderSelection`, pela mesma `PROVIDER_ORDER` de que
      `buildQueue` deriva.
    */
    destinations: destinations.selected,
    lineCount: lines.length,
    credentialsReady: Object.values(credentials).some((c) => c !== null),
    // Leitura da store, sem tocar no redutor: `isFinished` é `outcome !== null`.
    servicesFinished: runsInOrder(queue).filter(isFinished).length,
  };
}
