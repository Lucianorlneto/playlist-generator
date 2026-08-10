import { nameOf } from '@/features/credential/providerText';
import { format, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
import { Icon } from '@/ui/Icon';

/**
 * "Spotify — 1 de 2", no cabeçalho do cartão de fase (FR-018, 008/FR-013).
 *
 * Com um único destino não renderiza **nada** (invariante Q4). Exibir "1 de 1"
 * anunciaria uma fila que não existe e cobraria do usuário a atenção de conferir
 * um número que nunca muda.
 *
 * ## O que a feature 008 mudou: ele deixou de ser o elemento anunciado
 *
 * Este componente era `role="status"` no topo do `ServiceStep`, e era ele quem
 * anunciava a troca de serviço. Agora a posição é dita pela **linha de contexto**
 * (`StepContextLine`), que é texto real, aparece em todas as fases do ciclo e é
 * quem carrega a região viva.
 *
 * O que sobra aqui é a posição no cabeçalho dos cartões de orçamento e de
 * resultado, que o arquivo de design desenha (nós `v7c4o` em `TSwx6` e `EvlNu`
 * em `C13Hj`).
 *
 * ## Por que ele **não** é `aria-hidden`, contra o que o contrato previa
 *
 * `contracts/header-context.md` §5 mandava escondê-lo da árvore de
 * acessibilidade, supondo que a linha de contexto já dissesse a mesma coisa
 * alguns pixels acima. A implementação mostrou que **as duas nunca se
 * sobrepõem**: o cabeçalho de cartão só existe nas fases de orçamento, criação e
 * conclusão, e é exatamente nessas que a linha de contexto troca a posição pelo
 * sufixo da fase — "YouTube · Conferindo o orçamento", "Spotify · Concluído".
 *
 * Esconder aqui não removeria uma duplicata: deixaria a posição **sem anúncio
 * nenhum** naquelas telas, que é a primeira metade de FR-013 quebrada para
 * fechar a segunda.
 *
 * O que ele deixou de ser é **região viva**. `role="status"` e `aria-label`
 * saíram: quem anuncia troca de serviço é o `StepContextLine`, e uma segunda
 * região viva competiria com ele nas fases em que ambos existem. Aqui a posição
 * é texto comum, lido na ordem em que aparece (008/research §R2).
 */
export function QueueIndicator() {
  const queue = useAppStore((state) => state.queue);

  if (queue.order.length <= 1) return null;

  const provider = queue.order[queue.currentIndex];
  if (provider === undefined) return null;

  return (
    <p className="text-ink-muted text-data flex items-center gap-2">
      {/*
        O papel `queue` — `list-ordered` no arquivo de design, onde ele encabeça
        o painel "Ordem de execução". Decorativo: a posição está escrita ao lado,
        e o ícone é reforço, não portador (FR-042, FR-059).
      */}
      <Icon role="queue" />
      {format(t.queue.position, {
        service: nameOf(provider),
        current: queue.currentIndex + 1,
        total: queue.order.length,
      })}
    </p>
  );
}
