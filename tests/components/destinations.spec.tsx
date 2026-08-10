/**
 * Seletor de destinos (US1, FR-006, FR-008 a FR-012, SC-002, SC-003).
 *
 * Três regras que a tela precisa cumprir literalmente:
 *
 * - **o padrão é derivado**, não lembrado: o conjunto marcado é exatamente o dos
 *   serviços com credencial cadastrada (SC-003);
 * - **o motivo do bloqueio é texto na tela**, com atalho para resolver — um
 *   controle apagado sem explicação não atende FR-009;
 * - **remover uma credencial desmarca só aquele destino** (FR-006).
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { Shell } from '@/app/Shell';
import { Wizard } from '@/app/Wizard';
import { DestinationsActionBar } from '@/features/destinations/DestinationsActionBar';
import { DestinationsStep } from '@/features/destinations/DestinationsStep';
import { format, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';

import { makeCredentials, makeSession, makeSessions } from '../fixtures/factories';

const CLIENT_ID = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
const YT_CLIENT_ID = '123-abc.apps.googleusercontent.com';

const spotify = t.providers.spotify.name;
const youtube = t.providers.youtube.name;

const labelOf = (service: string) => format(t.destinations.selectLabel, { service });

function seedCredentials(present: Partial<Record<'spotify' | 'youtube', string>>) {
  useAppStore.setState({ credentials: makeCredentials(present) });
  useAppStore.getState().reconcileDestinations();
}

function checkbox(service: string): HTMLInputElement {
  return screen.getByRole('checkbox', { name: labelOf(service) });
}

beforeEach(() => {
  useAppStore.setState({ destinations: { selected: [], locked: false } });
});

describe('FR-010 / SC-003 — padrão derivado das credenciais', () => {
  it('marca exatamente os serviços que têm credencial cadastrada', () => {
    seedCredentials({ spotify: CLIENT_ID, youtube: YT_CLIENT_ID });
    render(<DestinationsStep />);

    expect(checkbox(spotify)).toBeChecked();
    expect(checkbox(youtube)).toBeChecked();
  });

  it('com só um cadastrado, marca só ele e desabilita o outro', () => {
    seedCredentials({ youtube: YT_CLIENT_ID });
    render(<DestinationsStep />);

    expect(checkbox(youtube)).toBeChecked();
    expect(checkbox(spotify)).not.toBeChecked();
    expect(checkbox(spotify)).toBeDisabled();
  });

  it('sem nenhuma credencial, nada é selecionável', () => {
    seedCredentials({});
    render(<DestinationsStep />);

    expect(checkbox(spotify)).toBeDisabled();
    expect(checkbox(youtube)).toBeDisabled();
  });
});

describe('FR-009 / SC-002 — motivo visível e atalho', () => {
  it('escreve o motivo do bloqueio e o associa ao controle', () => {
    seedCredentials({ spotify: CLIENT_ID });
    render(<DestinationsStep />);

    const motivo = format(t.destinations.unavailableReason, { service: youtube });
    expect(screen.getByText(motivo)).toBeInTheDocument();

    // O motivo é anunciado junto do controle, não solto na tela.
    const descrito = checkbox(youtube).getAttribute('aria-describedby');
    expect(descrito).not.toBeNull();
    expect(document.getElementById(descrito!)?.textContent).toBe(motivo);
  });

  it('oferece atalho para cadastrar a credencial que falta', async () => {
    const user = userEvent.setup();
    seedCredentials({ spotify: CLIENT_ID });
    render(<DestinationsStep />);

    await user.click(
      screen.getByRole('button', {
        name: format(t.destinations.unavailableAction, { service: youtube }),
      }),
    );

    expect(useAppStore.getState().step).toBe('credential');
  });

  it('serviço com credencial não exibe motivo de bloqueio', () => {
    seedCredentials({ spotify: CLIENT_ID });
    render(<DestinationsStep />);

    expect(
      screen.queryByText(format(t.destinations.unavailableReason, { service: spotify })),
    ).not.toBeInTheDocument();
    expect(checkbox(spotify)).toBeEnabled();
  });
});

/**
 * A etapa **e a sua faixa de ações**, que é onde o avanço mora desde a 007.
 *
 * As ações saíram de dentro da tela para o rodapé do conteúdo (FR-016). O
 * comportamento não mudou — bloqueio, motivo escrito e destino de cada botão são
 * os mesmos —, mudou onde o botão é desenhado. Renderizar os dois juntos é o que
 * mantém estes casos medindo a etapa como o usuário a vê.
 */
