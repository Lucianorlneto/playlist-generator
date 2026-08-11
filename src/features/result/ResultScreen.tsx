import { useState } from 'react';

import type { ProviderId } from '@/domain/providers';
import { linesFor } from '@/domain/run/lines';
import type { CreationResult } from '@/domain/types';
import { nameOf, textFor } from '@/features/credential/providerText';
import { QueueIndicator } from '@/features/queue/QueueIndicator';
import { ListReduction } from '@/features/input/ListReduction';
import { SkipButton } from '@/features/service/SkipButton';
import { format, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
import { Button } from '@/ui/Button';
import { cx } from '@/ui/cx';
import { Icon } from '@/ui/Icon';
import { CrossFade } from '@/ui/motion';
import { StepHeading } from '@/ui/StepHeading';

import { CreatingFootnote, CreatingIntro } from './CreatingBody';
import { FailedLines } from './FailedLines';
import { FolderNotice } from './FolderNotice';
import { ResultSkeleton } from './ResultSkeleton';
import { RetryRemaining } from './RetryRemaining';

export interface ResultScreenProps {
  provider: ProviderId;
}

/**
 * Mapas explícitos de literais, nunca concatenação: o scanner do Tailwind lê o
 * código como texto e não resolve expressão (`tp/no-dynamic-classname`).
 *
 * `text-*` tinge o glifo, que herda `currentColor`. **Nunca `bg-*`** — o
 * substrato tingido de 008/FR-004 é exceção nomeada do cartão de destino e não
 * alcança este cabeçalho (008/contracts/destinations.md §4).
 */
const PROVIDER_ICON = {
  spotify: 'provider-spotify',
  youtube: 'provider-youtube',
} as const;

const BRAND_INK = {
  spotify: 'text-brand-spotify',
  youtube: 'text-brand-youtube',
} as const;

/**
 * **O cabeçalho do cartão de fase** (008/FR-001; nós `EvlNu` em `C13Hj` e
 * `FWym9` em `SjphR`).
 *
 * Um componente local, e não duas cópias, porque a criação em andamento e o
 * resultado concluído são a mesma superfície do arquivo de design em dois
 * momentos — e o cabeçalho é literalmente o mesmo nó.
 */
function CardHeader({ provider }: { readonly provider: ProviderId }) {
  return (
    <header className="flex items-center gap-2">
      {/* Decorativo: o nome do serviço está escrito no título logo abaixo. */}
      <Icon role={PROVIDER_ICON[provider]} className={cx('text-section', BRAND_INK[provider])} />
      {/*
        A repetição **visual** da posição na fila (008/FR-013), `aria-hidden`:
        ela existe para quem está lendo o cartão sem ter voltado o olho ao topo
        da tela, e a linha de contexto é quem a anuncia.
      */}
      <QueueIndicator />
    </header>
  );
}

/**
 * **As quatro informações do resultado** (nó `UbmQs`), extraídas para poderem
 * virar slot do `CrossFade` (009/FR-010a).
 *
 * Função local, no molde do `CardHeader` logo acima, e não arquivo novo: é o
 * `<dl>` que já morava aqui, sem uma linha alterada. `ResultSkeleton` espelha
 * estas mesmas classes de grade, porque é o lugar desta grade que ele ocupa
 * enquanto a criação está em voo (009/contracts/loading-card.md §5.1.2).
 */
function ResultStats({ result }: { readonly result: CreationResult }) {
  return (
    <dl className="grid gap-2 text-body sm:grid-cols-2">
      <div>
        <dt className="text-ink font-semibold">{t.result.playlistName}</dt>
        <dd className="text-ink-muted">{result.playlistName}</dd>
      </div>
      <div>
        <dt className="text-ink font-semibold">{t.result.added}</dt>
        <dd className="text-ink-muted">{result.addedCount}</dd>
      </div>
      <div>
        <dt className="text-ink font-semibold">{t.result.skipped}</dt>
        <dd className="text-ink-muted">{result.skippedCount}</dd>
      </div>
      <div>
        <dt className="text-ink font-semibold">{t.result.effectivePath}</dt>
        <dd className="text-ink-muted break-words">{result.effectivePath}</dd>
      </div>
    </dl>
  );
}

/**
 * Resultado de **um** serviço (FR-020, FR-021, FR-027, FR-028, FR-032).
 *
 * A mesma tela cobre criação em andamento, falha parcial e conclusão — para o
 * usuário é um lugar só: onde ele descobre o que aconteceu com a lista dele
 * naquele destino.
 *
 * É também o segundo ponto de entrada do ajuste de lista (FR-013): daqui o
 * usuário pode remover linhas antes de o próximo destino começar.
 */
export function ResultScreen({ provider }: ResultScreenProps) {
  const stepToken = useAppStore((state) => state.stepToken);
  const queue = useAppStore((state) => state.queue);
  const run = useAppStore((state) => state.queue.runs[provider] ?? null);
  const lines = useAppStore((state) => state.lines);
  const sessions = useAppStore((state) => state.sessions);
  const creationError = useAppStore((state) => state.creationError);
  const advance = useAppStore((state) => state.advance);
  const reduceUpcoming = useAppStore((state) => state.reduceUpcoming);
  const goToStep = useAppStore((state) => state.goToStep);
  const resetWork = useAppStore((state) => state.resetWork);

  const [reducing, setReducing] = useState(false);

  if (run === null) return null;

  const service = nameOf(provider);
  const text = textFor(provider);
  const result = run.result;
  const creation = run.creation;

  const nextProvider = queue.order[queue.currentIndex + 1] ?? null;
  const isLast = nextProvider === null;
  const nextRun = nextProvider === null ? null : (queue.runs[nextProvider] ?? null);

  /**
   * **A regra de exibição do carregamento** (009/FR-024, SC-005;
   * `009/data-model.md` §1).
   *
   * As quatro condições são conjuntas de propósito. `phase === 'creating'`
   * sozinho não basta: a fase **permanece** `creating` enquanto o erro de escrita
   * está na tela com as saídas, e um disco girando atrás de uma mensagem de erro
   * é exatamente o que o FR-024 proíbe.
   *
   * A perda de sessão não precisa de cláusula própria — ela leva a execução para
   * `awaiting_reauth`, que é outra fase, e `ServiceStep` troca a tela inteira.
   *
   * **Sem tempo mínimo.** A condição é lida a cada render e nada a segura: uma
   * lista de uma linha que resolve em 300ms mostra o carregamento por 300ms e
   * some. O piso artificial que alguém acrescentaria no primeiro relato de
   * "piscou" é proibido explicitamente pelos Edge Cases da spec.
   */
  const mostraCarregamento =
    run.phase === 'creating' &&
    run.outcome === null &&
    run.error === null &&
    creationError === null;

  // --- Ajuste da lista para o próximo destino ------------------------------
  //
  // Continua sendo `early return`: é outra tela, não outro corpo do cartão. A
  // condição carrega `result !== null` explicitamente porque ela **estava** ali
  // implícita — o caminho antigo só alcançava este ponto depois da bifurcação
  // por `result`, e o botão que liga `reducing` só existe no corpo concluído
  // (009/FR-010, 009/contracts/loading-card.md §5.1).

  if (result !== null && reducing && nextProvider !== null && nextRun !== null) {
    return (
      <ListReduction
        provider={nextProvider}
        lines={linesFor(lines, nextRun.lineIds)}
        lineIds={nextRun.lineIds}
        onConfirm={(lineIds) => {
          reduceUpcoming(nextProvider, lineIds);
          setReducing(false);
        }}
        onCancel={() => {
          setReducing(false);
        }}
      />
    );
  }

  const account = result === null ? '' : (sessions[provider]?.user.displayName ?? '');

  return (
    /*
      **O cartão de fase**, renderizado **uma única vez** (008/FR-006; nós
      `qBqxK — Service Result · Loading` em `SjphR` e `yTOJb — Success Card` em
      `C13Hj`). Para o arquivo de design, criar e ter criado são dois momentos do
      mesmo cartão — e desde a 009 são também os mesmos nós de DOM.

      **Por que a árvore deixou de bifurcar** (009/research §R7): retornando duas
      seções diferentes conforme `result` fosse nulo ou não, o React desmontava a
      seção inteira quando o resultado chegava. Não havia transição a executar, e
      o cabeçalho e o título saltavam de posição. Com o cartão, o cabeçalho e a
      célula compartilhada sendo os mesmos nós nos dois estados, o deslocamento do
      SC-004 é **zero por construção**, não por ajuste fino.

      `--surface` com contorno `--rule`, e o título é filho dele — a linha de
      contexto fica fora, no cabeçalho da etapa. É também o que devolve o degrau
      às caixas internas (`Info Box`, `hHyQ6`), que o arquivo desenha em `--bg`
      sobre este `--surface`.
    */
    <section className="app-card flex flex-col gap-4">
      <CardHeader provider={provider} />

      {/*
        O 2º filho do cartão, e é dele que a aritmética do SC-004 depende: em
        carregamento é o Fragment `CreatingIntro`, cujo primeiro nó é a linha do
        indicador de 48px; concluído é o `StepHeading`. O topo dos dois é o mesmo
        ponto (009/contracts/loading-card.md §3).
      */}
      {mostraCarregamento ? (
        <CreatingIntro service={service} />
      ) : (
        <StepHeading
          title={
            result === null
              ? format(t.playlistConfig.creating, { service })
              : format(t.result.heading, { service })
          }
          focusToken={stepToken}
        />
      )}

      {/*
        **A célula compartilhada** (FR-007, FR-010a).

        Ela é filha **direta** do cartão e está montada nos dois estados. Se
        fosse filha do corpo de carregamento, desmontaria junto com ele no
        instante em que `mostraCarregamento` virasse falso — e não haveria fusão
        cruzada alguma a executar. Passá-la como `children` do corpo não
        resolveria: o que decide é onde o nó vive na árvore, não de onde a JSX
        veio (009/contracts/loading-card.md §5.1.1).

        Com os dois slots nulos — o estado de falha da escrita — o `CrossFade`
        devolve `null`, e não uma caixa vazia: sem isso o `gap-4` da seção
        criaria um respiro fantasma onde não há nem esqueleto nem informações.
      */}
      <CrossFade
        from={mostraCarregamento ? <ResultSkeleton /> : null}
        to={result === null ? null : <ResultStats result={result} />}
      />

      {/*
        **O rodapé fica aqui, e não dentro de `CreatingIntro`** (FR-011): ele
        pertence ao conteúdo de carregamento, mas vive **abaixo** da célula
        acima. É essa restrição de layout que parte o corpo de carregamento em
        dois exports do mesmo arquivo.
      */}
      {mostraCarregamento && <CreatingFootnote service={service} creation={creation} />}

      {result === null ? (
        // --- Criação interrompida: erro, retomada e saídas -------------------
        <>
          {creationError !== null && creation === null && (
            <div
              role="alert"
              className="border-state-missing bg-state-missing-tint rounded-card border p-3 text-body"
            >
              <p className="font-bold">{creationError.info.title}</p>
              <p>{creationError.info.cause}</p>
              <p>{creationError.info.nextStep}</p>
            </div>
          )}

          {creationError !== null && <RetryRemaining provider={provider} />}

          {run.error !== null && (
            <div
              role="alert"
              className="border-state-missing bg-state-missing-tint rounded-card border p-3 text-body"
            >
              <p className="font-bold">{run.error.title}</p>
              <p>{run.error.cause}</p>
              <p>{run.error.nextStep}</p>
            </div>
          )}

          {run.outcome !== null && (
            <div>
              <Button
                variant="primary"
                onClick={() => {
                  advance();
                  if (isLast) goToStep(queue.order.length > 1 ? 'summary' : 'service');
                }}
              >
                {isLast
                  ? t.result.startOver
                  : format(t.result.continueNext, { service: nameOf(nextProvider) })}
              </Button>
            </div>
          )}
        </>
      ) : (
        // --- Concluído -------------------------------------------------------
        // O `<dl>` das quatro informações **não** está aqui: ele é `ResultStats`,
        // montado acima no slot de entrada da célula compartilhada (009/FR-010a).
        <>
          <p className="field-message">{t.result.skippedHint}</p>
          {account !== '' && (
            <p className="field-message">{format(t.result.accountNotice, { account })}</p>
          )}

          {result.incompleteByQuota && (
            <div
              role="alert"
              className="border-state-uncertain-edge bg-state-uncertain-tint rounded-card border p-3 text-body"
            >
              <p className="font-bold">{format(t.quota.exhaustedHeading, { service })}</p>
              <p>
                {format(t.quota.exhaustedBody, {
                  name: result.playlistName,
                  added: result.addedCount,
                  total: (creation?.orderedUris.length ?? result.addedCount).toString(),
                })}
              </p>
              <p className="mt-1">{t.quota.incompleteWarning}</p>
              <p className="mt-1">{t.quota.exhaustedNextStep}</p>
              <p className="field-message">{t.draft.keptAfterQuota}</p>
            </div>
          )}

          <div>
            <a
              href={result.playlistUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-ring bg-accent text-accent-ink inline-flex rounded-card px-4 py-2 text-body font-semibold"
            >
              {text.openPlaylist}
            </a>
          </div>

          <FolderNotice provider={provider} />
          <FailedLines provider={provider} lines={result.failedLines} indices={result.failedIndices} />

          <div className="flex flex-wrap gap-2">
            {isLast ? (
              <Button
                variant="primary"
                onClick={() => {
                  advance();
                  if (queue.order.length > 1) goToStep('summary');
                  else resetWork();
                }}
              >
                {queue.order.length > 1 ? t.common.next : t.result.startOver}
              </Button>
            ) : (
              <>
                <Button
                  variant="primary"
                  onClick={() => {
                    advance();
                  }}
                >
                  {format(t.result.continueNext, { service: nameOf(nextProvider) })}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setReducing(true);
                  }}
                >
                  {t.result.adjustList}
                </Button>
                {/*
                  Pular o destino seguinte **não** desfaz nem oculta o que já foi
                  criado neste (FR-020). `exitAfterSkip` devolve `summary` aqui,
                  porque o destino de onde o usuário olha rodou — e é por isso que
                  este caminho, o único dos seis que já funcionava, sai da `006` com
                  o comportamento inalterado (`006/ui-contract §4`).
                */}
                <SkipButton provider={nextProvider} />
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}
