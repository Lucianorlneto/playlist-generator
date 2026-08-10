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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CredentialStep } from '@/features/credential/CredentialStep';
import { DestinationsStep } from '@/features/destinations/DestinationsStep';
import { InputScreen } from '@/features/input/InputScreen';
import { ListReduction } from '@/features/input/ListReduction';
import { QueueIndicator } from '@/features/queue/QueueIndicator';
import { QuotaEstimateScreen } from '@/features/quota/QuotaEstimateScreen';
import { ResultScreen } from '@/features/result/ResultScreen';
import { ReauthDialog } from '@/features/connect/ReauthDialog';
import { ConnectionChip } from '@/features/connect/ConnectionChip';
import { ReviewScreen } from '@/features/review/ReviewScreen';
import { SkipButton } from '@/features/service/SkipButton';
import { SummaryScreen } from '@/features/summary/SummaryScreen';
import { ResetFlow } from '@/app/ResetFlow';
import { Shell } from '@/app/Shell';
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

  it('o chip de conexão com um serviço desconectado não introduz violação', async () => {
    // Sucessor do `SessionHeader`, removido na 007. O chip cobre um estado a
    // mais — sem credencial —, e os três precisam passar na auditoria.
    const { container } = render(<ConnectionChip provider="youtube" />);
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

/**
 * 007/SC-003 e SC-013 — a casca de três zonas, nos **dois temas** e nas **duas
 * larguras**.
 *
 * Os blocos acima auditam cada tela isoladamente. Este audita a casca que passou
 * a envolvê-las, e ela é onde os problemas novos moram: a barra superior tem
 * dois chips com estados independentes, a trilha tem uma lista com
 * `aria-current`, e a largura estreita troca a trilha por um resumo. Nenhuma
 * dessas superfícies existia antes da feature.
 *
 * Rodar nas duas larguras não é zelo redundante: abaixo do ponto de corte a
 * árvore é **outra** — a trilha não é renderizada e o `StepSummary` toma o seu
 * lugar. Auditar só a largura ampla deixaria metade da casca sem prova.
 */
describe.each(THEMES)('007/SC-003 · a casca não introduz violação — tema %s', (theme) => {
  const CLIENT_ID_007 = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';

  function larguraDe(narrow: boolean): void {
    vi.stubGlobal(
      'matchMedia',
      (query: string): MediaQueryList =>
        ({
          matches: narrow,
          media: query,
          onchange: null,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          addListener: () => undefined,
          removeListener: () => undefined,
          dispatchEvent: () => false,
        }) as unknown as MediaQueryList,
    );
  }

  beforeEach(() => {
    document.documentElement.setAttribute('data-theme', theme);
    useAppStore.setState({
      credentials: makeCredentials({ spotify: CLIENT_ID_007, youtube: YT_CLIENT_ID }),
      sessions: makeSessions({ spotify: makeSession('spotify') }),
      queue: makeQueue(['spotify', 'youtube']),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.removeAttribute('data-theme');
  });

  for (const narrow of [false, true]) {
    const largura = narrow ? 'estreita' : 'ampla';

    it(`largura ${largura}: a casca inteira passa no axe`, async () => {
      larguraDe(narrow);
      useAppStore.setState({ step: 'destinations' });

      const { container } = render(
        <Shell>
          <p>conteúdo</p>
        </Shell>,
      );
      await semViolacoes(container);
    });

    it(`largura ${largura}: nenhum elemento decorativo é anunciado (SC-013)`, async () => {
      larguraDe(narrow);
      useAppStore.setState({ step: 'destinations' });

      const { container } = render(
        <Shell>
          <p>conteúdo</p>
        </Shell>,
      );

      /*
        Toda imagem desta aplicação é decoração — marca, fundo ambiente,
        fotografia de clima e os onze adesivos —, exceto as capas de álbum da
        revisão, que têm `alt` descritivo e não aparecem nesta etapa.

        `alt=""` retira a imagem da árvore de acessibilidade; um `aria-hidden`
        no ancestral faz o mesmo pelo ramo inteiro. Qualquer das duas basta.
      */
      const anunciadas = [...container.querySelectorAll('img')]
        .filter((img) => img.getAttribute('alt') !== '')
        .filter((img) => img.closest('[aria-hidden="true"]') === null)
        .map((img) => img.getAttribute('src') ?? '(sem src)');

      expect(anunciadas, `decoração anunciada: ${anunciadas.join(', ')}`).toEqual([]);
    });
  }
});

/**
 * 008/FR-013 — a posição na fila é anunciada **uma vez só**.
 *
 * O requisito tem duas metades que puxam para lados opostos: a posição não pode
 * ser o único portador da informação, e a repetição precisa ser redundante para
 * tecnologia assistiva onde o mesmo dado já é anunciado. A leitura adotada é
 * **um anúncio, dois lugares visíveis** (008/research §R2):
 *
 * - a linha de contexto do cabeçalho é texto real e anunciado, em **todas** as
 *   fases do ciclo;
 * - o cabeçalho do cartão de orçamento e de resultado repete a posição
 *   visualmente, `aria-hidden`, para quem está lendo o cartão sem ter voltado o
 *   olho ao topo da tela.
 *
 * As duas nunca coexistem numa mesma tela, e é isso que faz a conta fechar: o
 * cabeçalho de cartão só existe nas fases de orçamento, criação e conclusão, e é
 * justamente nelas que a linha de contexto troca a posição pelo sufixo da fase.
 * Por isso o `QueueIndicator` **não** é `aria-hidden` — escondê-lo deixaria a
 * posição sem anúncio nenhum naquelas telas.
 *
 * Os dois casos que este bloco existe para pegar:
 *
 * - alguém devolve `role="status"` ao `QueueIndicator`, e a posição passa a
 *   competir com a linha de contexto por anúncio;
 * - alguém move a região viva para dentro dos cartões, e as quatro fases sem
 *   cartão ficam mudas.
 */
describe('008/FR-013 — a posição na fila tem um anúncio só por tela', () => {
  const doisDestinos = () => {
    useAppStore.setState({
      credentials: makeCredentials({ spotify: CLIENT_ID, youtube: YT_CLIENT_ID }),
      sessions: makeSessions({
        spotify: makeSession('spotify'),
        youtube: makeSession('youtube'),
      }),
      destinations: { selected: ['spotify', 'youtube'], locked: true },
    });
  };

  /**
   * A posição na fila, na forma exata em que o produto a escreve.
   *
   * O travessão é o que distingue "YouTube — 2 de 2" de "cerca de 2% do
   * orçamento diário", que um `de 2` solto encontraria — e um falso positivo
   * aqui faria a asserção medir a frase errada e passar por acidente.
   */
  const POSICAO = /—\s*\d+\s+de\s+\d+/u;

  /**
   * Elementos **na árvore de acessibilidade** cujo texto carrega a posição.
   *
   * Conta os nós folha que contêm a posição e que não estão sob `aria-hidden` —
   * é a pergunta que FR-013 faz de verdade: quantas vezes quem usa leitor de
   * tela ouve "2 de 2" ao percorrer esta tela.
   */
  function portadoresDaPosicao(container: HTMLElement): string[] {
    return [...container.querySelectorAll('p, span, div')]
      .filter((node) => POSICAO.test(node.textContent ?? ''))
      .filter((node) => node.querySelector('p, span, div') === null)
      .filter((node) => node.closest('[aria-hidden="true"]') === null)
      .map((node) => node.textContent ?? '');
  }

  /** Regiões vivas cujo texto contém a posição na fila. */
  function regioesVivasComPosicao(container: HTMLElement): string[] {
    return [...container.querySelectorAll('[role="status"], [aria-live]')]
      .filter((node) => POSICAO.test(node.textContent ?? ''))
      .map((node) => node.textContent ?? '');
  }

  it('a fase de orçamento traz a posição uma única vez, e ela é lida', async () => {
    doisDestinos();
    useAppStore.setState({
      step: 'service',
      lines: linhas,
      queue: makeQueue(['spotify', 'youtube'], {
        currentIndex: 1,
        runs: {
          youtube: makeRun('youtube', {
            phase: 'estimate',
            lineIds: linhas.map((linha) => linha.id),
            estimate: {
              provider: 'youtube',
              lineCount: linhas.length,
              selectedCount: linhas.length,
              estimatedUnits: 200,
              availableUnits: 10_000,
              maxLinesThatFit: 50,
              blocked: false,
              retryReserve: 0,
            },
          }),
        },
      }),
    });

    const { container } = render(
      <Shell>
        <QuotaEstimateScreen provider="youtube" />
      </Shell>,
    );

    // Um portador, e ele é o cabeçalho do cartão: aqui a linha de contexto diz
    // "· Conferindo o orçamento" e **não** repete a posição, então esconder o
    // cabeçalho a deixaria sem anúncio nenhum.
    expect(portadoresDaPosicao(container)).toHaveLength(1);

    // E nenhuma região viva a repete: quem anuncia troca de serviço é a linha
    // de contexto, e duas regiões vivas competiriam pelo mesmo anúncio.
    expect(regioesVivasComPosicao(container)).toEqual([]);
  });

  it.each(['connect', 'awaiting_reauth', 'search', 'review'] as const)(
    'a fase %s — sem cartão no arquivo — ainda assim anuncia a posição',
    (phase) => {
      // Nestas quatro fases o arquivo de design **não** desenha cabeçalho de
      // cartão: a linha de contexto é o único lugar em que a posição aparece, e
      // é ali que ela precisa ser anunciada. Sem esta asserção, mover a região
      // viva para dentro dos cartões deixaria metade do ciclo mudo.
      doisDestinos();
      useAppStore.setState({
        step: 'service',
        queue: makeQueue(['spotify', 'youtube'], {
          currentIndex: 1,
          runs: { youtube: makeRun('youtube', { phase }) },
        }),
      });

      const { container } = render(
        <Shell>
          <p>conteúdo da fase</p>
        </Shell>,
      );

      expect(
        regioesVivasComPosicao(container),
        `a fase ${phase} não anuncia a posição`,
      ).toHaveLength(1);
      expect(portadoresDaPosicao(container), `a fase ${phase} repete a posição`).toHaveLength(1);
    },
  );

  it('o QueueIndicator deixou de ser região viva', () => {
    // A asserção que trava a regressão pelo caminho mais curto: quem anuncia
    // troca de serviço é a linha de contexto. Ele continua **legível** — não é
    // `aria-hidden` —, porque nas telas em que aparece é o único portador.
    doisDestinos();
    useAppStore.setState({ queue: makeQueue(['spotify', 'youtube'], { currentIndex: 0 }) });

    const { container } = render(<QueueIndicator />);
    const raiz = container.firstElementChild;

    expect(raiz?.getAttribute('role')).toBeNull();
    expect(raiz?.getAttribute('aria-label')).toBeNull();
    expect(raiz?.getAttribute('aria-hidden')).toBeNull();
  });
});
