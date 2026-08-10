import { headerContext, type HeaderContext } from '@/domain/header';
import { PROVIDER_ORDER } from '@/domain/providers';
import { format, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';

/**
 * A linha acima do título da etapa (008/FR-009 a FR-013).
 *
 * **Substitui `Greeting.tsx`**, que exibia "Olá, {nome completo}" em tinta
 * secundária nas cinco etapas. Três coisas estavam erradas ao mesmo tempo — o
 * texto, a tinta e o alcance — e nenhuma delas falhava em lugar nenhum.
 *
 * Este componente **não decide nada**: `src/domain/header/` devolve a forma e o
 * texto, e aqui só se escolhe como desenhar cada forma. Ver
 * `contracts/header-context.md`.
 *
 * ## A região viva, e por que ela só existe na forma `service`
 *
 * `role="status"` vai **apenas** na forma de serviço. É ela que muda quando o
 * serviço corrente troca **sem transição de etapa** — o único momento em que
 * algo muda na tela sem que o foco se mova —, e é isso que precisa ser
 * anunciado. Uma saudação anunciada a cada troca de etapa seria ruído, não
 * informação, e concorreria com o anúncio do próprio título, que já recebe foco.
 *
 * Cada forma renderiza um elemento próprio com `key` distinta. Sem isso o React
 * reaproveitaria o nó ao trocar de forma, e **região viva reaproveitada não
 * dispara anúncio**: o leitor de tela observa mutações dentro de uma região que
 * já existia, e a região precisa ser criada para que o texto conte como novo.
 *
 * ## A degradação não deixa buraco nem vírgula solta (FR-011)
 *
 * Sem conta conectada, `firstName` é `null` e a linha exibe **só** o
 * complemento. Não há "Oi, " pendurado, não há espaço duplo, e não há altura
 * reservada e vazia — o complemento é uma frase completa e ocupa a mesma faixa.
 */

/** Corpo tipográfico da linha: o degrau abaixo da descrição da etapa. */
const LINE = 'text-meta flex flex-wrap items-baseline gap-1';

/**
 * As duas formas que **desenham** alguma coisa.
 *
 * `absent` fica de fora do tipo, e não é um ramo com `return null` aqui, porque
 * a ausência já foi decidida pelo chamador: é ela que determina se existe
 * elemento e `key`, e escondê-la dentro deste componente faria a região viva ser
 * criada mesmo quando não há linha nenhuma.
 */
type FormaVisivel = Exclude<HeaderContext, { readonly kind: 'absent' }>;

function Conteudo({ context }: { readonly context: FormaVisivel }) {
  if (context.kind === 'greeting') {
    return (
      <>
        {/*
          O nome em `--accent-text`, o complemento em `--ink-muted` (FR-010).

          O arquivo desenha o nome em `--accent` cheio; aqui ele é
          `--accent-text` porque em tema claro o âmbar cheio dá 1,73:1 como texto
          e é preenchimento, nunca tinta — decisão da 007, imposta por
          `tp/no-raw-visual-values`. No tema escuro os dois tokens têm o mesmo
          valor, então a tela escura fica idêntica ao arquivo.
        */}
        {context.firstName !== null && (
          <span className="text-accent-text font-semibold">
            {format(t.header.greeting, { name: context.firstName })}
          </span>
        )}
        <span className="text-ink-muted">{context.complement}</span>
      </>
    );
  }

  return <span className="text-ink-muted">{context.text}</span>;
}

export function StepContextLine() {
  const step = useAppStore((state) => state.step);
  const queue = useAppStore((state) => state.queue);
  const sessions = useAppStore((state) => state.sessions);

  const provider = queue.order[queue.currentIndex] ?? null;

  /*
    O nome vem da sessão que a aplicação já possui, na ordem fixa do produto:
    com dois serviços conectados, o primeiro da `PROVIDER_ORDER` decide. É o
    mesmo identificador que o chip de conexão exibe, e **nada novo é coletado**.
  */
  const comSessao = PROVIDER_ORDER.find((id) => sessions[id] !== null);
  const displayName =
    comSessao === undefined ? null : (sessions[comSessao]?.user.displayName ?? null);

  const context = headerContext({
    step,
    phase: provider === null ? null : (queue.runs[provider]?.phase ?? null),
    provider,
    position: queue.currentIndex + 1,
    total: queue.order.length,
    displayName,
  });

  // A ausência é uma decisão, e ela se desenha não desenhando nada. Nenhuma
  // altura reservada: o arquivo não põe a linha em Configuração nem em Resumo,
  // e um espaço vazio no lugar dela seria o buraco que FR-011 recusa.
  if (context.kind === 'absent') return null;

  /*
    A `key` por forma é o que faz a região viva ser **criada** em vez de
    reaproveitada. Sem ela, sair de `greeting` para `service` mutaria o texto
    dentro de um nó que já existia e o anúncio não dispararia.
  */
  return (
    <p
      key={context.kind}
      className={LINE}
      {...(context.kind === 'service' ? { role: 'status' } : {})}
    >
      <Conteudo context={context} />
    </p>
  );
}
