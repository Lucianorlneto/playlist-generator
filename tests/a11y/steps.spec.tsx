/**
 * axe-core em todas as etapas do fluxo, incluindo as telas novas da 002
 * (FR-047): seletor de destinos, indicação de fila, estimativa de cota, ajuste
 * de lista para destino posterior e resumo consolidado.
 *
 * As regras de contraste ficam de fora: happy-dom não calcula estilo o
 * suficiente para avaliá-las, e um resultado falso seria pior que nenhum. O
 * contraste é responsabilidade dos tokens de `src/styles/index.css`.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CredentialStep } from '@/features/credential/CredentialStep';
import { DestinationsStep } from '@/features/destinations/DestinationsStep';
import { InputScreen } from '@/features/input/InputScreen';
import { ListReduction } from '@/features/input/ListReduction';
import { QueueIndicator } from '@/features/queue/QueueIndicator';
import { QuotaEstimateScreen } from '@/features/quota/QuotaEstimateScreen';
import { ResultScreen } from '@/features/result/ResultScreen';
import { ReauthDialog } from '@/features/connect/ReauthDialog';
import { SessionHeader } from '@/features/connect/SessionHeader';
import { ReviewScreen } from '@/features/review/ReviewScreen';
import { SkipButton } from '@/features/service/SkipButton';
import { SummaryScreen } from '@/features/summary/SummaryScreen';
import { ResetFlow } from '@/app/ResetFlow';
import { t } from '@/i18n/pt-BR';
import { configureProviderClient } from '@/services/providers/http';
import { createRefresher } from '@/services/providers/spotify/auth';
import { THEMES } from '@/domain/theme/approvedPairs';
import { useAppStore } from '@/store';

import {
  makeCandidate,
  makeCreation,
  makeCredentials,
  makeFreeLine,
  makeItem,
  makeLine,
  makeQueue,
  makeResult,
  makeRun,
  makeSession,
  makeSessions,
} from '../fixtures/factories';

const CLIENT_ID = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
const YT_CLIENT_ID = '123-abc.apps.googleusercontent.com';

const REGRAS = { 'color-contrast': { enabled: false } };

/**
 * Roda o axe e exige zero violações.
 *
 * O `catch` cobre uma limitação do ambiente, não do produto: para montar o
 * seletor CSS que aponta o nó, o axe emite algo como
 * `input[aria-label="Incluir \"Amor\" na playlist"]`, e o motor de seletores do
 * happy-dom recusa a aspa escapada. Quando isso acontece, a análise é refeita
 * **sem** gerar seletor — as regras avaliadas são exatamente as mesmas, só a
 * localização do nó na mensagem de falha se perde.
 *
 * Engolir a exceção sem repetir seria pior: a suíte passaria sem ter analisado
 * nada.
 */
async function semViolacoes(container: HTMLElement): Promise<void> {
  let resultado: axe.AxeResults;
  try {
    resultado = await axe.run(container, { rules: REGRAS });
  } catch {
    resultado = await axe.run(container, {
      rules: REGRAS,
      selectors: false,
      ancestry: false,
      xpath: false,
    });
  }

  const descricao = resultado.violations
    .map((violation) => `${violation.id}: ${violation.help}`)
    .join('\n');

  expect(resultado.violations, descricao).toHaveLength(0);
}

const linhas = [
  makeLine({ id: 'l0', index: 0, raw: 'Bohemian Rhapsody - Queen' }),
  makeLine({ id: 'l1', index: 1, raw: 'Imagine - Jhon Lennon' }),
  makeLine({
    id: 'l2',
    index: 2,
    raw: 'linha ruim',
    title: '',
    artist: '',
    parseStatus: 'unparsed',
  }),
];

const itens = [
  makeItem({ line: linhas[0], candidates: [makeCandidate({ id: 'a' })] }),
  makeItem({
    line: linhas[1],
    status: 'uncertain',
    candidates: [makeCandidate({ id: 'b' })],
    included: false,
  }),
  makeItem({
    line: linhas[2],
    status: 'unparsed',
    candidates: [],
    selectedUri: null,
    included: false,
  }),
];

beforeEach(() => {
  configureProviderClient('spotify', {
    getSession: () => useAppStore.getState().sessions.spotify,
    saveSession: () => undefined,
    clearSession: () => undefined,
    refresh: createRefresher(() => CLIENT_ID),
  });
});

