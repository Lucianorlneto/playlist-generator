/**
 * Pular um serviço (`006/US1`, `US2`).
 *
 * O defeito que este arquivo prende foi medido na Fase 0 e é pior do que o
 * relato: pular deixava a etapa exibindo a **mesma** execução, agora encerrada e
 * sem resultado, que `ResultScreen` apresenta como "Criando playlist no
 * {serviço}…". Com destino único, o único botão oferecido ali levava a uma tela
 * **em branco**, sem cabeçalho e sem saída (`006/research §1`, §2).
 *
 * Todos os casos abaixo montam a etapa real e clicam no botão real. Verificar
 * `skipService` direto no store provaria a ação e não a tela — e a tela é onde o
 * defeito morava.
 */

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ServiceStep } from '@/features/service/ServiceStep';
import { format, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';

import {
  makeAwaitingReauth,
  makeCredentials,
  makeItem,
  makeLine,
  makeQueue,
  makeRun,
  makeSessions,
} from '../fixtures/factories';

const SPOTIFY = 'Spotify';
const YOUTUBE = 'YouTube';

const linha = makeLine({ id: 'l0', index: 0 });

function semear(
  order: ('spotify' | 'youtube')[],
  runs: Partial<Record<'spotify' | 'youtube', ReturnType<typeof makeRun>>>,
  extra: Partial<Parameters<typeof useAppStore.setState>[0]> = {},
) {
  useAppStore.setState({
    step: 'service',
    stepToken: 0,
    rawText: 'Bohemian Rhapsody - Queen',
    lines: [linha],
    credentials: makeCredentials({ spotify: 'abc', youtube: 'x.apps.googleusercontent.com' }),
    // Sem sessão: mantém a execução parada em `connect`, que é o único jeito de
    // exercitar o botão de pular sem a etapa avançar sozinha.
    sessions: makeSessions({}),
    destinations: { selected: order, locked: true },
    queue: makeQueue(order, { currentIndex: 0, runs }),
    authError: null,
    ...extra,
  });
}

function botaoPular(service: string) {
  return screen.getByRole('button', { name: format(t.queue.skipService, { service }) });
}

describe('V14 — a transição entre serviços move o foco (FR-024)', () => {
  /**
   * O token de etapa só era incrementado quando a **etapa** mudava, e passar de
   * um serviço para o outro acontece dentro da etapa `service`. Medido na Fase 0:
   * `stepToken: 0` depois de `advance()`. Quem usa leitor de tela trocava de
   * serviço sem que nada fosse anunciado — hoje, não só depois desta feature
   * (`006/research §7`).
   */
  it('advance incrementa o token de etapa', () => {
    semear(['spotify', 'youtube'], {
      spotify: makeRun('spotify', { phase: 'connect', lineIds: [linha.id] }),
      youtube: makeRun('youtube', { phase: 'pending', lineIds: [linha.id] }),
    });

    useAppStore.getState().dispatchRun({ type: 'skipped' }, 'spotify');
    useAppStore.getState().advance();

    expect(useAppStore.getState().stepToken).toBe(1);
  });

  it('o cabeçalho da tela que entra recebe o foco', () => {
    semear(['spotify', 'youtube'], {
      spotify: makeRun('spotify', { phase: 'connect', lineIds: [linha.id] }),
      youtube: makeRun('youtube', { phase: 'pending', lineIds: [linha.id] }),
    });
    render(<ServiceStep />);

    // Tira o foco do cabeçalho, para que voltar a ele signifique alguma coisa.
    botaoPular(SPOTIFY).focus();
    expect(botaoPular(SPOTIFY)).toHaveFocus();

    act(() => {
      useAppStore.getState().dispatchRun({ type: 'skipped' }, 'spotify');
      useAppStore.getState().advance();
    });

    expect(
      screen.getByRole('heading', { name: format(t.connect.heading, { service: YOUTUBE }) }),
    ).toHaveFocus();
  });
});

/**
 * V2 — pular com destino seguinte (`006/FR-002`, FR-004, FR-007, FR-008).
 *
 * As fases exercitadas aqui são as que um destino **não-último** pode ocupar:
 * `connect`, `search`/`review` e `awaiting_reauth`.
 *
 * `estimate` fica de fora por construção, não por esquecimento: só provedor com
 * orçamento diário tem essa fase, e a ordem de execução é fixa com o YouTube em
 * último. Pular na estimativa é sempre pular o último destino, e por isso está
 * coberto em V4, no caminho de US2.
 */
describe('V2 — pular com destino seguinte leva à primeira fase dele', () => {
  const fases = [
    {
      nome: 'connect',
      run: () => makeRun('spotify', { phase: 'connect', lineIds: [linha.id] }),
    },
    {
      nome: 'review',
      run: () =>
        makeRun('spotify', {
          phase: 'review',
          lineIds: [linha.id],
          items: [makeItem({ line: linha })],
        }),
    },
    {
      nome: 'awaiting_reauth',
      run: () => makeAwaitingReauth('spotify', 'search', { lineIds: [linha.id] }),
    },
  ] as const;

  it.each(fases)('a partir de $nome', async ({ run }) => {
    semear(['spotify', 'youtube'], {
      spotify: run(),
      youtube: makeRun('youtube', { phase: 'pending', lineIds: [linha.id] }),
    });
    render(<ServiceStep />);

    await userEvent.click(botaoPular(SPOTIFY));

    // Chegou na conexão do segundo destino…
    expect(
      screen.getByRole('heading', { name: format(t.connect.heading, { service: YOUTUBE }) }),
    ).toBeInTheDocument();
    // …num clique só, sem diálogo (FR-012)…
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // …e sem nunca ter mostrado a criação do destino pulado (FR-004, FR-007).
    expect(
      screen.queryByText(format(t.playlistConfig.creating, { service: SPOTIFY })),
    ).not.toBeInTheDocument();
    expect(useAppStore.getState().queue.currentIndex).toBe(1);
  });

  it('nada é escrito na conta do destino pulado (FR-009)', async () => {
    semear(['spotify', 'youtube'], {
      spotify: makeRun('spotify', {
        phase: 'review',
        lineIds: [linha.id],
        items: [makeItem({ line: linha })],
      }),
      youtube: makeRun('youtube', { phase: 'pending', lineIds: [linha.id] }),
    });
    render(<ServiceStep />);

    await userEvent.click(botaoPular(SPOTIFY));

    const spotify = useAppStore.getState().queue.runs.spotify;
    expect(spotify?.outcome).toBe('skipped');
    expect(spotify?.result).toBeNull();
    expect(spotify?.creation).toBeNull();
  });
});

/**
 * V2b/FR-010 — o relato de quem já terminou sobrevive ao pulo do seguinte.
 *
 * É o sexto ponto de pulo, o único que já funcionava antes desta feature: o
 * botão que dispensa o **próximo** destino a partir da tela de resultado.
 */
describe('V2b — pular o próximo destino preserva o relato do anterior (FR-010)', () => {
  it('o resultado do primeiro continua íntegro e o fluxo vai ao resumo', async () => {
    const concluido = makeRun('spotify', {
      phase: 'done',
      outcome: 'completed',
      lineIds: [linha.id],
      result: {
        provider: 'spotify',
        playlistId: 'pl-1',
        playlistUrl: 'https://open.spotify.com/playlist/pl-1',
        playlistName: 'Clássicos',
        effectivePath: 'Sua Biblioteca / Clássicos',
        addedCount: 1,
        skippedCount: 0,
        failedLines: [],
        failedIndices: [],
        incompleteByQuota: false,
      },
    });
    semear(['spotify', 'youtube'], {
      spotify: concluido,
      youtube: makeRun('youtube', { phase: 'pending', lineIds: [linha.id] }),
    });
    render(<ServiceStep />);

    await userEvent.click(botaoPular(YOUTUBE));

    const estado = useAppStore.getState();
    expect(estado.queue.runs.spotify?.outcome).toBe('completed');
    expect(estado.queue.runs.spotify?.result).toEqual(concluido.result);
    expect(estado.queue.runs.youtube?.outcome).toBe('skipped');
    expect(estado.step).toBe('summary');
  });
});

/**
 * V3 — pular o **último** destino sem nada a relatar (`006/FR-004`, FR-005,
 * FR-007).
 *
 * É o cenário do beco sem saída medido na Fase 0: com destino único, pular
 * levava a "Criando playlist no Spotify…" e o único botão de lá levava a uma
 * tela **em branco**, sem cabeçalho e sem botão, com o trabalho preservado e
 * inalcançável. Só recarregando (`006/research §2`).
 */
describe('V3 — último destino, nada rodou: confirma e descarta', () => {
  it('pedir para pular abre a confirmação, sem descartar ainda (FR-005)', async () => {
    semear(['spotify'], {
      spotify: makeRun('spotify', { phase: 'connect', lineIds: [linha.id] }),
    });
    render(<ServiceStep />);

    await userEvent.click(botaoPular(SPOTIFY));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // Nada aconteceu ainda: o destino não foi pulado e o trabalho está inteiro.
    expect(useAppStore.getState().queue.runs.spotify?.outcome).toBeNull();
    expect(useAppStore.getState().rawText).not.toBe('');
  });

  it('confirmar descarta e leva à seleção de serviços, sem tela em branco', async () => {
    semear(['spotify'], {
      spotify: makeRun('spotify', { phase: 'connect', lineIds: [linha.id] }),
    });
    const { container } = render(<ServiceStep />);

    await userEvent.click(botaoPular(SPOTIFY));
    await userEvent.click(screen.getByRole('button', { name: t.common.discard }));

    const estado = useAppStore.getState();
    expect(estado.step).toBe('destinations');
    expect(estado.rawText).toBe('');
    expect(estado.lines).toHaveLength(0);
    expect(estado.queue.order).toHaveLength(0);
    // A etapa de serviço deixa de ter conteúdo porque a etapa mudou — o que o
    // usuário vê é a tela de seleção, montada pelo Wizard. O que não pode
    // acontecer é a criação do destino pulado aparecer no caminho.
    expect(container.querySelector('h2')?.textContent ?? '').not.toBe(
      format(t.playlistConfig.creating, { service: SPOTIFY }),
    );
  });

  it('a tela de criação do destino pulado nunca aparece (FR-007)', async () => {
    semear(['spotify'], {
      spotify: makeRun('spotify', {
        phase: 'review',
        lineIds: [linha.id],
        items: [makeItem({ line: linha })],
      }),
    });
    render(<ServiceStep />);

    await userEvent.click(botaoPular(SPOTIFY));
    expect(
      screen.queryByText(format(t.playlistConfig.creating, { service: SPOTIFY })),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: t.common.discard }));
    expect(
      screen.queryByText(format(t.playlistConfig.creating, { service: SPOTIFY })),
    ).not.toBeInTheDocument();
  });

  it('dois destinos, ambos pulados: o segundo também descarta', async () => {
    semear(['spotify', 'youtube'], {
      spotify: makeRun('spotify', { phase: 'skipped', outcome: 'skipped', lineIds: [linha.id] }),
      youtube: makeRun('youtube', { phase: 'connect', lineIds: [linha.id] }),
    });
    useAppStore.setState((state) => ({ queue: { ...state.queue, currentIndex: 1 } }));
    render(<ServiceStep />);

    await userEvent.click(botaoPular(YOUTUBE));
    await userEvent.click(screen.getByRole('button', { name: t.common.discard }));

    expect(useAppStore.getState().step).toBe('destinations');
    expect(useAppStore.getState().rawText).toBe('');
  });
});