function etapaCompleta() {
  return (
    <>
      <DestinationsStep />
      <DestinationsActionBar />
    </>
  );
}

describe('FR-011 — ao menos um destino para avançar', () => {
  it('permite avançar com um único destino', async () => {
    const user = userEvent.setup();
    seedCredentials({ spotify: CLIENT_ID, youtube: YT_CLIENT_ID });
    render(etapaCompleta());

    await user.click(checkbox(youtube));

    expect(useAppStore.getState().destinations.selected).toEqual(['spotify']);
    expect(screen.getByRole('button', { name: t.common.next })).toBeEnabled();
  });

  it('bloqueia o avanço com nenhum destino, explicando o motivo', async () => {
    const user = userEvent.setup();
    seedCredentials({ spotify: CLIENT_ID, youtube: YT_CLIENT_ID });
    render(etapaCompleta());

    await user.click(checkbox(spotify));
    await user.click(checkbox(youtube));

    expect(useAppStore.getState().destinations.selected).toEqual([]);
    expect(screen.getByText(t.destinations.noneSelected)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.common.next })).toBeDisabled();
  });
});

describe('FR-006 — remover credencial afeta só aquele destino', () => {
  it('desmarca e desabilita o destino do serviço removido', () => {
    seedCredentials({ spotify: CLIENT_ID, youtube: YT_CLIENT_ID });
    const { rerender } = render(<DestinationsStep />);
    expect(checkbox(youtube)).toBeChecked();

    useAppStore.getState().removeCredential('youtube');
    rerender(<DestinationsStep />);

    expect(checkbox(youtube)).not.toBeChecked();
    expect(checkbox(youtube)).toBeDisabled();
    // O outro serviço segue intacto.
    expect(checkbox(spotify)).toBeChecked();
    expect(useAppStore.getState().destinations.selected).toEqual(['spotify']);
  });
});

describe('FR-012 — seleção travada após a primeira criação', () => {
  it('desabilita os controles e explica que é preciso descartar o rascunho', () => {
    seedCredentials({ spotify: CLIENT_ID, youtube: YT_CLIENT_ID });
    useAppStore.getState().lockDestinations();
    render(<DestinationsStep />);

    expect(checkbox(spotify)).toBeDisabled();
    expect(checkbox(youtube)).toBeDisabled();
    expect(screen.getByText(t.destinations.lockedNotice)).toBeInTheDocument();
  });
});

/**
 * 008/FR-006 e SC-003 — nenhuma moldura em volta do cabeçalho da etapa.
 *
 * A caixa que o pedido aponta em volta de "Para onde vai a playlist?" era o
 * `<div className="app-card">` do `Wizard`, que envolvia o conteúdo de **toda**
 * etapa. O arquivo de design não desenha cartão em volta de cabeçalho de etapa
 * em nenhuma das quatorze telas: `Heading` é filho direto de `Primary Column`,
 * sem preenchimento e sem contorno (nó `jHTKw` em `uy2ns`).
 *
 * A asserção é **estrutural e sobre o ancestral**, não sobre o irmão: o defeito
 * não era uma classe errada no cabeçalho, era uma superfície acima dele. Um
 * teste que olhasse só o `<header>` passaria com o defeito intacto.
 */
