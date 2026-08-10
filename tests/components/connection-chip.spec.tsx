/**
 * O chip de conexão da barra superior (007/US1, FR-007 a FR-009, FR-023, FR-042).
 *
 * Este arquivo **substitui** `tests/components/session-header.spec.tsx`, cujos
 * casos foram migrados um a um. A migração não é renomeação: o chip cobre tudo
 * que o cabeçalho de contas cobria e acrescenta o estado que faltava — **sem
 * credencial** —, que na 004 simplesmente não era exibido.
 *
 * O defeito que a 004 fechou continua fechado aqui, e é o mais importante destes
 * casos: a lista era "provedores com sessão ativa", e o serviço sumia do
 * cabeçalho no exato instante em que a sessão caía, levando junto o seu único
 * ponto de interação. **Nenhum dos três estados é um beco sem saída.**
 */

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { ConnectionChip } from '@/features/connect/ConnectionChip';
import { t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';

import { makeCredentials, makeSession, makeSessions } from '../fixtures/factories';
import { requestLog } from '../msw/handlers';

const SPOTIFY_CLIENT_ID = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
const YT_CLIENT_ID = '123-abc.apps.googleusercontent.com';

type Provider = 'spotify' | 'youtube';

interface Cenario {
  comCredencial?: Provider[];
  conectados?: Provider[];
}

function semear({
  comCredencial = ['spotify', 'youtube'],
  conectados = ['spotify'],
}: Cenario = {}) {
  const credenciais: Partial<Record<Provider, string>> = {};
  for (const provider of comCredencial) {
    credenciais[provider] = provider === 'spotify' ? SPOTIFY_CLIENT_ID : YT_CLIENT_ID;
  }

  const sessoes: Partial<Record<Provider, ReturnType<typeof makeSession>>> = {};
  for (const provider of conectados) sessoes[provider] = makeSession(provider);

  useAppStore.setState({
    credentials: makeCredentials(credenciais),
    sessions: makeSessions(sessoes),
  });
}

beforeEach(() => {
  semear();
});

describe('FR-007 · os três estados existem e cada um oferece uma saída', () => {
  it('conectado: mostra a conta e oferece reconectar', () => {
    render(<ConnectionChip provider="spotify" />);

    expect(screen.getByText(/Fulano de Teste/u)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reconectar a conta do Spotify/u })).toBeInTheDocument();
  });

  it('desconectado, com credencial: diz o estado por extenso e oferece conectar', () => {
    semear({ conectados: [] });
    render(<ConnectionChip provider="spotify" />);

    expect(screen.getByText(t.connectionChip.disconnected)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Conectar a conta do Spotify/u })).toBeInTheDocument();
  });

  it('sem credencial: diz o estado por extenso e oferece configurar', () => {
    semear({ comCredencial: [], conectados: [] });
    render(<ConnectionChip provider="youtube" />);

    expect(screen.getByText(t.connectionChip.noCredential)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Configurar a credencial do YouTube/u }),
    ).toBeInTheDocument();
  });

  it('SC-004 migrado — nenhum estado deixa o chip sem ação visível', () => {
    const cenarios: Cenario[] = [
      { comCredencial: ['spotify'], conectados: ['spotify'] },
      { comCredencial: ['spotify'], conectados: [] },
      { comCredencial: [], conectados: [] },
    ];

    for (const cenario of cenarios) {
      semear(cenario);
      const { unmount } = render(<ConnectionChip provider="spotify" />);
      expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(1);
      unmount();
    }
  });

  it('H6 migrado — desconectar só existe quando há o que encerrar', () => {
    // A ação vinha do `SessionHeader` e foi preservada por FR-063: o arquivo de
    // design não a desenha, mas silêncio do design não é remoção. Sem ela, quem
    // quer trocar de conta fica sem caminho — reconectar leva ao consentimento
    // do provedor, que devolve a sessão já existente.
    semear({ conectados: ['spotify'] });
    const { unmount } = render(<ConnectionChip provider="spotify" />);
    expect(screen.getByRole('button', { name: /Desconectar do Spotify/u })).toBeInTheDocument();
    unmount();

    semear({ conectados: [] });
    render(<ConnectionChip provider="spotify" />);
    expect(screen.queryByRole('button', { name: /Desconectar/u })).toBeNull();
  });

  it('H6 migrado — reconectar e desconectar convivem com nomes inequívocos', () => {
    semear({ conectados: ['spotify'] });
    render(<ConnectionChip provider="spotify" />);

    const reconectar = screen.getByRole('button', { name: /Reconectar a conta do Spotify/u });
    const desconectar = screen.getByRole('button', { name: /Desconectar do Spotify/u });

    // Nomes distintos: nenhum usuário precisa adivinhar qual faz o quê.
    expect(reconectar.textContent).not.toBe(desconectar.textContent);
  });
});

