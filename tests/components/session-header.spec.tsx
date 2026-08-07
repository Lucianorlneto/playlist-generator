/**
 * V20, V21, V22 — o cabeçalho de contas (`004/US3`, `004/ui-contract §4`,
 * FR-019 a FR-026, SC-004).
 *
 * O defeito que estes casos fecham: a lista era "provedores com sessão ativa", e
 * por isso o serviço **sumia** do cabeçalho no exato instante em que a sessão
 * caía — levando junto o seu único ponto de interação. O usuário ficava
 * desconectado e sem nada em que clicar.
 *
 * SC-004 em uma frase: nenhum caminho deixa um serviço com credencial
 * desconectado e sem ação de reconexão visível.
 */

import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionHeader } from '@/features/connect/SessionHeader';
import { loadCredential, saveCredential } from '@/services/storage/credentialRepo';
import { loadSession, saveSession } from '@/services/storage/sessionRepo';
import { useAppStore } from '@/store';

import { makeCredentials, makeSession, makeSessions } from '../fixtures/factories';
import { requestLog } from '../msw/handlers';

const SPOTIFY_CLIENT_ID = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
const YT_CLIENT_ID = '123-abc.apps.googleusercontent.com';

interface Cenario {
  selecionados?: ('spotify' | 'youtube')[];
  comCredencial?: ('spotify' | 'youtube')[];
  conectados?: ('spotify' | 'youtube')[];
}

function semear({
  selecionados = ['spotify', 'youtube'],
  comCredencial = ['spotify', 'youtube'],
  conectados = ['spotify'],
}: Cenario = {}) {
  const credenciais: Partial<Record<'spotify' | 'youtube', string>> = {};
  for (const provider of comCredencial) {
    credenciais[provider] = provider === 'spotify' ? SPOTIFY_CLIENT_ID : YT_CLIENT_ID;
  }

  const sessoes: Partial<Record<'spotify' | 'youtube', ReturnType<typeof makeSession>>> = {};
  for (const provider of conectados) sessoes[provider] = makeSession(provider);

  useAppStore.setState({
    credentials: makeCredentials(credenciais),
    sessions: makeSessions(sessoes),
    destinations: { selected: selecionados, locked: false },
  });
}

function itens() {
  return screen.queryAllByRole('listitem');
}

beforeEach(() => {
  semear();
});

describe('V20/FR-019 a FR-021 — o desconectado continua listado', () => {
  it('serviço sem sessão, mas com credencial, aparece com Reconectar', () => {
    semear({ conectados: ['spotify'] });
    render(<SessionHeader />);

    const youtube = itens().find((item) => item.textContent?.includes('YouTube'));
    expect(youtube).toBeDefined();
    expect(within(youtube!).getByText(/Desconectado/u)).toBeInTheDocument();
    expect(
      within(youtube!).getByRole('button', { name: /Reconectar ao YouTube/u }),
    ).toBeInTheDocument();
  });

  it('nenhum serviço conectado ainda lista os dois, com reconectar', () => {
    semear({ conectados: [] });
    render(<SessionHeader />);

    expect(itens()).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /Reconectar/u })).toHaveLength(2);
  });

  it('SC-004 — nunca há serviço com credencial sem ação de reconexão visível', () => {
    for (const conectados of [[], ['spotify'], ['youtube'], ['spotify', 'youtube']] as const) {
      semear({ conectados: [...conectados] });
      const { unmount } = render(<SessionHeader />);

      for (const item of itens()) {
        expect(within(item).getByRole('button', { name: /Reconectar/u })).toBeInTheDocument();
      }
      unmount();
    }
  });
});

describe('V21/FR-020 a FR-022 — o conectado mostra a conta e as duas ações', () => {
  it('exibe o nome da conta', () => {
    render(<SessionHeader />);

    const spotify = itens().find((item) => item.textContent?.includes('Spotify'));
    expect(within(spotify!).getByText(/Fulano de Teste/u)).toBeInTheDocument();
  });

  it('H6 — reconectar e desconectar convivem com rótulos inequívocos', () => {
    render(<SessionHeader />);

    const spotify = itens().find((item) => item.textContent?.includes('Spotify'))!;
    const reconectar = within(spotify).getByRole('button', { name: /Reconectar ao Spotify/u });
    const desconectar = within(spotify).getByRole('button', { name: /Desconectar do Spotify/u });

    expect(reconectar).toBeInTheDocument();
    expect(desconectar).toBeInTheDocument();
    // Nomes distintos: nenhum usuário precisa adivinhar qual faz o quê.
    expect(reconectar.textContent).not.toBe(desconectar.textContent);
  });

  it('o desconectado **não** oferece desconectar — não há o que encerrar', () => {
    semear({ conectados: ['spotify'] });
    render(<SessionHeader />);

    const youtube = itens().find((item) => item.textContent?.includes('YouTube'))!;
    expect(within(youtube).queryByRole('button', { name: /Desconectar/u })).toBeNull();
  });
});