describe('008/FR-006, SC-003 — o cabeçalho da etapa não é envolvido por cartão', () => {
  it('nenhum ancestral do título carrega o utilitário `app-card`', () => {
    seedCredentials({ spotify: CLIENT_ID, youtube: YT_CLIENT_ID });
    useAppStore.getState().goToStep('destinations');
    render(<Wizard />);

    const titulo = screen.getByRole('heading', { name: t.destinations.heading });
    const molduras: string[] = [];
    for (let node = titulo.parentElement; node !== null; node = node.parentElement) {
      if (node.classList.contains('app-card')) molduras.push(node.tagName.toLowerCase());
    }

    expect(
      molduras,
      'uma superfície com contorno envolve o cabeçalho da etapa (008/FR-006)',
    ).toEqual([]);
  });

  it('o cabeçalho e o conteúdo da etapa ficam sobre o substrato da área principal', () => {
    // O outro lado da mesma regra: removida a moldura, o conteúdo repousa sobre
    // `--bg`, e não sobre o degrau de luminosidade que o cartão fornecia.
    seedCredentials({ spotify: CLIENT_ID, youtube: YT_CLIENT_ID });
    useAppStore.getState().goToStep('destinations');
    const { container } = render(<Wizard />);

    expect(container.querySelectorAll('.app-card')).toHaveLength(0);
  });
});

/**
 * 008/FR-001 e FR-003 — o distintivo do provedor no cartão de destino.
 *
 * É o **único** lugar do produto em que a cor de marca preenche alguma coisa, e
 * a exceção é nomeada em três lugares ao mesmo tempo: os tokens
 * `--brand-tint-*`, a allowlist de arquivo em `eslint-rules/index.js` e a
 * asserção de ponto único em `tests/unit/no-orphan-tokens.spec.ts`. Este caso
 * cobre o quarto ângulo — que a exceção esteja de fato **sendo usada** no ponto
 * autorizado, e não apenas permitida ali.
 */