/**
 * V4 — pular o último destino quando **algo rodou** (`006/FR-003`, FR-012).
 *
 * A fronteira é "rodou", não "deu certo": `partial` e `failed` levam ao resumo
 * tanto quanto `completed`. E aqui **não** há confirmação nem descarte — o
 * trabalho segue vivo até o "Começar uma nova playlist" do resumo.
 *
 * Este bloco é também onde a fase `estimate` é exercitada. Ela só existe para
 * provedor com orçamento diário, e a ordem de execução é fixa com o YouTube em
 * último — logo, pular na estimativa é sempre pular o último destino.
 */
describe('V4 — último destino com algo já rodado leva ao resumo', () => {
  const anteriores = ['completed', 'partial', 'failed'] as const;

  it.each(anteriores)('primeiro destino %s → resumo, sem diálogo', async (outcome) => {
    semear(['spotify', 'youtube'], {
      spotify: makeRun('spotify', {
        phase: outcome === 'failed' ? 'failed' : 'done',
        outcome,
        lineIds: [linha.id],
      }),
      youtube: makeRun('youtube', { phase: 'connect', lineIds: [linha.id] }),
    });
    useAppStore.setState((state) => ({ queue: { ...state.queue, currentIndex: 1 } }));
    render(<ServiceStep />);

    await userEvent.click(botaoPular(YOUTUBE));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const estado = useAppStore.getState();
    expect(estado.step).toBe('summary');
    expect(estado.queue.runs.youtube?.outcome).toBe('skipped');
    // Nada foi descartado.
    expect(estado.rawText).not.toBe('');
    expect(estado.lines).toHaveLength(1);
  });

  it('pular na fase de estimativa segue a mesma regra', async () => {
    semear(['spotify', 'youtube'], {
      spotify: makeRun('spotify', { phase: 'done', outcome: 'completed', lineIds: [linha.id] }),
      youtube: makeRun('youtube', {
        phase: 'estimate',
        lineIds: [linha.id],
        estimate: {
          provider: 'youtube',
          selectedCount: 1,
          lineCount: 1,
          estimatedUnits: 100,
          availableUnits: 10_000,
          maxLinesThatFit: 100,
          retryReserve: 0,
          blocked: false,
        },
      }),
    });
    useAppStore.setState((state) => ({ queue: { ...state.queue, currentIndex: 1 } }));
    render(<ServiceStep />);

    await userEvent.click(
      screen.getByRole('button', {
        name: format(t.quota.skipDestination, { service: YOUTUBE }),
      }),
    );

    expect(useAppStore.getState().step).toBe('summary');
    expect(useAppStore.getState().queue.runs.youtube?.outcome).toBe('skipped');
  });
});

