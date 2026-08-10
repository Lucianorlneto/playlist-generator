import type { ProviderId } from '@/domain/providers';
import { nameOf } from '@/features/credential/providerText';
import { format, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
import { Icon } from '@/ui/Icon';
import { cx } from '@/ui/cx';

import { useAuthorize } from './useAuthorize';

/**
 * O vínculo com um provedor, permanente na barra superior (FR-007 a FR-009).
 *
 * Absorve o `SessionHeader` da feature 004. Manter os dois significaria a mesma
 * informação em dois lugares, com estados que podem divergir — e o chip cobre
 * tudo que o cabeçalho mostrava, mais o estado que faltava: **sem credencial**.
 *
 * O defeito que a 004 fechou continua fechado aqui, e é o motivo de o chip
 * existir em todas as etapas: a lista era "provedores com sessão ativa", e o
 * serviço sumia do cabeçalho no exato instante em que a sessão caía — levando
 * junto o seu único ponto de interação. Nenhum estado deste componente é um beco
 * sem saída; os três oferecem uma ação.
 *
 * ## A distinção não é por cor
 *
 * FR-008 exige que os três estados sejam distinguíveis por **rótulo e forma**
 * além da cor, e a tabela abaixo é a de `contracts/shell.md` §3:
 *
 * | Estado | Ícone do provedor | Indicador | Conta | Ação |
 * | --- | --- | --- | --- | --- |
 * | `connected` | Cor de marca | Ponto preenchido | Identificador | Reconectar |
 * | `disconnected` | Cor de marca, esmaecido | Anel vazado | — | Conectar |
 * | `no-credential` | Neutro | Ausente | **Nunca** | Configurar |
 *
 * O ponto de sessão viva é preenchido; o de desconectado é vazado; o sem
 * credencial não existe. Três formas, não três matizes — e o rótulo do estado
 * está escrito por extenso ao lado, de modo que a cor é a terceira pista, nunca
 * a primeira (FR-042).
 *
 * ## Por que a cor de marca só toca o ícone
 *
 * FR-023: cor de marca é **acento identificador**, nunca ação, nunca estado,
 * nunca texto. Um chip pintado de verde Spotify diria "clique aqui" — neste
 * sistema preenchimento sólido significa acionável (FR-024) — e um nome de conta
 * em verde reprovaria no contraste: os pares aprovados declaram `--brand-*`
 * exclusivamente como `ui`, e `tests/unit/contrast.spec.ts` recusa qualquer par
 * de texto com eles.
 */

export type ConnectionState = 'connected' | 'disconnected' | 'no-credential';

export interface ConnectionChipProps {
  readonly provider: ProviderId;
  /**
   * Navegação ao consentimento. Injetável para teste; em produção é a navegação
   * real do navegador, e o caminho é o mesmo do `ConnectButton` — os dois
   * chamam `useAuthorize`, que grava o rascunho antes de sair da página.
   */
  readonly navigate?: (url: string) => void;
}

const PROVIDER_ICON = {
  spotify: 'provider-spotify',
  youtube: 'provider-youtube',
} as const;

/**
 * Mapa explícito de literais, nunca concatenação: o scanner do Tailwind lê o
 * código como texto e não resolve expressão (`tp/no-dynamic-classname`).
 *
 * A cor de marca entra por `text-brand-*` porque o ícone herda `currentColor` —
 * é tingir o glifo, não preencher o chip.
 */
const BRAND_INK = {
  spotify: 'text-brand-spotify',
  youtube: 'text-brand-youtube',
} as const;

const STATE_LABEL: Record<ConnectionState, string> = {
  connected: t.connectionChip.connected,
  disconnected: t.connectionChip.disconnected,
  'no-credential': t.connectionChip.noCredential,
};

/** Rótulo visível: curto, porque a barra é estreita e o serviço está ao lado. */
const ACTION_LABEL: Record<ConnectionState, string> = {
  connected: t.connectionChip.reconnect,
  disconnected: t.connectionChip.connect,
  'no-credential': t.connectionChip.configure,
};

/**
 * Nome acessível da ação: nomeia o serviço **e a conta**.
 *
 * Dois botões chamados "Reconectar" lado a lado são indistinguíveis para quem
 * navega por lista de controles — e a barra superior tem exatamente isso, um
 * chip por provedor.
 *
 * A escolha de "a conta do {serviço}" em vez de "ao {serviço}" resolve uma
 * segunda colisão, descoberta em teste de ponta a ponta: a etapa de conexão tem
 * um botão primário chamado "Conectar ao Spotify", e ele convive na mesma tela
 * com este chip. Dois controles com o mesmo nome acessível deixam quem usa
 * leitor de tela sem como escolher entre eles.
 */
/** Ação em texto, discreta: o chip inteiro não é clicável, só os verbos são. */
const ACTION_CLASSES =
  'focus-ring text-accent-text text-data rounded-pill shrink-0 cursor-pointer px-2 py-0.5 font-semibold underline-offset-2 hover:underline';

const ACTION_ACCESSIBLE_LABEL: Record<ConnectionState, string> = {
  connected: t.connectionChip.reconnectFor,
  disconnected: t.connectionChip.connectFor,
  'no-credential': t.connectionChip.configureFor,
};

export function ConnectionChip({ provider, navigate }: ConnectionChipProps) {
  const credential = useAppStore((state) => state.credentials[provider]);
  const session = useAppStore((state) => state.sessions[provider]);
  const goToStep = useAppStore((state) => state.goToStep);
  const disconnect = useAppStore((state) => state.disconnect);
  const authorize = useAuthorize(provider, navigate);

  const state: ConnectionState =
    credential === null ? 'no-credential' : session === null ? 'disconnected' : 'connected';

  const service = nameOf(provider);
  const account = state === 'connected' ? (session?.user.displayName ?? null) : null;

  return (
    <div
      className="border-rule bg-surface-zone rounded-pill chip-measure flex min-w-0 items-center gap-2 border px-2 py-1"
      // O nome acessível resolve o estado por extenso. Um leitor de tela que
      // encontre o chip ouve "Spotify: Conectado", não "Spotify" e um ponto
      // colorido que ele não pode ver.
      aria-label={format(t.connectionChip.label, { service, state: STATE_LABEL[state] })}
    >
      {/*
        Acento identificador. Esmaecido quando desconectado e neutro quando não
        há credencial: a saturação do glifo é a quarta pista do estado, depois da
        forma do indicador, do rótulo e da cor.
      */}
      <Icon
        role={PROVIDER_ICON[provider]}
        className={cx(
          'text-section',
          state === 'no-credential' ? 'text-ink-muted' : BRAND_INK[provider],
          state === 'disconnected' ? 'opacity-60' : null,
          'bg-blue'
        )}
      />

      {/*
        O indicador de sessão. `aria-hidden` porque o estado já está no nome
        acessível do chip e no rótulo visível — anunciá-lo de novo faria o leitor
        ouvir a mesma informação três vezes.

        Preenchido, vazado ou ausente: **forma**, que sobrevive a cores forçadas
        e a daltonismo. Sem credencial não há indicador nenhum, porque não há
        sessão a descrever.
      */}
      {state !== 'no-credential' && (
        <span
          aria-hidden="true"
          className={cx(
            'rounded-pill size-2 shrink-0',
            state === 'connected'
              ? 'bg-state-live'
              : 'border-rule-strong border bg-transparent',
          )}
        />
      )}

      <span className="flex min-w-0 flex-col">
        <span className="text-ink text-data font-semibold">{service}</span>
        {/*
          **Nunca identificador de conta em `no-credential`** (FR-009) — nem
          vazio, nem genérico. Quando não há credencial não houve autorização, e
          exibir um lugar reservado para a conta sugere que houve.

          `truncate` com `min-w-0` no pai é o que faz um nome de conta longo
          encurtar visualmente sem empurrar o controle de tema para fora da barra
          (`contracts/shell.md` §2). O texto permanece íntegro para leitor de
          tela — `truncate` é corte visual, não de conteúdo.
        */}
        <span className="text-ink-muted text-data truncate">
          {account ?? STATE_LABEL[state]}
        </span>
      </span>

      {/*
        **Nenhum estado é um beco sem saída.** Sem credencial a ação leva à
        Configuração — navegação interna, sem requisição; com credencial ela vai
        ao consentimento pelo caminho único de `useAuthorize`.
      */}
      <button
        type="button"
        onClick={
          state === 'no-credential'
            ? () => {
                goToStep('credential');
              }
            : () => void authorize()
        }
        aria-label={format(ACTION_ACCESSIBLE_LABEL[state], { service })}
        className={ACTION_CLASSES}
      >
        {ACTION_LABEL[state]}
      </button>

      {/*
        **Desconectar só existe quando há o que encerrar** (H6 da feature 004,
        preservado por FR-063).

        O `SessionHeader` que este chip absorveu oferecia as duas ações lado a
        lado, com rótulos inequívocos, e nunca deixava uma ocupar o lugar da
        outra. O arquivo de design não desenha esta ação — mas silêncio do design
        não é remoção, e retirá-la deixaria quem quer trocar de conta sem
        caminho: reconectar leva ao consentimento do provedor, que devolve a
        sessão já existente.

        O rótulo visível é curto porque a barra é estreita; o nome acessível
        nomeia o serviço, como o da ação principal.
      */}
      {state === 'connected' && (
        <button
          type="button"
          onClick={() => {
            disconnect(provider);
          }}
          aria-label={format(t.connect.disconnect, { service })}
          className={ACTION_CLASSES}
        >
          {t.connectionChip.disconnect}
        </button>
      )}
    </div>
  );
}