describe('FR-009 · o estado sem credencial nunca exibe identificador de conta', () => {
  it('não mostra nome de conta, nem vazio, nem genérico', () => {
    // O estado `no-credential` significa que **não houve autorização**. Um lugar
    // reservado para a conta — mesmo em branco — sugere que houve, e é uma
    // sugestão que o usuário não tem como desmentir.
    semear({ comCredencial: [], conectados: [] });
    render(<ConnectionChip provider="spotify" />);

    expect(screen.queryByText(/Fulano de Teste/u)).toBeNull();
    expect(screen.queryByText(t.connect.connectedAs)).toBeNull();
  });

  it('mesmo com sessão residual no store, sem credencial não exibe conta', () => {
    // Estado impossível pelo fluxo, mas alcançável por restauração parcial de
    // rascunho. A regra é do estado, não do caminho que levou a ele.
    useAppStore.setState({
      credentials: makeCredentials({}),
      sessions: makeSessions({ spotify: makeSession('spotify') }),
    });
    render(<ConnectionChip provider="spotify" />);

    expect(screen.queryByText(/Fulano de Teste/u)).toBeNull();
    expect(screen.getByText(t.connectionChip.noCredential)).toBeInTheDocument();
  });
});

describe('FR-008 e FR-042 · a distinção não depende de cor', () => {
  it('cada estado escreve o próprio nome, ou o identificador da conta', () => {
    semear({ conectados: [] });
    const { unmount } = render(<ConnectionChip provider="spotify" />);
    expect(screen.getByText(t.connectionChip.disconnected)).toBeInTheDocument();
    unmount();

    semear({ comCredencial: [], conectados: [] });
    render(<ConnectionChip provider="spotify" />);
    expect(screen.getByText(t.connectionChip.noCredential)).toBeInTheDocument();
  });

  it('o rótulo da ação principal difere entre os três estados', () => {
    const rotulos = new Set<string>();
    const cenarios: Cenario[] = [
      { comCredencial: ['spotify'], conectados: ['spotify'] },
      { comCredencial: ['spotify'], conectados: [] },
      { comCredencial: [], conectados: [] },
    ];

    for (const cenario of cenarios) {
      semear(cenario);
      const { unmount } = render(<ConnectionChip provider="spotify" />);
      // A ação principal é a primeira; "Sair" só acompanha o estado conectado.
      rotulos.add(screen.getAllByRole('button')[0]?.textContent ?? '');
      unmount();
    }

    expect(rotulos.size).toBe(3);
  });

  it('o nome acessível do chip resolve o estado por extenso', () => {
    // Quem navega por leitor de tela não vê o ponto colorido. O estado precisa
    // estar no nome, não só na forma do indicador.
    semear({ conectados: [] });
    render(<ConnectionChip provider="youtube" />);

    expect(
      screen.getByLabelText(`YouTube: ${t.connectionChip.disconnected}`),
    ).toBeInTheDocument();
  });
});

describe('FR-007 · dois chips coexistem com estados diferentes', () => {
  it('o desconectado não parece erro ao lado do conectado', () => {
    semear({ conectados: ['spotify'] });
    render(
      <div>
        <ConnectionChip provider="spotify" />
        <ConnectionChip provider="youtube" />
      </div>,
    );

    expect(screen.getByLabelText(`Spotify: ${t.connectionChip.connected}`)).toBeInTheDocument();
    expect(
      screen.getByLabelText(`YouTube: ${t.connectionChip.disconnected}`),
    ).toBeInTheDocument();

    // Nenhum dos dois é anunciado como alerta ou erro: são dois estados
    // legítimos do produto, e o pior deles ainda oferece uma saída.
    expect(screen.queryAllByRole('alert')).toHaveLength(0);
  });

  it('os dois botões de ação são distinguíveis por nome acessível', () => {
    semear({ conectados: [] });
    render(
      <div>
        <ConnectionChip provider="spotify" />
        <ConnectionChip provider="youtube" />
      </div>,
    );

    const nomes = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(new Set(nomes).size).toBe(2);
  });
});