/**
 * V5 — recusar a confirmação não muda nada (`006/FR-005`, FR-020, SC-007,
 * SC-009).
 */
describe('V5 — recusar a confirmação preserva tudo', () => {
  async function abrir() {
    semear(['spotify'], {
      spotify: makeRun('spotify', { phase: 'connect', lineIds: [linha.id] }),
    });
    render(<ServiceStep />);
    await userEvent.click(botaoPular(SPOTIFY));
    return useAppStore.getState();
  }

  it('cancelar deixa etapa, fase, fila e trabalho idênticos', async () => {
    const antes = await abrir();

    await userEvent.click(screen.getByRole('button', { name: t.common.cancel }));

    const depois = useAppStore.getState();
    expect(depois.step).toBe(antes.step);
    expect(depois.queue.runs.spotify?.phase).toBe('connect');
    expect(depois.queue.runs.spotify?.outcome).toBeNull();
    expect(depois.rawText).toBe(antes.rawText);
    expect(depois.lines).toEqual(antes.lines);
  });

  it('fechar por Esc também não descarta', async () => {
    await abrir();

    await userEvent.keyboard('{Escape}');

    expect(useAppStore.getState().queue.runs.spotify?.outcome).toBeNull();
    expect(useAppStore.getState().rawText).not.toBe('');
  });

  it('o foco volta ao botão que abriu o diálogo', async () => {
    await abrir();

    await userEvent.click(screen.getByRole('button', { name: t.common.cancel }));

    expect(botaoPular(SPOTIFY)).toHaveFocus();
  });
});
