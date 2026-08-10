import { t } from '@/i18n/pt-BR';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';

/**
 * A faixa de ações no rodapé do conteúdo (FR-016 a FR-019).
 *
 * **Existe em Configuração, Destinos e Entrada, e a lista é fechada** — quem
 * decide é o `Shell`, num único ponto do código. As duas etapas restantes mantêm
 * as ações dentro do cartão que as explica (FR-061), e "Pular o {serviço}"
 * continua adjacente ao cartão da fase (FR-062). Redesenhar sim; realocar não.
 *
 * ## O motivo do bloqueio é dito por escrito
 *
 * É a razão de a faixa existir. Antes desta feature, as duas etapas em que o
 * usuário pode ficar preso — sem destino escolhido, sem lista colada —
 * apagavam o botão de avançar e escreviam a explicação **abaixo** dele, num
 * parágrafo de apoio que competia com o resto da tela. A faixa põe estado e ação
 * lado a lado: o texto que diz por que não dá para avançar fica onde o olho vai
 * quando procura o botão.
 *
 * A indisponibilidade é perceptível **sem cor** (FR-018): o botão fica
 * desabilitado — estado que o navegador anuncia e que o teclado respeita —, e o
 * motivo está escrito à esquerda, com ícone e prefixo. Nenhuma das três pistas é
 * a saturação de um pixel.
 *
 * ## Avançar é a única ação primária
 *
 * FR-017. O retorno é discreto de propósito: uma segunda ação preenchida na
 * mesma faixa faria as duas competirem, e a que perde é sempre a que o fluxo
 * quer. Preenchimento sólido significa acionável **e principal** neste sistema.
 */

export interface ActionBarProps {
  /**
   * O estado da etapa por extenso — "2 destinos selecionados", "40 linhas".
   * Aparece à esquerda, e é a informação que o usuário precisa para decidir se
   * está pronto para avançar.
   */
  readonly state: string;
  /**
   * Por que o avanço não é possível agora. `null` quando ele é possível.
   *
   * Presente **implica** avanço desabilitado: são o mesmo fato dito de dois
   * jeitos, e separá-los em duas propriedades permitiria o estado incoerente de
   * um botão apagado sem explicação — que é exatamente o que esta faixa existe
   * para eliminar.
   */
  readonly blockedReason?: string | null;
  readonly advanceLabel: string;
  readonly onAdvance: () => void;
  /**
   * Ação de retorno. **Ausente na primeira etapa** (FR-019): um botão "Voltar"
   * que não volta para lugar nenhum é pior que nenhum botão — promete uma saída
   * e não a cumpre.
   */
  readonly onBack?: (() => void) | undefined;
  readonly backLabel?: string;
  /**
   * Uma ação já está em curso.
   *
   * Diferente de `blockedReason`: ali o usuário precisa **fazer** algo, aqui só
   * precisa esperar. Os dois desabilitam o avanço, mas dizem coisas diferentes,
   * e tratá-los como o mesmo estado faria a faixa acusar o usuário de não ter
   * feito nada quando o aplicativo é que está ocupado.
   */
  readonly busy?: boolean;
}

export function ActionBar({
  state,
  blockedReason = null,
  advanceLabel,
  onAdvance,
  onBack,
  backLabel = t.actionBar.back,
  busy = false,
}: ActionBarProps) {
  const blocked = blockedReason !== null && blockedReason !== undefined;

  /*
    `--surface-zone`, o mesmo substrato da barra superior e da trilha (nó
    `XgqFh`, `#12171F`). Não é uniformidade por gosto: as três são zonas fixas da
    casca, e o degrau de luminosidade que as separa do conteúdo é o que faz
    "isto emoldura, aquilo é o trabalho" ser legível sem filete.

    A goteira lateral acompanha a da área de conteúdo — 48 px no arquivo — para o
    estado à esquerda nascer alinhado com o título da etapa e o botão primário
    com a borda direita do painel lateral.

    `shrink-0` porque a faixa é irmã do contêiner que rola: sem ela, um conteúdo
    alto a espremeria em vez de rolar por dentro.
  */
  return (
    <div
      role="group"
      aria-label={t.actionBar.label}
      className="border-rule bg-surface-zone flex shrink-0 flex-wrap items-center justify-between gap-4 border-t px-4 py-4 shell:px-12"
    >
      {/*
        O estado à esquerda. Quando há bloqueio, o motivo **substitui** o estado
        em vez de acompanhá-lo: a pergunta que o usuário tem naquele momento é
        "por que não posso avançar?", e responder outra coisa antes seria ruído.

        `role="status"` faz a mudança ser anunciada sem roubar o foco — passar de
        "nenhum destino" para "2 destinos selecionados" é informação que quem usa
        leitor de tela precisa receber sem ir procurar.
      */}
      <p role="status" className="text-ink-muted text-meta flex min-w-0 items-center gap-2">
        {blocked ? (
          <>
            <Icon role="hint" className="text-state-uncertain" />
            <span className="min-w-0">
              <span className="font-semibold">{t.actionBar.blockedPrefix}</span> {blockedReason}
            </span>
          </>
        ) : busy ? (
          <>
            <Icon role="loading" className="text-ink-muted" />
            <span className="min-w-0">{t.common.loading}</span>
          </>
        ) : (
          <>
            <Icon role="status-ok" className="text-state-confident" />
            <span className="min-w-0">{state}</span>
          </>
        )}
      </p>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {onBack !== undefined && (
          <Button variant="ghost" onClick={onBack}>
            <Icon role="back" />
            {backLabel}
          </Button>
        )}
        <Button variant="primary" disabled={blocked || busy} onClick={onAdvance}>
          {advanceLabel}
          <Icon role="advance" />
        </Button>
      </div>
    </div>
  );
}