/**
 * A suíte inteira roda **duas vezes**, uma por tema (FR-031, SC-002, research §11).
 *
 * O que isso pega e o que não pega, dito com honestidade: as regras de contraste
 * estão desligadas porque o happy-dom não calcula estilo o bastante, então a
 * duplicação **não** verifica cor. O que ela verifica é que nenhuma etapa
 * introduza estrutura condicional ao tema — rótulo, papel ARIA ou ordem que
 * mudem com o atributo raiz. Hoje nada muda, e é exatamente essa a afirmação
 * que o teste passa a sustentar em vez de assumir.
 *
 * A verificação de contraste de verdade é `tests/unit/contrast.spec.ts`, que
 * mede os pares declarados nos dois temas. As duas se complementam: a matriz
 * cobre pares declarados, o axe cobre a árvore renderizada.
 */
describe.each(THEMES)('Acessibilidade do fluxo (FR-047) — tema %s', (theme) => {
  beforeEach(() => {
    document.documentElement.setAttribute('data-theme', theme);
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
  });

  it('configuração — sem nenhuma credencial salva', async () => {
    const { container } = render(<CredentialStep />);
    await semViolacoes(container);
  });

  it('configuração — com credencial salva e mascarada', async () => {
    useAppStore.getState().setCredential('spotify', CLIENT_ID);
    const { container } = render(<CredentialStep />);
    await semViolacoes(container);
  });

  it('destinos — um habilitado e um desabilitado com motivo', async () => {
    useAppStore.setState({ credentials: makeCredentials({ spotify: CLIENT_ID }) });
    useAppStore.getState().reconcileDestinations();

    const { container } = render(<DestinationsStep />);
    await semViolacoes(container);
  });

  it('destinos — ambos habilitados e marcados', async () => {
    useAppStore.setState({
      credentials: makeCredentials({ spotify: CLIENT_ID, youtube: YT_CLIENT_ID }),
    });
    useAppStore.getState().reconcileDestinations();

    const { container } = render(<DestinationsStep />);
    await semViolacoes(container);
  });

  it('entrada', async () => {
    useAppStore.setState({ rawText: 'Bohemian Rhapsody - Queen' });
    const { container } = render(<InputScreen />);
    await semViolacoes(container);
  });

  it('indicação de fila com dois destinos', async () => {
    useAppStore.setState({
      destinations: { selected: ['spotify', 'youtube'], locked: true },
      queue: makeQueue(['spotify', 'youtube'], { currentIndex: 0 }),
    });

    const { container } = render(<QueueIndicator />);
    await semViolacoes(container);
  });

  it('estimativa de cota — dentro do saldo', async () => {
    useAppStore.setState({
      lines: linhas,
      destinations: { selected: ['youtube'], locked: false },
      queue: makeQueue(['youtube'], {
        currentIndex: 0,
        runs: {
          youtube: makeRun('youtube', {
            phase: 'estimate',
            lineIds: linhas.map((line) => line.id),
            estimate: {
              provider: 'youtube',
              lineCount: 3,
              selectedCount: 3,
              estimatedUnits: 500,
              availableUnits: 10_000,
              blocked: false,
              maxLinesThatFit: 66,
              retryReserve: 0,
            },
          }),
        },
      }),
    });

    const { container } = render(<QuotaEstimateScreen provider="youtube" />);
    await semViolacoes(container);
  });

  it('estimativa de cota — bloqueada por saldo insuficiente', async () => {
    useAppStore.setState({
      lines: linhas,
      destinations: { selected: ['youtube'], locked: false },
      queue: makeQueue(['youtube'], {
        currentIndex: 0,
        runs: {
          youtube: makeRun('youtube', {
            phase: 'estimate',
            lineIds: linhas.map((line) => line.id),
            estimate: {
              provider: 'youtube',
              lineCount: 200,
              selectedCount: 200,
              estimatedUnits: 30_000,
              availableUnits: 10_000,
              blocked: true,
              maxLinesThatFit: 66,
              retryReserve: 40,
            },
          }),
        },
      }),
    });

    const { container } = render(<QuotaEstimateScreen provider="youtube" />);
    await semViolacoes(container);
  });

  it('ajuste de lista para destino posterior', async () => {
    const { container } = render(
      <ListReduction
        provider="youtube"
        lines={linhas}
        lineIds={linhas.map((line) => line.id)}
        maxLinesThatFit={2}
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );
    await semViolacoes(container);
  });

  it('revisão com os três status', async () => {
    useAppStore.setState({
      sessions: makeSessions({ spotify: makeSession('spotify') }),
      existingNames: [],
      lines: linhas,
      destinations: { selected: ['spotify'], locked: false },
      queue: makeQueue(['spotify'], {
        currentIndex: 0,
        runs: {
          spotify: makeRun('spotify', {
            phase: 'review',
            lineIds: linhas.map((line) => line.id),
            items: itens,
          }),
        },
      }),
    });

    const { container } = render(<ReviewScreen provider="spotify" />);
    await semViolacoes(container);
  });

  /**
   * `003/FR-017`: a revisão de uma lista só de títulos isolados, onde **todo**
   * item traz motivo de atenção. É o cenário mais denso de texto da tela nova, e
   * o que verifica que o motivo é anunciado — não sinalizado só por cor.
   */
  it('revisão com títulos isolados e os quatro motivos de atenção', async () => {
    const soloLinhas = [
      makeFreeLine({ id: 'sl0', index: 0, raw: 'Amor' }),
      makeFreeLine({ id: 'sl1', index: 1, raw: 'Imagine' }),
      makeFreeLine({ id: 'sl2', index: 2, raw: 'Hello' }),
      makeFreeLine({ id: 'sl3', index: 3, raw: 'Perfect' }),
    ];

    const soloItens = [
      makeItem({
        line: soloLinhas[0]!,
        status: 'uncertain',
        attentionReason: 'no_artist_ambiguous',
        candidates: [makeCandidate({ id: 'amor-a' }), makeCandidate({ id: 'amor-b' })],
        included: false,
      }),
      makeItem({
        line: soloLinhas[1]!,
        status: 'uncertain',
        attentionReason: 'version_hint',
        candidates: [makeCandidate({ id: 'imagine-live', versionHints: ['live'] })],
        included: false,
      }),
      makeItem({
        line: soloLinhas[2]!,
        status: 'not_found',
        attentionReason: 'not_found',
        candidates: [],
        selectedUri: null,
        included: false,
      }),
      makeItem({
        line: soloLinhas[3]!,
        status: 'not_found',
        attentionReason: 'retry_skipped_quota',
        candidates: [],
        selectedUri: null,
        included: false,
      }),
    ];

    useAppStore.setState({
      sessions: makeSessions({ spotify: makeSession('spotify') }),
      existingNames: [],
      lines: soloLinhas,
      destinations: { selected: ['spotify'], locked: false },
      queue: makeQueue(['spotify'], {
        currentIndex: 0,
        runs: {
          spotify: makeRun('spotify', {
            phase: 'review',
            lineIds: soloLinhas.map((line) => line.id),
            items: soloItens,
          }),
        },
      }),
    });

    const { container } = render(<ReviewScreen provider="spotify" />);

    // O motivo é texto de verdade na árvore acessível, não `aria-label` de um
    // ícone nem uma classe de cor.
    expect(screen.getByText(t.review.attentionReason.noArtistAmbiguous)).toBeInTheDocument();
    expect(screen.getByText(t.review.attentionReason.retrySkippedQuota)).toBeInTheDocument();
    // A distinção que FR-017 exige: "não encontrada" ≠ "não tentei de novo".
    expect(t.review.attentionReason.retrySkippedQuota).not.toBe(t.review.attentionReason.notFound);

    await semViolacoes(container);
  });

  it('resultado de um serviço', async () => {
    useAppStore.setState({
      sessions: makeSessions({ spotify: makeSession('spotify') }),
      lines: linhas,
      destinations: { selected: ['spotify'], locked: true },
      queue: makeQueue(['spotify'], {
        currentIndex: 0,
        runs: {
          spotify: makeRun('spotify', {
            phase: 'done',
            outcome: 'completed',
            lineIds: linhas.map((line) => line.id),
            items: itens,
            result: makeResult({ failedLines: ['Faixa Inexistente - Ninguém'] }),
          }),
        },
      }),
    });

    const { container } = render(<ResultScreen provider="spotify" />);
    await semViolacoes(container);
  });

  it('resumo consolidado com dois destinos e listas divergentes', async () => {
    useAppStore.setState({
      sessions: makeSessions({
        spotify: makeSession('spotify'),
        youtube: makeSession('youtube'),
      }),
      lines: linhas,
      destinations: { selected: ['spotify', 'youtube'], locked: true },
      queue: makeQueue(['spotify', 'youtube'], {
        currentIndex: 1,
        runs: {
          spotify: makeRun('spotify', {
            phase: 'done',
            outcome: 'completed',
            lineIds: linhas.map((line) => line.id),
            frozenLines: linhas,
            items: itens,
            result: makeResult(),
          }),
          youtube: makeRun('youtube', {
            phase: 'done',
            outcome: 'partial',
            lineIds: ['l0'],
            frozenLines: [linhas[0]!],
            items: [itens[0]!],
            result: makeResult({
              provider: 'youtube',
              playlistUrl: 'https://www.youtube.com/playlist?list=PL_teste',
              addedCount: 1,
              incompleteByQuota: true,
              failedLines: ['Imagine - Jhon Lennon'],
            }),
          }),
        },
      }),
    });

    const { container } = render(<SummaryScreen />);
    await semViolacoes(container);
  });
});

