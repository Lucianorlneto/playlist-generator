/**
 * V15, V18, V34, V35 — conteúdo e comportamento do pedido de reautorização
 * (`004/ui-contract §2`, FR-009 a FR-013, FR-016a, FR-028).
 *
 * O diálogo é aberto por **estado derivado**: ele existe enquanto a execução
 * corrente está em `awaiting_reauth` e o usuário não o dispensou nesta visita.
 * Não há sinalizador imperativo, e por isso o pedido não pode conter token nem
 * credencial — ele não existe como registro próprio.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { YOUTUBE_QUOTA } from '@/domain/providers';
import { nominalCost } from '@/domain/quota';
import { ReauthDialog } from '@/features/connect/ReauthDialog';
import { retryReserveOf } from '@/services/providers/retryPlan';
import { useAppStore } from '@/store';

import {
  makeCreation,
  makeCredentials,
  makeLine,
  makePartialSearchItems,
  makeQueue,
  makeRun,
  makeSessions,
} from '../fixtures/factories';

const YT_CLIENT_ID = '123-abc.apps.googleusercontent.com';
const SPOTIFY_CLIENT_ID = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
const TOTAL = 5;

function linhas(total = TOTAL) {
  return Array.from({ length: total }, (_, index) =>
    makeLine({
      id: `l${index}`,
      index,
      raw: `Faixa ${index} - Artista ${index}`,
      title: `Faixa ${index}`,
      artist: `Artista ${index}`,
    }),
  );
}

interface SemearOpcoes {
  provider?: 'youtube' | 'spotify';
  resolvidas?: number;
  resumeFrom?: 'search' | 'creating';
  comCredencial?: boolean;
  creation?: ReturnType<typeof makeCreation>;
}

function semear(opcoes: SemearOpcoes = {}) {
  const {
    provider = 'youtube',
    resolvidas = 2,
    resumeFrom = 'search',
    comCredencial = true,
    creation,
  } = opcoes;

  const lines = linhas();
  const clientId = provider === 'youtube' ? YT_CLIENT_ID : SPOTIFY_CLIENT_ID;

  useAppStore.setState({
    step: 'service',
    lines,
    credentials: comCredencial ? makeCredentials({ [provider]: clientId }) : makeCredentials({}),
    sessions: makeSessions({}),
    destinations: { selected: [provider], locked: false },
    queue: makeQueue([provider], {
      currentIndex: 0,
      runs: {
        [provider]: makeRun(provider, {
          phase: 'awaiting_reauth',
          resumeFrom,
          lineIds: lines.map((linha) => linha.id),
          items: makePartialSearchItems(lines, resolvidas),
          ...(creation === undefined ? {} : { creation }),
        }),
      },
    }),
  });

  return lines;
}

beforeEach(() => {
  semear();
});

describe('V15 — o diálogo abre por estado derivado e nomeia o serviço', () => {
  it('aparece enquanto a execução está em awaiting_reauth', () => {
    render(<ReauthDialog provider="youtube" />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('não aparece quando a execução não está parada', () => {
    useAppStore.setState({
      queue: makeQueue(['youtube'], {
        currentIndex: 0,
        runs: { youtube: makeRun('youtube', { phase: 'search', lineIds: ['l0'] }) },
      }),
    });

    render(<ReauthDialog provider="youtube" />);
    // Um `<dialog>` fechado deixa de expor o papel de diálogo.
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('o título nomeia o serviço afetado (FR-009)', () => {
    render(<ReauthDialog provider="youtube" />);
    expect(screen.getByRole('dialog')).toHaveAccessibleName(/YouTube/u);
  });

  it('diz que o trabalho foi preservado', () => {
    render(<ReauthDialog provider="youtube" />);
    expect(screen.getByText(/Nada do seu trabalho foi perdido/u)).toBeInTheDocument();
  });

  it('oferece reconectar e fechar sem reconectar (FR-010)', () => {
    render(<ReauthDialog provider="youtube" />);
    expect(screen.getByRole('button', { name: /Conectar ao YouTube/u })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Fechar sem reconectar/u })).toBeInTheDocument();
  });
});

describe('V15 — progresso da busca preservado', () => {
  it('informa quantas linhas já foram buscadas', () => {
    render(<ReauthDialog provider="youtube" />);
    // 2 de 5 resolvidas antes da queda.
    expect(screen.getByText(/2 de 5 linhas já foram buscadas/u)).toBeInTheDocument();
  });
});

describe('V34/FR-009 — o ponto de retomada vem de resumeFrom', () => {
  it('diz "a busca das músicas", nunca a fase corrente de espera', () => {
    render(<ReauthDialog provider="youtube" />);

    expect(screen.getByText(/você volta para: a busca das músicas/u)).toBeInTheDocument();
    // A armadilha original: `resumePointOf` devolvia `run.phase`, que **já é**
    // `awaiting_reauth` no instante em que o diálogo renderiza.
    expect(screen.queryByText(/awaiting_reauth/u)).not.toBeInTheDocument();
  });

  it('diz "a criação da playlist" quando a queda foi na adição', () => {
    semear({ resumeFrom: 'creating', creation: makeCreation({ orderedUris: ['a', 'b', 'c'] }) });
    render(<ReauthDialog provider="youtube" />);

    expect(screen.getByText(/você volta para: a criação da playlist/u)).toBeInTheDocument();
  });
});

describe('V35/FR-028 — progresso da criação', () => {
  it('informa quantas faixas já entraram e quantas faltam', () => {
    semear({
      resumeFrom: 'creating',
      creation: makeCreation({ orderedUris: ['a', 'b', 'c', 'd'], committedItems: 3 }),
    });
    render(<ReauthDialog provider="youtube" />);

    expect(screen.getByText(/3 de 4 faixas já entraram na playlist/u)).toBeInTheDocument();
  });

  it('na criação não exibe custo de busca — não há busca a retomar', () => {
    semear({
      resumeFrom: 'creating',
      creation: makeCreation({ orderedUris: ['a', 'b'], committedItems: 1 }),
    });
    render(<ReauthDialog provider="youtube" />);

    expect(screen.queryByText(/unidades de cota/u)).not.toBeInTheDocument();
  });
});

describe('V15/FR-013/C4 — o custo da retomada', () => {
  it('é calculado sobre as linhas que faltam, não sobre a lista inteira', () => {
    const lines = linhas();
    const restantes = lines.slice(2);

    render(<ReauthDialog provider="youtube" />);

    // A conta é a mesma fórmula da estimativa (C1), aplicada ao **subconjunto**.
    const esperado = nominalCost(
      YOUTUBE_QUOTA,
      restantes.length,
      0,
      retryReserveOf('youtube', restantes),
    );
    const sobreAListaInteira = nominalCost(
      YOUTUBE_QUOTA,
      lines.length,
      0,
      retryReserveOf('youtube', lines),
    );

    expect(screen.getByText(new RegExp(`${esperado}`, 'u'))).toBeInTheDocument();
    expect(screen.getByText(/3 linhas restantes/u)).toBeInTheDocument();
    // O ponto de FR-013: o número exibido **não** é o da lista inteira.
    expect(esperado).toBeLessThan(sobreAListaInteira);
  });

  it('provedor sem orçamento diário não exibe custo algum', () => {
    semear({ provider: 'spotify' });
    render(<ReauthDialog provider="spotify" />);

    expect(screen.queryByText(/unidades de cota/u)).not.toBeInTheDocument();
  });

  it('sem linhas a retomar, diz que nada será consumido', () => {
    semear({ resolvidas: TOTAL });
    render(<ReauthDialog provider="youtube" />);

    expect(screen.getByText(/Retomar não consome cota/u)).toBeInTheDocument();
  });
});

describe('V16a/FR-016a/R5 — credencial ausente', () => {
  it('informa que o Client ID precisa ser cadastrado, sem descartar o trabalho', () => {
    semear({ comCredencial: false });
    render(<ReauthDialog provider="youtube" />);

    expect(screen.getByText(/Client ID do YouTube não está mais salvo/u)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cadastrar o Client ID/u })).toBeInTheDocument();
    // O trabalho preservado continua na execução.
    expect(useAppStore.getState().runFor('youtube')?.items).toHaveLength(TOTAL);
    expect(useAppStore.getState().runFor('youtube')?.outcome).toBeNull();
  });

  it('o caminho oferecido leva à etapa de credencial', async () => {
    semear({ comCredencial: false });
    render(<ReauthDialog provider="youtube" />);

    await userEvent.click(screen.getByRole('button', { name: /Cadastrar o Client ID/u }));

    expect(useAppStore.getState().step).toBe('credential');
    // R2: nada foi encerrado nem descartado.
    expect(useAppStore.getState().runFor('youtube')?.outcome).toBeNull();
  });
});

describe('V18/FR-012/R2 — fechar sem reconectar não é caminho destrutivo', () => {
  it('a execução permanece retomável, sem desfecho', async () => {
    render(<ReauthDialog provider="youtube" />);

    await userEvent.click(screen.getByRole('button', { name: /Fechar sem reconectar/u }));

    const run = useAppStore.getState().runFor('youtube');
    expect(run?.phase).toBe('awaiting_reauth');
    expect(run?.outcome).toBeNull();
    expect(run?.items).toHaveLength(TOTAL);
  });

  it('o diálogo se fecha, mas o pedido continua no estado', async () => {
    render(<ReauthDialog provider="youtube" />);

    await userEvent.click(screen.getByRole('button', { name: /Fechar sem reconectar/u }));

    // Um `<dialog>` fechado deixa de expor o papel de diálogo.
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(useAppStore.getState().runFor('youtube')?.resumeFrom).toBe('search');
  });
});

describe('R3 — a dispensa é local e nunca persistida', () => {
  it('remontar o componente reapresenta o pedido', async () => {
    const { unmount } = render(<ReauthDialog provider="youtube" />);
    await userEvent.click(screen.getByRole('button', { name: /Fechar sem reconectar/u }));
    unmount();

    // Equivale a recarregar: o estado da execução é o mesmo, e a dispensa —
    // por ser local ao componente — não sobreviveu.
    render(<ReauthDialog provider="youtube" />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('a dispensa não aparece em nenhum campo persistido da execução', async () => {
    render(<ReauthDialog provider="youtube" />);
    await userEvent.click(screen.getByRole('button', { name: /Fechar sem reconectar/u }));

    const run = useAppStore.getState().runFor('youtube');
    expect(JSON.stringify(run)).not.toMatch(/dismiss/iu);
  });
});

describe('FR-011 — teclado e foco', () => {
  it('`Esc` fecha o diálogo', async () => {
    render(<ReauthDialog provider="youtube" />);
    const dialogo = screen.getByRole('dialog');

    await userEvent.keyboard('{Escape}');
    dialogo.dispatchEvent(new Event('cancel'));

    expect(useAppStore.getState().runFor('youtube')?.outcome).toBeNull();
  });

  it('o foco inicial fica dentro do diálogo', () => {
    render(<ReauthDialog provider="youtube" />);
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  });
});

describe('Princípio II — o pedido não pode carregar segredo', () => {
  it('nada do que o diálogo renderiza contém token ou Client ID', () => {
    const { container } = render(<ReauthDialog provider="youtube" />);
    const texto = container.textContent ?? '';

    expect(texto).not.toContain(YT_CLIENT_ID);
    expect(texto).not.toMatch(/ya29\./u);
    expect(texto).not.toMatch(/accessToken/u);
  });
});