describe('008/FR-001, FR-003 — distintivo com o glifo sobre o substrato de identidade', () => {
  it.each([
    ['spotify', 'bg-brand-tint-spotify', 'text-brand-spotify'],
    ['youtube', 'bg-brand-tint-youtube', 'text-brand-youtube'],
  ])('o cartão do %s traz o glifo em %s sobre %s', (provider, substrato, tinta) => {
    seedCredentials({ spotify: CLIENT_ID, youtube: YT_CLIENT_ID });
    const { container } = render(<DestinationsStep />);

    const distintivo = container.querySelector(`.${substrato}`);
    expect(distintivo, `o cartão do ${provider} não tem distintivo tingido`).not.toBeNull();

    const glifo = distintivo?.querySelector('.icon-glyph');
    expect(glifo, 'o distintivo existe mas está vazio').not.toBeNull();
    // `getAttribute` e não `className`: o glifo é um `<svg>`, cujo `className` é
    // um `SVGAnimatedString` e não uma string.
    expect(glifo?.getAttribute('class') ?? '').toContain(tinta);
  });

  it('o glifo é decorativo: o nome do serviço está escrito ao lado (FR-005)', () => {
    // A cor **nunca** é o único portador da identidade. É o que faz o cartão
    // continuar dizendo qual serviço é sob cores forçadas e para quem não
    // distingue verde de vermelho.
    seedCredentials({ spotify: CLIENT_ID, youtube: YT_CLIENT_ID });
    const { container } = render(<DestinationsStep />);

    for (const [substrato, service] of [
      ['bg-brand-tint-spotify', spotify],
      ['bg-brand-tint-youtube', youtube],
    ] as const) {
      const cartao = container.querySelector(`.${substrato}`)?.closest('[data-destino]');
      expect(cartao?.textContent).toContain(service);
      expect(cartao?.querySelector('.icon-glyph')?.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('008/FR-004a — nenhum preenchimento com a cor de marca cheia na etapa', () => {
    seedCredentials({ spotify: CLIENT_ID, youtube: YT_CLIENT_ID });
    const { container } = render(<DestinationsStep />);

    const cheio = [...container.querySelectorAll('[class]')].filter((node) =>
      /\bbg-brand-(?!tint-)/u.test(node.getAttribute('class') ?? ''),
    );
    expect(cheio.map((n) => n.getAttribute('class'))).toEqual([]);
  });
});

describe('FR-015 — ordem fixa, sem controle de ordenação', () => {
  it('exibe Spotify antes de YouTube e não oferece reordenação', () => {
    seedCredentials({ spotify: CLIENT_ID, youtube: YT_CLIENT_ID });
    render(<DestinationsStep />);

    const grupo = screen.getByRole('group', { name: t.destinations.groupLabel });
    const rotulos = within(grupo)
      .getAllByRole('checkbox')
      .map((entry) => entry.getAttribute('id'));

    expect(rotulos).toEqual(['destino-spotify', 'destino-youtube']);
  });
});

/**
 * O painel "Ordem de execução" — 008/FR-014 a FR-020, SC-005 e SC-006.
 *
 * O painel é renderizado pelo `Shell`, não pela etapa: a decisão de qual etapa
 * ganha painel é do sistema (`SIDE_PANEL_BY_STEP`), e testá-lo pela casca é o
 * que faz estes casos medirem a tela como o usuário a vê.
 */
describe('008/FR-014 a FR-019 — o painel de ordem de execução', () => {
  function etapaComPainel() {
    useAppStore.getState().goToStep('destinations');
    return render(
      <Shell>
        <DestinationsStep />
      </Shell>,
    );
  }

  /**
   * O painel, e não a casca inteira.
   *
   * O escopo importa: a trilha de etapas também é uma `<ol>` de `<li>`, e a
   * barra superior também tem `<img>`. Uma asserção sobre o `container` inteiro
   * mediria a casca em vez do painel — e passaria ou falharia pelo motivo
   * errado.
   */
  function painelDe(container: HTMLElement): HTMLElement {
    const aside = container.querySelector('aside');
    expect(aside, 'o painel lateral não foi renderizado').not.toBeNull();
    return aside as HTMLElement;
  }

  it('FR-015a · existe com seleção vazia, com cabeçalho, aviso, fotografia e legenda', () => {
    seedCredentials({});
    const { container } = etapaComPainel();

    expect(screen.getByRole('heading', { name: t.destinations.panelTitle })).toBeInTheDocument();
    expect(screen.getByText(t.destinations.panelHint)).toBeInTheDocument();
    expect(screen.getByText(t.destinations.panelCaption)).toBeInTheDocument();
    expect(container.querySelector('.mood-photo')).not.toBeNull();

    // O convite entra **no lugar da fila**, e não como um item dela.
    expect(screen.getByText(t.destinations.panelEmpty)).toBeInTheDocument();
    expect(painelDe(container).querySelectorAll('ol li')).toHaveLength(0);
  });

  it('FR-015 · a fila reflete a seleção e nunca lista o não selecionado', async () => {
    const user = userEvent.setup();
    seedCredentials({ spotify: CLIENT_ID, youtube: YT_CLIENT_ID });
    etapaComPainel();

    const painel = screen.getByRole('heading', { name: t.destinations.panelTitle }).parentElement
      ?.parentElement;
    expect(painel?.textContent).toContain(spotify);
    expect(painel?.textContent).toContain(youtube);

    await user.click(checkbox(youtube));

    expect(painel?.textContent).toContain(spotify);
    expect(painel?.textContent).not.toContain(youtube);
    expect(screen.queryByText(t.destinations.panelEmpty)).toBeNull();
  });

  it('a nota de ordem relativa some com um destino só', async () => {
    const user = userEvent.setup();
    seedCredentials({ spotify: CLIENT_ID, youtube: YT_CLIENT_ID });
    etapaComPainel();

    expect(screen.getByText(t.destinations.panelFirst)).toBeInTheDocument();

    await user.click(checkbox(youtube));

    // "1º · será criada primeiro" numa fila de um item anuncia uma ordem que não
    // existe.
    expect(screen.queryByText(t.destinations.panelFirst)).toBeNull();
  });

  it('FR-018 · o texto vem antes da fotografia no DOM', () => {
    seedCredentials({ spotify: CLIENT_ID, youtube: YT_CLIENT_ID });
    const { container } = etapaComPainel();

    const legenda = screen.getByText(t.destinations.panelCaption);
    const aviso = screen.getByText(t.destinations.panelHint);
    const foto = container.querySelector('.mood-photo');
    expect(foto).not.toBeNull();

    // `DOCUMENT_POSITION_FOLLOWING` = o argumento vem **depois** do nó.
    expect(aviso.compareDocumentPosition(foto!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // A legenda é o único texto abaixo da fotografia, e é sobre ela.
    expect(foto!.compareDocumentPosition(legenda) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('SC-006 · fotografia e adesivos são decoração, e a informação sobrevive sem eles', () => {
    seedCredentials({ spotify: CLIENT_ID, youtube: YT_CLIENT_ID });
    const { container } = etapaComPainel();

    const decorativas = [...container.querySelectorAll('img')];
    const anunciadas = decorativas
      .filter((img) => img.getAttribute('alt') !== '')
      .filter((img) => img.closest('[aria-hidden="true"]') === null);
    expect(anunciadas).toEqual([]);

    // O diferimento vale para a fotografia e para os adesivos. A marca da barra
    // superior fica de fora: ela é a identidade do produto, aparece acima da
    // dobra em toda etapa, e diferi-la trocaria um ganho que não existe por um
    // salto visual no carregamento.
    const painel = painelDe(container);
    const etapa = container.querySelector('section');
    for (const img of [
      ...painel.querySelectorAll('img'),
      ...(etapa?.querySelectorAll('img') ?? []),
    ]) {
      expect(img.getAttribute('loading')).toBe('lazy');
    }
  });

  it('FR-019 e SC-005 · a explicação da ordem aparece uma única vez na tela', () => {
    seedCredentials({ spotify: CLIENT_ID, youtube: YT_CLIENT_ID });
    const { container } = etapaComPainel();

    // O parágrafo do corpo da etapa saiu; o que ficou é o aviso do painel.
    const explicacoes = [...container.querySelectorAll('p, li, span')].filter((node) =>
      /executamos um serviço/iu.test(node.textContent ?? ''),
    );
    const folhas = explicacoes.filter((node) => node.querySelector('p, li, span') === null);
    expect(folhas).toHaveLength(1);
  });

  /**
   * Invariante P1 de `contracts/destinations.md` §2 — a largura não muda com a
   * marcação.
   *
   * **Asserção de classe, e não de pixel**, por um motivo que faria o teste
   * passar vazio: `getBoundingClientRect` devolve zero em jsdom, e uma
   * comparação de larguras medidas compararia `0` com `0` em qualquer cenário,
   * inclusive num painel que colapsasse de verdade.
   */
  it('FR-015a e FR-020 · painel e coluna mantêm as mesmas classes de largura', async () => {
    const user = userEvent.setup();
    seedCredentials({ spotify: CLIENT_ID, youtube: YT_CLIENT_ID });
    const { container } = etapaComPainel();

    const medir = () => ({
      painel: container.querySelector('aside')?.getAttribute('class') ?? '(sem painel)',
      coluna: container.querySelector('main')?.getAttribute('class') ?? '(sem coluna)',
    });

    const comDois = medir();
    await user.click(checkbox(youtube));
    const comUm = medir();
    await user.click(checkbox(spotify));
    const comNenhum = medir();

    expect(comUm, 'a largura mudou ao desmarcar o segundo destino').toEqual(comDois);
    expect(comNenhum, 'o painel colapsou com seleção vazia').toEqual(comDois);
    expect(comNenhum.painel).not.toBe('(sem painel)');
  });
});

/**
 * A anatomia do cartão de destino — 008/FR-021 a FR-025.
 *
 * O que estes casos protegem, e que nenhum teste de comportamento pegaria: o
 * cartão **pulava** quando a sessão era obtida, porque o bloco de motivo
 * aparecia e sumia. A altura constante é a exigência de FR-021a, e ela só é
 * verificável se a linha secundária existir nos três estados.
 */
describe('008/FR-021 e FR-021a — a linha secundária nos três estados', () => {
  function cartaoDe(container: HTMLElement, provider: 'spotify' | 'youtube'): HTMLElement {
    const cartao = container.querySelector(`[data-destino="${provider}"]`);
    expect(cartao, `o cartão do ${provider} não foi renderizado`).not.toBeNull();
    return cartao as HTMLElement;
  }

  it('sessão ativa: nomeia a conta conectada', () => {
    seedCredentials({ spotify: CLIENT_ID, youtube: YT_CLIENT_ID });
    useAppStore.setState({ sessions: makeSessions({ spotify: makeSession('spotify') }) });
    const { container } = render(<DestinationsStep />);

    expect(cartaoDe(container, 'spotify').textContent).toContain(
      format(t.destinations.accountConnected, { account: 'Fulano de Teste' }),
    );
  });

  it('credencial sem sessão: diz **quando** a autorização acontece', () => {
    // O estado que a 007 deixava mudo. Sem esta linha, o cartão de um serviço
    // com credencial e sem sessão é indistinguível de um já conectado, e o
    // usuário fica supondo que a autorização deveria ter acontecido.
    seedCredentials({ spotify: CLIENT_ID, youtube: YT_CLIENT_ID });
    useAppStore.setState({ sessions: makeSessions({}) });
    const { container } = render(<DestinationsStep />);

    expect(cartaoDe(container, 'spotify').textContent).toContain(
      format(t.destinations.accountPendingAuth, { service: spotify }),
    );
  });

  it('sem credencial: mantém o motivo e o atalho, na mesma faixa', () => {
    seedCredentials({ spotify: CLIENT_ID });
    const { container } = render(<DestinationsStep />);

    const cartao = cartaoDe(container, 'youtube');
    expect(cartao.textContent).toContain(
      format(t.destinations.unavailableReason, { service: youtube }),
    );
    expect(cartao.textContent).toContain(
      format(t.destinations.unavailableAction, { service: youtube }),
    );
  });

  it('FR-021a · o cartão tem a mesma estrutura nos três estados', () => {
    /*
      **Asserção de estrutura, e não de altura medida**: `getBoundingClientRect`
      devolve zero em jsdom, e comparar `0` com `0` passaria inclusive num cartão
      que pulasse de verdade.

      O que garante a altura constante é o motivo pelo qual ela varia: um bloco
      que aparece e some. Se os três estados produzem a **mesma contagem de
      filhos** no cartão e a mesma classe de layout, não há bloco condicional
      para pular — que é a causa, não o sintoma.
    */
    const medir = (): { filhos: number; classes: string } => {
      const { container, unmount } = render(<DestinationsStep />);
      const cartao = cartaoDe(container, 'spotify');
      const medida = {
        filhos: cartao.children.length,
        classes: cartao.getAttribute('class') ?? '',
      };
      unmount();
      return medida;
    };

    seedCredentials({});
    const semCredencial = medir();

    seedCredentials({ spotify: CLIENT_ID });
    useAppStore.setState({ sessions: makeSessions({}) });
    const pendente = medir();

    useAppStore.setState({ sessions: makeSessions({ spotify: makeSession('spotify') }) });
    const conectado = medir();

    expect(pendente.filhos, 'o cartão ganhou ou perdeu um bloco').toBe(semCredencial.filhos);
    expect(conectado.filhos, 'o cartão ganhou ou perdeu um bloco').toBe(semCredencial.filhos);
    // A única classe que muda é a de seleção, tratada no caso de FR-024.
    expect(conectado.classes).toBe(pendente.classes);
  });
});

describe('008/FR-023 e FR-024 — o controle e a distinção do selecionado', () => {
  function cartaoDe(container: HTMLElement, provider: 'spotify' | 'youtube'): HTMLElement {
    return container.querySelector(`[data-destino="${provider}"]`) as HTMLElement;
  }

  it('FR-023 · a marca de verificação é o último filho do cartão', () => {
    seedCredentials({ spotify: CLIENT_ID, youtube: YT_CLIENT_ID });
    const { container } = render(<DestinationsStep />);

    const cartao = cartaoDe(container, 'spotify');
    const ultimo = cartao.lastElementChild;
    expect(ultimo?.getAttribute('aria-hidden')).toBe('true');
    expect(ultimo?.getAttribute('class') ?? '').toContain('peer-checked:');
  });

  it('FR-023 · a marca recebe o estado preenchido quando o destino é escolhido', () => {
    // O estado visível vem de `peer-checked:`, e o estado real do controle
    // continua no `<input>`: quem é lido pelo leitor de tela é o input, não este
    // `<span>` — que é `aria-hidden` justamente para não duplicar o anúncio.
    seedCredentials({ spotify: CLIENT_ID, youtube: YT_CLIENT_ID });
    const { container } = render(<DestinationsStep />);

    const marca = cartaoDe(container, 'spotify').lastElementChild;
    const classes = marca?.getAttribute('class') ?? '';
    expect(classes).toContain('peer-checked:bg-accent');
    expect(classes).toContain('peer-focus-visible:');
  });

  it('FR-025 · o controle real permanece focável e com rótulo associado', () => {
    seedCredentials({ spotify: CLIENT_ID, youtube: YT_CLIENT_ID });
    render(<DestinationsStep />);

    const controle = checkbox(spotify);
    // `sr-only` esconde **visualmente**, não semanticamente.
    expect(controle.className).toContain('sr-only');
    expect(controle.getAttribute('type')).toBe('checkbox');
    // O nome acessível é o rótulo, e **só** ele — não a linha de estado.
    expect(controle).toHaveAccessibleName(labelOf(spotify));
  });

  it('FR-025 · o cartão inteiro é alvo de clique, não só o título', async () => {
    /*
      **A área toda marca o destino.** Antes só o título fazia isso: o cartão tem
      quase setecentos pixels de largura, e clicar em qualquer outro ponto dele
      não fazia nada — o alvo real era uma palavra e meia num canto.

      O alvo é um `<label for>` vazio em camada absoluta. Vazio importa: se ele
      tivesse texto, o nome do controle passaria a concatená-lo, e é o caso
      seguinte que fixa isso.
    */
    const user = userEvent.setup();
    seedCredentials({ spotify: CLIENT_ID, youtube: YT_CLIENT_ID });
    const { container } = render(<DestinationsStep />);

    const cartao = cartaoDe(container, 'spotify');
    const alvo = cartao.querySelector('label');

    expect(alvo, 'o cartão perdeu a camada de clique').not.toBeNull();
    expect(alvo?.getAttribute('for')).toBe(checkbox(spotify).id);
    // Vazia de texto: quem nomeia o controle é o título, por `aria-labelledby`.
    expect(alvo?.textContent).toBe('');
    expect(alvo?.className).toContain('absolute');
    expect(alvo?.className).toContain('inset-0');

    expect(checkbox(spotify).checked).toBe(true);
    await user.click(alvo!);
    expect(checkbox(spotify).checked, 'clicar no cartão não desmarcou').toBe(false);
    await user.click(alvo!);
    expect(checkbox(spotify).checked, 'clicar no cartão não remarcou').toBe(true);
  });

  it('FR-025 · o atalho de credencial fica acima da camada de clique', () => {
    /*
      O estado sem credencial é o único em que o cartão tem um segundo controle
      dentro. Sem `relative` o `<label>` que cobre o cartão engoliria o botão, e
      o ponteiro tentaria marcar um destino que nem pode ser marcado em vez de
      levar à configuração.
    */
    seedCredentials({ spotify: CLIENT_ID });
    render(<DestinationsStep />);

    const atalho = screen.getByRole('button', {
      name: format(t.destinations.unavailableAction, { service: youtube }),
    });

    expect(atalho.className).toContain('relative');
  });

  it('FR-024 · selecionado leva contorno de acento e substrato `--accent-tint`', async () => {
    const user = userEvent.setup();
    seedCredentials({ spotify: CLIENT_ID, youtube: YT_CLIENT_ID });
    const { container } = render(<DestinationsStep />);

    const marcado = cartaoDe(container, 'spotify').getAttribute('class') ?? '';
    expect(marcado).toContain('border-accent-text');
    expect(marcado).toContain('bg-accent-tint');

    await user.click(checkbox(spotify));

    const desmarcado = cartaoDe(container, 'spotify').getAttribute('class') ?? '';
    expect(desmarcado).toContain('border-rule');
    expect(desmarcado).toContain('bg-surface');
    expect(desmarcado).not.toContain('bg-accent-tint');
  });

  it('o substrato do selecionado é âmbar tingido, nunca âmbar cheio', () => {
    // A distinção que a 007 receava: preenchimento âmbar **cheio** é o botão
    // primário desta tela. O tingido a 12–15% não colide com ele.
    seedCredentials({ spotify: CLIENT_ID, youtube: YT_CLIENT_ID });
    const { container } = render(<DestinationsStep />);

    const classes = cartaoDe(container, 'spotify').getAttribute('class') ?? '';
    expect(classes).not.toMatch(/\bbg-accent\b(?!-)/u);
  });
});