/**
 * V17/A4 — o diálogo de reconexão sob o axe (`004/SC-006`,
 * `004/ui-contract §5`).
 *
 * A contenção de foco **não** é afirmada aqui: happy-dom expõe `showModal()` mas
 * não emula a camada de topo do navegador, e um teste que passasse aqui não
 * provaria nada sobre ela (D1 do plano). O que se verifica é o que este ambiente
 * de fato observa — papel, rótulo, ordem de cabeçalhos e nomes acessíveis dos
 * controles. A contenção é provada em `e2e/reconnect.spec.ts`, no navegador.
 */
describe('004/V17 — reconexão sem violação séria ou crítica', () => {
  beforeEach(() => {
    useAppStore.setState({
      credentials: makeCredentials({ spotify: CLIENT_ID, youtube: YT_CLIENT_ID }),
      sessions: makeSessions({ spotify: makeSession('spotify') }),
      destinations: { selected: ['spotify', 'youtube'], locked: false },
      lines: linhas,
      queue: makeQueue(['youtube'], {
        currentIndex: 0,
        runs: {
          youtube: makeRun('youtube', {
            phase: 'awaiting_reauth',
            resumeFrom: 'search',
            lineIds: linhas.map((line) => line.id),
            items: itens,
          }),
        },
      }),
    });
  });

  it('o diálogo aberto não introduz violação', async () => {
    const { container } = render(<ReauthDialog provider="youtube" />);
    await semViolacoes(container);
  });

  it('o diálogo na fase de criação também passa', async () => {
    useAppStore.setState({
      queue: makeQueue(['youtube'], {
        currentIndex: 0,
        runs: {
          youtube: makeRun('youtube', {
            phase: 'awaiting_reauth',
            resumeFrom: 'creating',
            lineIds: linhas.map((line) => line.id),
            items: itens,
            creation: makeCreation({ orderedUris: ['a', 'b'], committedItems: 1 }),
          }),
        },
      }),
    });

    const { container } = render(<ReauthDialog provider="youtube" />);
    await semViolacoes(container);
  });

  it('o diálogo sem credencial salva também passa', async () => {
    useAppStore.setState({ credentials: makeCredentials({}) });

    const { container } = render(<ReauthDialog provider="youtube" />);
    await semViolacoes(container);
  });

  it('o cabeçalho com um serviço desconectado não introduz violação', async () => {
    const { container } = render(<SessionHeader />);
    await semViolacoes(container);
  });
});

