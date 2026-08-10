import { PROVIDER_ORDER } from '@/domain/providers';
import { ConnectionChip } from '@/features/connect/ConnectionChip';
import { ThemeControl } from '@/features/theme/ThemeControl';
import { t } from '@/i18n/pt-BR';
import { Icon } from '@/ui/Icon';

import { ResetFlow } from './ResetFlow';

/**
 * A barra superior permanente (FR-006, `contracts/shell.md` §2).
 *
 * Presente e **idêntica** em todas as etapas, na mesma posição. É o que responde
 * "estou conectado?" sem exigir navegação — a pergunta que, antes desta feature,
 * só tinha resposta dentro da etapa de Destinos.
 *
 * ## Um chip por provedor, sempre
 *
 * O `SessionHeader` que este componente absorve listava apenas os provedores
 * **selecionados e com credencial**. A restrição fazia sentido lá: o cabeçalho
 * era uma lista de contas, e listar um serviço sem credencial ofereceria um
 * botão que a aplicação não podia cumprir.
 *
 * Aqui a barra é o estado do produto, não uma lista de contas, e o estado
 * `no-credential` é justamente o que faltava. Cada chip continua tendo saída — a
 * sem credencial leva à Configuração —, então nenhuma das duas razões que
 * justificavam os filtros da 004 sobrevive à mudança de papel. O ganho é o que a
 * constituição chama de assimetria exposta: os dois serviços aparecem lado a
 * lado, com seus estados reais, em vez de um sumir quando está pior.
 *
 * ## Ordem de tabulação
 *
 * Marca (não focável) → chips → tema → recomeçar. É a ordem visual de leitura,
 * e a ordem no DOM é a mesma (FR-040). O `ThemeControl` continua contando como
 * **uma** parada de Tab: o padrão de `radiogroup` da 005 é preservado literalmente.
 */

export interface TopbarProps {
  /**
   * `true` abaixo do ponto de corte da casca. Nessa largura a trilha colapsa em
   * `StepSummary` e perde o rodapé, então a ação de recomeçar migra para cá
   * (FR-054). Ela nunca existe nos dois lugares ao mesmo tempo — seriam duas
   * paradas de tabulação para a mesma ação.
   */
  readonly narrow?: boolean;
}

export function Topbar({ narrow = false }: TopbarProps) {
  return (
    /*
      `min-h-topbar` e não `h-topbar`: a altura é a medida de projeto, mas em
      320px o conteúdo quebra em duas linhas e uma altura travada o cortaria.
      Crescer é a degradação certa — SC-007 proíbe rolagem horizontal, não
      proíbe a barra ficar mais alta.
    */
    <header className="border-rule bg-surface-zone zone-topbar flex shrink-0 flex-wrap items-center gap-3 border-b px-4 py-2">
      {/*
        A marca. `Logo Mark.png` é **arte**, não ícone de biblioteca: não herda
        `currentColor` e recebe tratamento por tema, porque foi composta contra o
        quase-preto e some sobre o off-white sem ele (FR-049, FR-060).

        O símbolo é decorativo — o nome do produto está escrito ao lado, e
        anunciar os dois faria o leitor ouvir a marca duas vezes.
      */}
      <div className="flex min-w-0 items-center gap-2">
        <Icon role="brand" className="brand-mark text-page" />
        <div className="flex min-w-0 flex-col">
          <span className="text-ink text-body font-bold">{t.app.title}</span>
          {/*
            A descrição colapsa abaixo do ponto de corte: é a primeira coisa a
            sair quando o espaço aperta, porque é a única que não carrega estado
            (`contracts/shell.md` §7).
          */}
          {!narrow && (
            <span className="text-ink-muted text-data truncate">{t.app.subtitle}</span>
          )}
        </div>
      </div>

      {/*
        `ml-auto` empurra o grupo da direita para a borda, e `min-w-0` em cada
        chip é o que faz um nome de conta longo truncar **dentro dele** em vez de
        empurrar o controle de tema para fora da barra (`contracts/shell.md` §2).

        Os chips **não** colapsam em largura estreita: eles são a razão de a
        barra existir. O que colapsa é a descrição da marca, acima.
      */}
      <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
        {PROVIDER_ORDER.map((provider) => (
          <ConnectionChip key={provider} provider={provider} />
        ))}

        {/*
          Divisor decorativo. `--rule-strong` e não `--rule`: é separação que
          carrega significado — de um lado o estado das contas, do outro os
          controles da aplicação —, e `--rule` dá 1,37:1, que é filete
          (`contracts/tokens.md` §1).

          **Some abaixo do ponto de corte.** Ali a barra quebra em várias linhas,
          e um divisor vertical entre grupos que deixaram de estar lado a lado
          vira um traço solto no fim de uma linha — separando nada de nada. Foi o
          que a conferência de fidelidade em 375px mostrou.
        */}
        <span aria-hidden="true" className="bg-rule-strong hidden h-6 w-px shrink-0 shell:block" />

        <ThemeControl />

        {/*
          A ação de recomeçar vive no rodapé da trilha em largura ampla. Abaixo
          do ponto de corte a trilha não é renderizada, e a ação migra para cá —
          **nunca nos dois lugares**, que seriam duas paradas de tabulação para
          a mesma ação (FR-054).
        */}
        {narrow && <ResetFlow />}
      </div>
    </header>
  );
}
