import { PROVIDER_ORDER } from '@/domain/providers';
import { nameOf } from '@/features/credential/providerText';
import { format, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
import { Button } from '@/ui/Button';
import { cx } from '@/ui/cx';
import { Icon } from '@/ui/Icon';

/**
 * Mapas explícitos de literais, nunca concatenação: o scanner do Tailwind lê o
 * código como texto e não resolve expressão (`tp/no-dynamic-classname`).
 */
const PROVIDER_ICON = {
  spotify: 'provider-spotify',
  youtube: 'provider-youtube',
} as const;

/**
 * A cor de marca como **acento identificador** (FR-023).
 *
 * Entra por `text-*`, que tinge o glifo — o ícone herda `currentColor`. Nunca
 * por `bg-*` **em cheia saturação**: preenchimento sólido significa acionável
 * neste sistema (FR-024), e um cartão pintado de verde Spotify diria "clique
 * aqui" em vez de "este é o Spotify". A regra de lint `tp/no-raw-visual-values`
 * recusa `bg-brand-spotify` e `bg-brand-youtube` em toda parte, inclusive aqui.
 *
 * O que a 008 abriu foi outra coisa, com outro nome: `BRAND_TINT`, logo abaixo.
 */
const BRAND_INK = {
  spotify: 'text-brand-spotify',
  youtube: 'text-brand-youtube',
} as const;

/**
 * O substrato de identidade do distintivo (008/FR-003, 008/FR-004).
 *
 * **Este arquivo é o único do projeto autorizado a usar estes dois utilitários**,
 * e a autorização é uma allowlist de arquivo em `eslint-rules/index.js`, não um
 * limiar de opacidade. O motivo de a exceção ser nomeada em vez de numérica está
 * no Complexity Tracking do plano: um limiar é alegável por qualquer tela nova
 * sem passar por revisão, e a regra deixaria de ser fechadura para virar
 * argumento.
 *
 * Os dois pares — glifo da marca sobre o seu próprio substrato tingido — são
 * medidos nos dois temas por `tests/unit/contrast.spec.ts`. Ícone verde sobre
 * fundo esverdeado é o caso em que a intuição erra, e presumir que 12% "não muda
 * nada" seria exatamente a decisão a olho que esta feature existe para desfazer.
 */
const BRAND_TINT = {
  spotify: 'bg-brand-tint-spotify',
  youtube: 'bg-brand-tint-youtube',
} as const;

/**
 * Seletor de múltipla escolha dos destinos (FR-008 a FR-010).
 *
 * Duas exigências que a implementação carrega literalmente:
 *
 * - **o motivo do bloqueio é escrito**, não deduzido de um controle apagado
 *   (FR-009). "Sem Client ID de X cadastrado" diz o que fazer; um `disabled` sem
 *   texto não diz nada;
 * - **há atalho para resolver** — o botão volta à configuração, em vez de exigir
 *   que o usuário encontre o caminho sozinho.
 *
 * A ordem vem de `PROVIDER_ORDER`, nunca desta tela (invariante P1).
 */
/**
 * A marca de verificação **visível** (008/FR-023, FR-025; nó `T8lli`).
 *
 * O controle real continua sendo o `<input type="checkbox">`, escondido com
 * `sr-only`: ele permanece focável, na ordem de tabulação, com estado anunciado
 * e comportamento de formulário. Este `<span>` é irmão dele e reage por
 * `peer-*` — `peer-checked:` para o estado preenchido, `peer-focus-visible:`
 * para o anel de foco, `peer-disabled:` para o esmaecimento.
 *
 * **Por que não `appearance-none` no próprio input**: funciona para o quadrado,
 * mas não permite pôr o glifo de verificação dentro dele sem `background-image`
 * — que seria valor visual literal, recusado por FR-035 (008/research §R10).
 *
 * Escrito como literal completo, e não montado por interpolação, porque o
 * scanner do Tailwind lê o código como texto (`tp/no-dynamic-classname`).
 */
const CHECKMARK =
  'rounded-control ml-auto flex size-6 shrink-0 items-center justify-center border ' +
  'border-rule-strong bg-transparent text-transparent ' +
  'peer-checked:border-accent-text peer-checked:bg-accent peer-checked:text-accent-ink ' +
  'peer-focus-visible:outline-accent-text peer-focus-visible:outline-2 ' +
  'peer-focus-visible:outline-offset-2 peer-disabled:opacity-60';

export function DestinationSelector() {
  const credentials = useAppStore((state) => state.credentials);
  const sessions = useAppStore((state) => state.sessions);
  const destinations = useAppStore((state) => state.destinations);
  const toggle = useAppStore((state) => state.toggleDestination);
  const goToStep = useAppStore((state) => state.goToStep);

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-ink text-body font-bold">{t.destinations.groupLabel}</legend>

      {PROVIDER_ORDER.map((provider) => {
        const service = nameOf(provider);
        const available = credentials[provider] !== null;
        const account = sessions[provider]?.user.displayName ?? null;
        const checked = destinations.selected.includes(provider);
        const disabled = !available || destinations.locked;
        const reasonId = `destino-motivo-${provider}`;
        const labelId = `destino-rotulo-${provider}`;

        return (
          /*
            **A anatomia do cartão de destino** (008/FR-021 a FR-025; componente
            `j8rruy — Destination Card` do arquivo de design).

            ```text
            ┌──────────────────────────────────────────────┐
            │  ┌────┐   Criar no Spotify              ┌───┐│
            │  │ ◉  │   Conectado como Fulano         │ ✓ ││
            │  └────┘                                 └───┘│
            └──────────────────────────────────────────────┘
               distintivo   rótulo + linha secundária  controle
            ```

            `--radius-panel` porque é a superfície mais alta desta tela.

            **O cartão selecionado ganha contorno de acento _e_ substrato
            `--accent-tint`** (FR-024), contra contorno `--rule` e `--surface` no
            não selecionado — que é o que o arquivo desenha (`j8rruy` contra
            `KAJYs`). A 007 distinguia só por contorno, com o receio de que
            preencher o faria parecer o botão da tela; o tingimento a 12–15%
            resolve isso sem ambiguidade, porque o botão é âmbar **cheio**.

            **O cartão inteiro é o alvo, e mesmo assim não é o `<label>`.**

            Envolver o cartão num `<label>` daria o alvo grande de graça e custa
            caro em duas frentes: o nome acessível do controle passaria a ser
            tudo que há dentro — "Criar no Spotify A autorização acontece ao
            executar o Spotify" —, variando com o estado da conta, e o atalho
            "Cadastrar Client ID de {serviço}" viraria um `<button>` dentro de um
            `<label>`, que o HTML proíbe e cujo clique acionaria as duas coisas.

            A solução é um `<label>` **vazio** em camada absoluta cobrindo o
            cartão (`Alvo do cartão`, logo abaixo): ele entrega a área inteira ao
            ponteiro sem contribuir uma palavra para o nome, que vem do
            `aria-labelledby` apontado ao título. O único filho que precisa ficar
            acima dessa camada é o atalho — os demais são texto e decoração, e
            clicá-los deve marcar o destino.
          */
          <div
            key={provider}
            data-destino={provider}
            className={cx(
              'rounded-panel relative flex items-center gap-3 border p-4',
              checked ? 'border-accent-text bg-accent-tint' : 'border-rule bg-surface',
              disabled ? 'opacity-60' : null,
            )}
          >
            {/*
              O controle real. `sr-only` esconde **visualmente**, não
              semanticamente: ele continua sendo o que o teclado alcança e o que
              o leitor de tela anuncia. `peer` é o que permite à marca de
              verificação ao lado reagir ao estado dele.

              O nome vem de `aria-labelledby`, e não do `<label>` que cobre o
              cartão: aquele é área de clique e não texto, e um controle cujo
              nome dependesse dele ficaria sem nome nenhum.
            */}
            <input
              type="checkbox"
              id={`destino-${provider}`}
              checked={checked}
              disabled={disabled}
              aria-labelledby={labelId}
              aria-describedby={available ? undefined : reasonId}
              className="peer sr-only"
              onChange={() => {
                toggle(provider);
              }}
            />

            {/*
              **O alvo do cartão** (FR-025). Vazio de propósito: `<label for>` é
              o único elemento que transfere clique a um controle sem uma linha
              de JavaScript, sem `role`, sem `tabindex` e sem duplicar o estado.

              Cobre o cartão inteiro e fica **abaixo** de tudo no empilhamento —
              é o primeiro filho posicionado, e qualquer irmão posicionado depois
              o cobre. É assim que o atalho de credencial continua clicável: ele
              recebe `relative` e passa a ficar por cima.

              `cursor-default` quando desabilitado: o cartão não responde, e um
              ponteiro de mão prometeria que responde.
            */}
            <label
              htmlFor={`destino-${provider}`}
              className={cx(
                'rounded-panel absolute inset-0',
                disabled ? 'cursor-default' : 'cursor-pointer',
              )}
            />

            {/*
              **O distintivo do provedor** (008/FR-001, FR-003; nó `kl8Rc`).

              Quadrado arredondado com substrato tingido pela cor do serviço e o
              glifo na cor cheia. É a única marca de identidade que o design dá
              ao cartão, e sem ela FR-003 fica sem como ser cumprido.

              Decorativo: o nome do serviço está escrito no rótulo ao lado, e a
              cor **nunca** é o único portador (FR-005, 007/FR-042). Sob cores
              forçadas o substrato desaparece e o cartão continua dizendo qual
              serviço é.
            */}
            <span
              aria-hidden="true"
              className={cx(
                'rounded-card flex size-8 shrink-0 items-center justify-center',
                BRAND_TINT[provider],
              )}
            >
              <Icon
                role={PROVIDER_ICON[provider]}
                className={cx('text-section', BRAND_INK[provider])}
              />
            </span>

            <span className="flex min-w-0 flex-col">
              {/*
                O título **nomeia** o controle, por `aria-labelledby`. Deixou de
                ser um `<label for>` porque o cartão inteiro passou a sê-lo, e
                dois `<label>` para a mesma caixa concatenam o nome e disparam
                `form-field-multiple-labels` no axe.
              */}
              <span id={labelId} className="text-ink text-section min-w-0">
                {format(t.destinations.selectLabel, { service })}
              </span>

              {/*
                **A linha secundária, nos três estados** (FR-021, FR-021a).

                Os três ocupam a **mesma faixa**, e é isso que faz o cartão não
                pular quando a sessão é obtida. O bloco de motivo mais atalho que
                antes aparecia e sumia deixou de ser um segundo bloco: ele passou
                a ocupar esta linha, em vez de ser altura reservada e vazia
                — reservar espaço sem escrever nada é o mesmo buraco que FR-011
                recusa na saudação (008/research §R10).

                O que cada estado escreve:

                - **sessão ativa** — nomeia a conta conectada;
                - **credencial sem sessão** — diz *quando* a autorização
                  acontece, em vez de deixar o usuário supondo que ela já deveria
                  ter acontecido;
                - **sem credencial** — o motivo do bloqueio, com o atalho.
              */}
              <span className="text-ink-muted text-data flex flex-wrap items-center gap-2">
                {!available ? (
                  <>
                    {/*
                      O `id` fica no **motivo**, não na faixa inteira. Pô-lo na
                      faixa faria `aria-describedby` arrastar junto o rótulo do
                      botão, e a descrição do controle viraria "Sem Client ID de
                      YouTube cadastrado.Cadastrar Client ID de YouTube" — a ação
                      lida como se fosse parte da explicação.
                    */}
                    <span id={reasonId}>
                      {format(t.destinations.unavailableReason, { service })}
                    </span>
                    {/*
                      `relative` põe o atalho **acima** da camada de clique do
                      cartão. Sem isso o `<label>` engoliria o botão: o ponteiro
                      marcaria o destino em vez de ir para a configuração — e
                      justamente no estado em que o destino nem pode ser
                      marcado.
                    */}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="relative"
                      onClick={() => {
                        goToStep('credential');
                      }}
                    >
                      {format(t.destinations.unavailableAction, { service })}
                    </Button>
                  </>
                ) : account === null ? (
                  format(t.destinations.accountPendingAuth, { service })
                ) : (
                  format(t.destinations.accountConnected, { account })
                )}
              </span>
            </span>

            {/*
              A marca de verificação, **último filho do cartão** (FR-023). É
              `aria-hidden` porque o estado já é anunciado pelo controle real: um
              segundo portador do mesmo estado faria o leitor de tela ouvir
              "marcado" duas vezes por cartão.
            */}
            <span aria-hidden="true" className={CHECKMARK}>
              <Icon role="done" />
            </span>
          </div>
        );
      })}

      {destinations.locked && <p className="field-message">{t.destinations.lockedNotice}</p>}
    </fieldset>
  );
}