/**
 * V15 — os dois diálogos da `006` (`006/FR-023`, SC-008).
 *
 * Ambos são `<dialog>` nativo pelo primitivo `Dialog`, que a 004 trouxe. O que
 * este bloco audita não é o elemento — é o **conteúdo** que a 006 põe dentro
 * dele: título rotulando o diálogo, corpo e o par de ações.
 *
 * A contenção de foco continua fora do alcance do axe em happy-dom, e a prova
 * dela segue sendo o Playwright (D1 do `004/plan.md`).
 */
describe('006 — diálogos de pular e de recomeçar', () => {
  const linha006 = makeLine({ id: 'l006', index: 0 });

  function semearTrabalho006(runs?: Record<string, ReturnType<typeof makeRun>>) {
    useAppStore.setState({
      step: 'service',
      rawText: 'Bohemian Rhapsody - Queen',
      lines: [linha006],
      credentials: makeCredentials({ spotify: CLIENT_ID }),
      sessions: makeSessions({ spotify: makeSession('spotify') }),
      destinations: { selected: ['spotify'], locked: true },
      queue: makeQueue(['spotify'], {
        currentIndex: 0,
        runs: runs ?? {
          spotify: makeRun('spotify', { phase: 'connect', lineIds: [linha006.id] }),
        },
      }),
    });
  }

  it('o diálogo de pular que encerra o fluxo não introduz violação', async () => {
    semearTrabalho006();
    const { container } = render(<SkipButton provider="spotify" />);

    await userEvent.click(screen.getByRole('button', { name: /Pular/ }));
    await semViolacoes(container);
  });

  it('o diálogo de recomeço não introduz violação', async () => {
    semearTrabalho006();
    const { container } = render(<ResetFlow />);

    await userEvent.click(screen.getByRole('button', { name: t.flow.reset }));
    await semViolacoes(container);
  });

  it('o diálogo de recomeço com playlist já criada também passa', async () => {
    semearTrabalho006({
      spotify: makeRun('spotify', {
        phase: 'done',
        outcome: 'completed',
        lineIds: [linha006.id],
        result: makeResult(),
      }),
    });
    const { container } = render(<ResetFlow />);

    await userEvent.click(screen.getByRole('button', { name: t.flow.reset }));
    await semViolacoes(container);
  });

  it('o botão de recomeço no cabeçalho não introduz violação', async () => {
    semearTrabalho006();
    const { container } = render(<ResetFlow />);
    await semViolacoes(container);
  });
});
