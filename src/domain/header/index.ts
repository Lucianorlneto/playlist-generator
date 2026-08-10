/**
 * A linha de contexto do cabeçalho — regra, não apresentação (Princípio III).
 *
 * `src/app/StepContextLine.tsx` desenha o que este módulo devolve e não decide
 * nada. A decisão é uma tabela de dez linhas com três formas de saída e duas
 * condições de degradação, e o formato em que ela estava errada até aqui é
 * exatamente aquele em que ela ficaria se ninguém perguntasse: um `switch`
 * dentro do componente. O `Greeting` da 007 exibia "Olá, {nome completo}" nas
 * cinco etapas, e **ninguém notou porque não havia nada que pudesse falhar**.
 *
 * Puro: sem DOM, sem store, sem I/O, sem relógio, sem aleatoriedade. A entrada é
 * um instantâneo do estado; a saída é uma união discriminada.
 * `tests/unit/header-context.spec.ts` percorre a tabela inteira sem renderizar
 * nada.
 *
 * ## As duas ausências são normativas
 *
 * Configuração e Resumo **não têm linha de contexto** (nós `Sim0L` e `w1fTC`, que
 * não contêm nó `Greeting`). Elas são tão parte da tabela quanto as etapas em que
 * a linha existe: um teste que só verificasse presença passaria com o defeito
 * intacto, e é por isso que `absent` é uma forma da união e não a ausência de
 * retorno.
 *
 * ## Sobre importar o dicionário aqui
 *
 * `@/i18n/pt-BR` é um objeto congelado de strings — um módulo de dados. O que o
 * Princípio III isola é **I/O**, e não há nenhum. A dependência é de mão única e
 * já estabelecida por `src/domain/rail/`, pelo mesmo motivo: devolver descritores
 * e formatá-los no componente espalharia pela apresentação exatamente a decisão
 * que este módulo existe para concentrar.
 */

import { format, t } from '@/i18n/pt-BR';

import type { ProviderId } from '../providers';
import type { RunPhase, WizardStep } from '../types';

/** O instantâneo de que a linha depende — e nada além dele. */
export interface HeaderSnapshot {
  readonly step: WizardStep;
  /** Fase da execução corrente. `null` fora da etapa `service`. */
  readonly phase: RunPhase | null;
  /** Provedor da execução corrente. `null` fora da etapa `service`. */
  readonly provider: ProviderId | null;
  /** Posição 1-based do provedor corrente na fila. */
  readonly position: number;
  /** Tamanho da fila. `1` omite a posição (FR-012). */
  readonly total: number;
  /**
   * Nome de exibição da conta conectada, na ordem fixa do produto. `null`
   * quando não há sessão nenhuma ou quando o nome é vazio (FR-011).
   */
  readonly displayName: string | null;
}

/**
 * As três formas da linha.
 *
 * `greeting` devolve o primeiro nome **separado** do complemento porque os dois
 * têm tintas diferentes — o nome em `--accent-text`, o complemento em
 * `--ink-muted` (FR-010). Juntá-los numa string obrigaria o componente a
 * recortá-la de volta, que é a decisão voltando para onde ela não deve estar.
 */
export type HeaderContext =
  | { readonly kind: 'absent' }
  | {
      readonly kind: 'greeting';
      readonly firstName: string | null;
      readonly complement: string;
    }
  | { readonly kind: 'service'; readonly text: string };

/**
 * O primeiro termo do nome de exibição (H4, FR-010).
 *
 * Nome de um termo só **é** o próprio primeiro nome. Espaços em excesso, nome
 * vazio e nome só de espaços degradam para `null` — nunca para uma string vazia,
 * que produziria "Oi, " com uma vírgula pendurada (FR-011).
 */
function firstNameOf(displayName: string | null): string | null {
  if (displayName === null) return null;
  const termos = displayName.trim().split(/\s+/u).filter((termo) => termo !== '');
  return termos[0] ?? null;
}