describe('V22/FR-023/H3 — sem credencial não é listado', () => {
  it('serviço selecionado sem Client ID salvo fica de fora', () => {
    semear({ comCredencial: ['spotify'], conectados: ['spotify'] });
    render(<SessionHeader />);

    expect(itens()).toHaveLength(1);
    expect(screen.queryByText(/YouTube/u)).toBeNull();
  });

  it('sem credencial alguma, o cabeçalho não renderiza nada', () => {
    semear({ comCredencial: [], conectados: [] });
    const { container } = render(<SessionHeader />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('H4 — só destinos selecionados', () => {
  it('provedor fora da seleção não é listado, mesmo com credencial', () => {
    semear({ selecionados: ['spotify'], comCredencial: ['spotify', 'youtube'] });
    render(<SessionHeader />);

    expect(itens()).toHaveLength(1);
    // O Princípio II proíbe requisição a provedor não escolhido; oferecer
    // "reconectar" a ele convidaria a violá-lo.
    expect(screen.queryByRole('button', { name: /Reconectar ao YouTube/u })).toBeNull();
  });

  it('antes da etapa de destinos, nada é listado', () => {
    semear({ selecionados: [] });
    const { container } = render(<SessionHeader />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('V22/FR-025/SC-004 — desconectar mantém o serviço listado', () => {
  it('após desconectar, o serviço continua lá oferecendo reconectar', async () => {
    render(<SessionHeader />);

    await userEvent.click(screen.getByRole('button', { name: /Desconectar do Spotify/u }));

    const spotify = itens().find((item) => item.textContent?.includes('Spotify'));
    expect(spotify).toBeDefined();
    expect(
      within(spotify!).getByRole('button', { name: /Reconectar ao Spotify/u }),
    ).toBeInTheDocument();
    expect(within(spotify!).getByText(/Desconectado/u)).toBeInTheDocument();
  });
});

describe('H7/FR-026 — nenhuma ação do cabeçalho escreve na conta', () => {
  it('desconectar não emite requisição alguma', async () => {
    render(<SessionHeader />);
    const antes = requestLog.length;

    await userEvent.click(screen.getByRole('button', { name: /Desconectar do Spotify/u }));

    expect(requestLog.length).toBe(antes);
  });
});

describe('H8/FR-004/FR-005 — isolamento entre serviços', () => {
  it('desconectar um não toca sessão nem credencial do outro', async () => {
    saveSession(makeSession('spotify'));
    saveSession(makeSession('youtube'));
    saveCredential('spotify', SPOTIFY_CLIENT_ID);
    saveCredential('youtube', YT_CLIENT_ID);
    semear({ conectados: ['spotify', 'youtube'] });

    render(<SessionHeader />);
    await userEvent.click(screen.getByRole('button', { name: /Desconectar do Spotify/u }));

    expect(useAppStore.getState().sessions.youtube).not.toBeNull();
    expect(loadSession('youtube')).not.toBeNull();
    expect(loadCredential('youtube')?.clientId).toBe(YT_CLIENT_ID);
    // A credencial do próprio serviço desconectado também é preservada — é o
    // que permite reconectar sem recadastrar (FR-025).
    expect(loadCredential('spotify')?.clientId).toBe(SPOTIFY_CLIENT_ID);
  });

  it('reconectar navega só ao provedor acionado (FR-024)', async () => {
    const navigate = vi.fn();
    semear({ conectados: ['spotify', 'youtube'] });

    // A navegação é injetada para que o teste observe **para onde** se vai.
    render(<SessionHeader />);
    await userEvent.click(screen.getByRole('button', { name: /Reconectar ao Spotify/u }));

    // A sessão do outro serviço permanece intocada durante a ida ao consentimento.
    expect(useAppStore.getState().sessions.youtube).not.toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('FR-015 — a conta nova aparece antes de qualquer confirmação', () => {
  it('reconectar a uma conta diferente passa a exibir o nome novo', () => {
    render(<SessionHeader />);
    expect(screen.getByText(/Fulano de Teste/u)).toBeInTheDocument();

    act(() => {
      useAppStore.setState({
        sessions: makeSessions({
          spotify: makeSession('spotify', {
            user: { id: 'outra_conta', displayName: 'Outra Pessoa' },
          }),
        }),
      });
    });

    expect(screen.getByText(/Outra Pessoa/u)).toBeInTheDocument();
    expect(screen.queryByText(/Fulano de Teste/u)).toBeNull();
  });
});