describe('FR-015 migrado · a conta nova aparece antes de qualquer confirmação', () => {
  it('reconectar a uma conta diferente passa a exibir o nome novo', () => {
    render(<ConnectionChip provider="spotify" />);
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

describe('H7 migrado · nenhuma ação do chip escreve na conta', () => {
  it('configurar não emite requisição alguma', async () => {
    semear({ comCredencial: [], conectados: [] });
    render(<ConnectionChip provider="spotify" />);
    const antes = requestLog.length;

    await userEvent.click(screen.getByRole('button'));

    expect(requestLog.length).toBe(antes);
    // Configurar é navegação interna: leva à etapa de Configuração.
    expect(useAppStore.getState().step).toBe('credential');
  });
});

describe('H8 migrado · isolamento entre serviços', () => {
  it('o chip de um provedor lê apenas o estado daquele provedor', () => {
    semear({ comCredencial: ['spotify'], conectados: ['spotify'] });
    render(<ConnectionChip provider="youtube" />);

    // O YouTube não tem credencial neste cenário; o chip diz isso, e não herda
    // o estado do vizinho.
    expect(screen.getByText(t.connectionChip.noCredential)).toBeInTheDocument();
    expect(screen.queryByText(/Fulano de Teste/u)).toBeNull();
  });

  it('conectar navega só ao provedor do chip', async () => {
    const destinos: string[] = [];
    semear({ conectados: [] });
    render(
      <div>
        <ConnectionChip
          provider="spotify"
          navigate={(url) => {
            destinos.push(url);
          }}
        />
        <ConnectionChip
          provider="youtube"
          navigate={(url) => {
            destinos.push(url);
          }}
        />
      </div>,
    );

    await userEvent.click(screen.getByRole('button', { name: /Conectar a conta do Spotify/u }));

    expect(destinos).toHaveLength(1);
    expect(destinos[0]).toContain('spotify');
    // A sessão do outro serviço permanece intocada durante a ida ao consentimento.
    expect(useAppStore.getState().sessions.youtube).toBeNull();
  });
});

describe('nome de conta longo', () => {
  it('permanece íntegro para leitor de tela, ainda que trunque visualmente', () => {
    // `truncate` é corte **visual**. O conteúdo do nó continua completo, e é ele
    // que o leitor de tela lê (`contracts/shell.md` §2).
    const nomeLongo = 'Uma Pessoa Com Um Nome De Conta Realmente Muito Longo Mesmo';
    useAppStore.setState({
      credentials: makeCredentials({ spotify: SPOTIFY_CLIENT_ID }),
      sessions: makeSessions({
        spotify: makeSession('spotify', { user: { id: 'x', displayName: nomeLongo } }),
      }),
    });

    render(<ConnectionChip provider="spotify" />);
    expect(screen.getByText(nomeLongo)).toBeInTheDocument();
  });
});

/**
 * 008/FR-002 — a cor de marca do símbolo não depende do estado do chip.
 *
 * O que este bloco protege é uma regressão barata de cometer e cara de perceber:
 * uma variante de hover ou de foco escrita no chip inteiro tingiria o glifo
 * junto, e o Spotify passaria a sair âmbar quando o ponteiro passasse por cima —
 * na tela de alguém, nunca em revisão de código.
 *
 * A **saturação** continua sendo pista de estado (esmaecido em `disconnected`,
 * neutro em `no-credential`), como `contracts/shell.md` §3 declara. O que não
 * pode mudar é a **matiz** enquanto há identidade a mostrar.
 */
describe('008/FR-002 · o símbolo do provedor mantém a cor da marca', () => {
  function glifoDoProvedor(container: HTMLElement): Element | null {
    return container.querySelector('.icon-glyph');
  }

  function classesDe(node: Element | null): string {
    // `react-icons` renderiza `<svg>`, cujo `className` é um `SVGAnimatedString`.
    return node?.getAttribute('class') ?? '';
  }

  it.each([
    ['spotify', 'text-brand-spotify'] as const,
    ['youtube', 'text-brand-youtube'] as const,
  ])('conectado: o glifo do %s sai em %s', (provider, tinta) => {
    semear({ conectados: [provider] });
    const { container } = render(<ConnectionChip provider={provider} />);
    expect(classesDe(glifoDoProvedor(container))).toContain(tinta);
  });

  it.each([
    ['spotify', 'text-brand-spotify'] as const,
    ['youtube', 'text-brand-youtube'] as const,
  ])('desconectado: o glifo do %s conserva %s, só esmaecido', (provider, tinta) => {
    semear({ conectados: [] });
    const { container } = render(<ConnectionChip provider={provider} />);
    const classes = classesDe(glifoDoProvedor(container));

    expect(classes).toContain(tinta);
    // A pista de estado é a saturação, e ela é declarada — não é a matiz que muda.
    expect(classes).toContain('opacity-60');
  });

  it('nenhuma variante de foco ou de hover sobrepõe a tinta do glifo', () => {
    // O caso real: `hover:text-accent-text` escrito no chip inteiro herdaria
    // para o glifo por `currentColor`. Nenhuma variante de cor pode alcançá-lo.
    semear({ conectados: ['spotify'] });
    const { container } = render(<ConnectionChip provider="spotify" />);

    const comVariante = [...container.querySelectorAll('[class]')].filter((node) =>
      /\b(?:hover|focus|focus-visible|active|group-hover):(?:text|fill|stroke)-/u.test(
        node.getAttribute('class') ?? '',
      ),
    );
    expect(
      comVariante.map((n) => n.getAttribute('class')),
      'variante de cor no chip: ela herdaria para o glifo por currentColor (008/FR-002)',
    ).toEqual([]);
  });

  it('sem credencial o glifo é neutro, e a divergência é registrada (FR-008)', () => {
    // O arquivo de design **não desenha este estado**. A tinta neutra é decisão
    // da 007, mantida por 008/FR-008 e registrada no inventário de forma.
    semear({ comCredencial: [], conectados: [] });
    const { container } = render(<ConnectionChip provider="spotify" />);
    const classes = classesDe(glifoDoProvedor(container));

    expect(classes).toContain('text-ink-muted');
    expect(classes).not.toContain('text-brand-spotify');
  });
});