/**
 * A posição na fila, ou apenas o nome do serviço (H6, FR-012).
 *
 * Com um único destino a fila não existe, e "Spotify — 1 de 1" cobraria do
 * usuário a atenção de conferir um número que nunca muda. É a mesma regra que o
 * `QueueIndicator` já aplicava, agora num lugar em que ela é testável sem DOM.
 */
function positionText(snapshot: HeaderSnapshot, service: string): string {
  if (snapshot.total <= 1) return service;
  return format(t.queue.position, {
    service,
    current: snapshot.position,
    total: snapshot.total,
  });
}

/**
 * A metade `service` da tabela (H3, H7).
 *
 * O mapeamento é **total** — nenhuma fase de `RunPhase` fica sem linha. A
 * exaustividade é garantida pelo compilador: o `switch` devolve em todos os
 * ramos e o tipo de retorno não admite `undefined`, então uma fase nova quebra
 * o `typecheck` em vez de produzir uma linha vazia na tela.
 *
 * `creating` recebe a linha de conclusão porque é a tela `SjphR` do arquivo —
 * "Criando playlist no Spotify…" — e ali o slot já mostra "Spotify · Concluído".
 * A leitura é que a linha nomeia **o cartão em que se está**, não o instante
 * exato da operação (`contracts/header-context.md` §2).
 *
 * `skipped` e `failed` são a única divergência deliberada em relação àquela
 * tabela, que as agrupa em "execução com desfecho → · Concluído". Dizer
 * "Concluído" de um serviço que foi pulado ou que falhou é afirmar o que não
 * aconteceu — o que FR-029 proíbe literalmente na trilha, e pelo mesmo motivo
 * aqui. Os rótulos vêm de `t.queue.phase`, que já os nomeia com honestidade.
 */
function serviceText(snapshot: HeaderSnapshot, service: string): string {
  const phase = snapshot.phase;
  if (phase === null) return positionText(snapshot, service);

  switch (phase) {
    case 'pending':
    case 'connect':
    case 'awaiting_reauth':
    case 'search':
    case 'review':
      return positionText(snapshot, service);

    case 'estimate':
      return format(t.header.serviceSuffix, { service, suffix: t.queue.phase.estimate });

    case 'creating':
    case 'done':
      return format(t.header.serviceSuffix, { service, suffix: t.queue.phase.done });

    case 'skipped':
      return format(t.header.serviceSuffix, { service, suffix: t.queue.phase.skipped });

    case 'failed':
      return format(t.header.serviceSuffix, { service, suffix: t.queue.phase.failed });
  }
}

/** O complemento da saudação, por etapa (H2). */
const GREETING_COMPLEMENT: Partial<Record<WizardStep, string>> = {
  destinations: t.header.destinationsComplement,
  input: t.header.inputComplement,
};

/**
 * A tabela inteira, como função (FR-009 a FR-013).
 *
 * O detalhe normativo, incluindo o nó do arquivo de design que produz cada
 * linha, está em `specs/008-design-fidelity-pass/contracts/header-context.md`.
 */
export function headerContext(snapshot: HeaderSnapshot): HeaderContext {
  switch (snapshot.step) {
    // H1 — as duas ausências. Normativas, e verificadas como ausência.
    case 'credential':
    case 'summary':
      return { kind: 'absent' };

    // H2 — saudação pessoal, com o complemento da etapa.
    case 'destinations':
    case 'input': {
      const complement = GREETING_COMPLEMENT[snapshot.step] ?? '';
      return { kind: 'greeting', firstName: firstNameOf(snapshot.displayName), complement };
    }

    // H3 e H7 — contexto de serviço, **nunca** saudação, em nenhuma fase.
    case 'service': {
      // Sem provedor corrente não há serviço a nomear. Acontece entre a saída de
      // uma execução e a entrada da seguinte, e a linha some em vez de exibir um
      // travessão solto — a mesma disciplina de FR-011.
      if (snapshot.provider === null) return { kind: 'absent' };
      const service = t.providers[snapshot.provider].name;
      return { kind: 'service', text: serviceText(snapshot, service) };
    }
  }
}
