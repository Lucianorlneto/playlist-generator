/**
 * As asserções estruturais da casca (007/FR-006, FR-040, FR-071, FR-074, SC-001).
 *
 * ## Por que asserção estrutural e não captura de pixel
 *
 * FR-072 recusa a comparação por imagem de referência, por decisão explícita do
 * autor. O que sobra precisa ser mais forte do que "renderiza sem erro": a
 * pergunta que este arquivo responde é **"as zonas existem, na ordem certa, em
 * toda etapa, nos dois temas e nas duas larguras?"** — e ele falha quando uma
 * zona, um componente ou um token deixa de estar presente.
 *
 * O que ele **não** pega está registrado sem eufemismo: desalinhamento de 2px,
 * peso tipográfico errado, adesivo invisível sobre o tema claro. Isso é a
 * conferência manual de FR-073, e a lista dela é versionada em
 * `specs/007-official-design-alignment/checklists/design-fidelity.md`.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Shell } from '@/app/Shell';
import { Topbar } from '@/app/Topbar';
import { THEMES } from '@/domain/theme/approvedPairs';
import { WIZARD_STEPS, type WizardStep } from '@/domain/types';
import { t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
import { SHELL_BREAKPOINT_REM } from '@/styles/breakpoints';

import { makeCredentials, makeQueue, makeSession, makeSessions } from '../fixtures/factories';

const CLIENT_ID = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
const YT_CLIENT_ID = '123-abc.apps.googleusercontent.com';

const INDEX_CSS = readFileSync(join(process.cwd(), 'src/styles/index.css'), 'utf8');

/**
 * Alterna a largura simulada.
 *
 * A casca decide por `matchMedia`, atrás do serviço `viewport/shellWidth`. Mocar
 * o global aqui é o que permite exercer as duas larguras sem navegador — e é o
 * motivo pelo qual a consulta ficou num serviço em vez de espalhada no
 * componente (Princípio III).
 */
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

function comTema(theme: (typeof THEMES)[number]): void {
  document.documentElement.setAttribute('data-theme', theme);
}

/**
 * Estado coerente para percorrer as cinco etapas.
 *
 * **Dois destinos, e não um**, porque a etapa Resumo só existe com mais de um
 * (FR-013): semear `step: 'summary'` com fila vazia produziria um estado que o
 * fluxo não alcança, e um teste sobre estado impossível verifica um sistema que
 * não existe.
 */
function semear(step: WizardStep): void {
  useAppStore.setState({
    step,
    // `destinations` entrou na 008: a trilha lê a seleção viva, e não
    // `queue.order`, porque a fila só existe depois da etapa Entrada (FR-028).
    destinations: { selected: ['spotify', 'youtube'], locked: false },
    queue: makeQueue(['spotify', 'youtube']),
    credentials: makeCredentials({ spotify: CLIENT_ID, youtube: YT_CLIENT_ID }),
    sessions: makeSessions({ spotify: makeSession('spotify') }),
  });
}

beforeEach(() => {
  larguraDe(false);
  semear('credential');
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute('data-theme');
});

/** As combinações que toda asserção estrutural percorre (FR-071, FR-074). */
const MATRIZ = WIZARD_STEPS.flatMap((step) =>
  THEMES.flatMap((theme) => [false, true].map((narrow) => ({ step, theme, narrow }))),
);

describe('FR-006 e SC-001 · a barra superior existe em todas as etapas', () => {
  it.each(MATRIZ)(
    'etapa $step, tema $theme, estreito $narrow',
    ({ step, theme, narrow }) => {
      larguraDe(narrow);
      comTema(theme);
      semear(step);

      render(
        <Shell>
          <p>{step}</p>
        </Shell>,
      );

      const barra = screen.getByRole('banner');
      expect(barra).toBeInTheDocument();
      expect(within(barra).getByText(t.app.title)).toBeInTheDocument();
    },
  );

  it.each(MATRIZ)('os dois chips de conexão existem — etapa $step, estreito $narrow', ({ step, theme, narrow }) => {
    larguraDe(narrow);
    comTema(theme);
    semear(step);

    render(
      <Shell>
        <p>{step}</p>
      </Shell>,
    );

    const barra = screen.getByRole('banner');
    // "Estou conectado?" tem resposta sem navegação, em toda etapa. Era
    // exatamente o que não existia antes desta feature.
    expect(within(barra).getByLabelText(/^Spotify:/u)).toBeInTheDocument();
    expect(within(barra).getByLabelText(/^YouTube:/u)).toBeInTheDocument();
  });

  it('o controle de tema está na barra, e continua sendo uma única parada de tabulação', () => {
    render(
      <Shell>
        <p>x</p>
      </Shell>,
    );

    const barra = screen.getByRole('banner');
    const grupo = within(barra).getByRole('radiogroup', { name: t.theme.groupLabel });
    const tabulaveis = within(grupo)
      .getAllByRole('radio')
      .filter((node) => node.getAttribute('tabindex') === '0');

    expect(tabulaveis).toHaveLength(1);
  });
});

describe('FR-037 e FR-041 · a trilha colapsa em resumo abaixo do ponto de corte', () => {
  it.each(WIZARD_STEPS)('em largura ampla a trilha existe — etapa %s', (step) => {
    larguraDe(false);
    semear(step);
    render(
      <Shell>
        <p>x</p>
      </Shell>,
    );

    expect(screen.getByRole('navigation', { name: t.rail.title })).toBeInTheDocument();
  });

  it.each(WIZARD_STEPS)(
    'abaixo do ponto de corte a trilha some e o resumo aparece — etapa %s',
    (step) => {
      larguraDe(true);
      semear(step);
      render(
        <Shell>
          <p>x</p>
        </Shell>,
      );

      expect(screen.queryByRole('navigation', { name: t.rail.title })).toBeNull();
      expect(screen.getByRole('region', { name: t.rail.title })).toBeInTheDocument();
    },
  );

  it.each(MATRIZ)(
    'exatamente um aria-current="step" — etapa $step, tema $theme, estreito $narrow',
    ({ step, theme, narrow }) => {
      /*
        **A razão pela qual a troca acontece em JavaScript e não por
        `display: none`.** Duas cópias da posição atual — uma na trilha, uma no
        resumo, uma delas escondida por CSS — seriam dois `aria-current` para
        qualquer coisa que leia o DOM sem aplicar estilo. Renderizar uma só
        mantém a promessa de FR-041 em um lugar, e é este caso que a cobra.
      */
      larguraDe(narrow);
      comTema(theme);
      semear(step);

      const { container } = render(
        <Shell>
          <p>x</p>
        </Shell>,
      );

      expect(container.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
    },
  );
});

describe('FR-052 · o resumo compacto é informação, não navegação', () => {
  beforeEach(() => {
    larguraDe(true);
    semear('input');
  });

  it('não acrescenta nenhum elemento com role interativo', () => {
    render(
      <Shell>
        <p>x</p>
      </Shell>,
    );

    const resumo = screen.getByRole('region', { name: t.rail.title });
    for (const role of ['button', 'link', 'checkbox', 'tab', 'menuitem'] as const) {
      expect(
        within(resumo).queryAllByRole(role),
        `o resumo compacto acrescentou um controle "${role}"`,
      ).toHaveLength(0);
    }
  });

  it('não acrescenta parada de tabulação', () => {
    render(
      <Shell>
        <p>x</p>
      </Shell>,
    );

    const resumo = screen.getByRole('region', { name: t.rail.title });
    expect(resumo.querySelectorAll('[tabindex]')).toHaveLength(0);
  });

  it('não tem estado de abertura: nenhum aria-expanded em lugar nenhum', () => {
    render(
      <Shell>
        <p>x</p>
      </Shell>,
    );

    const resumo = screen.getByRole('region', { name: t.rail.title });
    expect(resumo.querySelectorAll('[aria-expanded]')).toHaveLength(0);
  });

  it('diz a posição no fluxo, o nome da etapa e o progresso', () => {
    render(
      <Shell>
        <p>x</p>
      </Shell>,
    );

    const resumo = screen.getByRole('region', { name: t.rail.title });
    expect(resumo.textContent).toContain(t.steps.input);
    expect(resumo.textContent).toMatch(/Etapa \d+ de \d+/u);
  });
});

describe('FR-040 · a ordem no DOM é a ordem visual de leitura', () => {
  it('a trilha vem entre a barra superior e a área principal', () => {
    larguraDe(false);
    render(
      <Shell>
        <p>conteúdo</p>
      </Shell>,
    );

    const barra = screen.getByRole('banner');
    const trilha = screen.getByRole('navigation', { name: t.rail.title });
    const principal = screen.getByRole('main');

    expect(barra.compareDocumentPosition(trilha) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(trilha.compareDocumentPosition(principal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('a barra superior precede a área principal', () => {
    render(
      <Shell>
        <p>conteúdo</p>
      </Shell>,
    );

    const barra = screen.getByRole('banner');
    const principal = screen.getByRole('main');

    // `DOCUMENT_POSITION_FOLLOWING` = o argumento vem **depois** do nó.
    expect(barra.compareDocumentPosition(principal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('o alvo do link de pular é a área principal', () => {
    render(
      <Shell>
        <p>conteúdo</p>
      </Shell>,
    );

    expect(screen.getByRole('main')).toHaveAttribute('id', 'conteudo');
  });

  it('o painel lateral vem depois da coluna primária, nas duas larguras', () => {
    // Em largura estreita o painel desce para baixo da coluna. A ordem de
    // leitura é a mesma nas duas — o que muda é a direção do eixo, não a
    // sequência (FR-053).
    for (const narrow of [false, true]) {
      larguraDe(narrow);
      const { unmount } = render(
        <Shell sidePanel={<p>apoio</p>}>
          <p>conteúdo</p>
        </Shell>,
      );

      const principal = screen.getByRole('main');
      const painel = screen.getByRole('complementary');
      expect(
        principal.compareDocumentPosition(painel) & Node.DOCUMENT_POSITION_FOLLOWING,
        `ordem invertida em ${narrow ? 'largura estreita' : 'largura ampla'}`,
      ).toBeTruthy();

      unmount();
    }
  });

  it('sem painel lateral, nenhum elemento complementar é criado', () => {
    render(
      <Shell>
        <p>conteúdo</p>
      </Shell>,
    );

    expect(screen.queryByRole('complementary')).toBeNull();
  });
});

describe('FR-016 e FR-061 · a barra de ações existe em Configuração, Destinos e Entrada', () => {
  /** A lista fechada, repetida aqui de propósito — ver o comentário abaixo. */
  const COM_FAIXA: readonly WizardStep[] = ['credential', 'destinations', 'input'];

  it.each(MATRIZ)(
    'presença correta — etapa $step, tema $theme, estreito $narrow',
    ({ step, theme, narrow }) => {
      /*
        A lista aparece duas vezes: em `ACTION_BAR_BY_STEP` no `Shell` e aqui.
        A repetição é o teste — se ela fosse importada de lá, este caso passaria
        a confirmar que o código concorda consigo mesmo, que é sempre verdade.
        Escrita à mão, ela falha quando alguém acrescenta uma etapa à faixa sem
        decidir que era isso que queria.
      */
      larguraDe(narrow);
      comTema(theme);
      semear(step);

      render(
        <Shell>
          <p>x</p>
        </Shell>,
      );

      const faixas = screen.queryAllByRole('group', { name: t.actionBar.label });
      expect(faixas, `presença errada da barra de ações na etapa ${step}`).toHaveLength(
        COM_FAIXA.includes(step) ? 1 : 0,
      );
    },
  );

  it('no ciclo de serviço e no Resumo a faixa não existe', () => {
    /*
      Dito de novo, sem matriz, porque é a metade do requisito que se perde:
      "existe em Configuração, Destinos e Entrada" é fácil de cumprir
      acrescentando a faixa em toda parte. O que FR-061 pede é a **ausência** nas
      outras duas.

      **Configuração saiu desta lista na fidelidade de design da 008**, e a saída
      é deliberada: o arquivo desenha a faixa também ali (nó `fVjnY`), com o
      avanço e a contagem de serviços configurados. O que continua dentro dos
      cartões é salvar e remover — ações sobre um Client ID, não sobre a etapa.
    */
    for (const step of ['service', 'summary'] as const) {
      semear(step);
      const { unmount } = render(
        <Shell>
          <p>x</p>
        </Shell>,
      );

      expect(
        screen.queryByRole('group', { name: t.actionBar.label }),
        `a barra de ações vazou para a etapa ${step}`,
      ).toBeNull();

      unmount();
    }
  });

  it('FR-062 · "Pular o serviço" permanece dentro do cartão da fase', () => {
    /*
      A ação de pular é da feature 006 e continua adjacente ao cartão de
      conexão, reautorização, orçamento e revisão. Movê-la para a faixa genérica
      desfaria a ligação entre o que se pula e onde se está — e a faixa nem
      existe nesta etapa, que é a forma mais forte de garantir isso.
    */
    semear('service');
    render(
      <Shell>
        <p>conteúdo da fase</p>
      </Shell>,
    );

    expect(screen.queryByRole('group', { name: t.actionBar.label })).toBeNull();
  });
});

describe('FR-040 · a barra de ações fecha a ordem de leitura', () => {
  it('vem depois da área principal no DOM', () => {
    semear('destinations');
    render(
      <Shell>
        <p>conteúdo</p>
      </Shell>,
    );

    const principal = screen.getByRole('main');
    const faixa = screen.getByRole('group', { name: t.actionBar.label });

    expect(principal.compareDocumentPosition(faixa) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('FR-046 e SC-015 · a árvore é idêntica entre os temas', () => {
  /**
   * `useId` gera identificadores sequenciais — `_r_17_` no React 19, `:r17:` nas
   * versões anteriores — e o contador **não reinicia** entre renderizações do
   * mesmo arquivo de teste. Comparar o HTML cru acusaria diferença em toda
   * execução, por um motivo que nada tem a ver com tema.
   */
  function semIdsGerados(html: string): string {
    return html.replaceAll(/(?:_r_[0-9a-z]+_|:r[0-9a-z]+:)/gu, '_id_');
  }

  it('a marcação da casca não difere entre claro e escuro', () => {
    // A divergência autorizada entre os temas é **cromática apenas**. Se a
    // estrutura mudar, algum componente ganhou um caminho condicional por tema —
    // e é o tipo de caminho que só se descobre quando o outro tema quebra.
    const arvores = THEMES.map((theme) => {
      comTema(theme);
      const { container, unmount } = render(
        <Shell sidePanel={<p>apoio</p>}>
          <p>conteúdo</p>
        </Shell>,
      );
      const html = semIdsGerados(container.innerHTML);
      unmount();
      return html;
    });

    expect(arvores[0]).toBe(arvores[1]);
  });
});

describe('FR-046, SC-004 e SC-015 · toda superfície resolve para token', () => {
  /**
   * A asserção é sobre **propriedade customizada resolvida**, não sobre nome de
   * classe.
   *
   * Conferir `className.includes('bg-surface-zone')` provaria apenas que alguém
   * escreveu a classe — e o modo de falha desta feature inteira é justamente a
   * classe que existe no código e **não emite CSS**. Ler o valor computado é o
   * que distingue "a classe está escrita" de "o token chegou na tela".
   *
   * Em happy-dom não há folha de estilo aplicada, então o que se lê é a cascata
   * de propriedades customizadas declarada em `tokens.css` — que é exatamente a
   * camada que precisa existir nos dois temas. A aplicação visual final é
   * responsabilidade do e2e e da conferência manual (FR-073).
   */
  const TOKENS_CSS = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8');

  it.each(THEMES)('os tokens das zonas estão declarados no tema %s', (theme) => {
    const bloco =
      theme === 'light'
        ? TOKENS_CSS.slice(TOKENS_CSS.indexOf(':root {'))
        : TOKENS_CSS.slice(TOKENS_CSS.indexOf("[data-theme='dark'] {"));

    for (const token of ['--bg', '--surface-zone', '--surface', '--rule-strong', '--ink']) {
      expect(
        new RegExp(`${token}:\\s*#[0-9a-f]{3,8}\\s*;`, 'iu').test(bloco),
        `${token} não está declarado no tema ${theme}`,
      ).toBe(true);
    }
  });

  it.each(MATRIZ)(
    'nenhuma propriedade com valor literal — etapa $step, tema $theme, estreito $narrow',
    ({ step, theme, narrow }) => {
      /*
        Um `style="background: #1a2332"` escrito à mão sobrevive a toda a
        disciplina de token: o lint não lê atributo `style` dinâmico, o
        `typecheck` não sabe o que é cor, e a tela fica certa **num** tema.

        A única exceção autorizada é a largura da régua de progresso do
        `StepIndicator`, que saiu com a feature 007 — hoje não há nenhuma.
      */
      larguraDe(narrow);
      comTema(theme);
      semear(step);

      const { container } = render(
        <Shell>
          <p>x</p>
        </Shell>,
      );

      const comEstiloLiteral = [...container.querySelectorAll('[style]')]
        .map((node) => node.getAttribute('style') ?? '')
        .filter((estilo) => /#[0-9a-f]{3,8}|rgb\(|hsl\(/iu.test(estilo));

      expect(
        comEstiloLiteral,
        `valor de cor literal em atributo style: ${comEstiloLiteral.join(' | ')}`,
      ).toEqual([]);
    },
  );

  it('FR-028 · sob cores forçadas, as três zonas ganham contorno próprio', () => {
    /*
      Neste modo o navegador descarta `background-color` e impõe a própria
      paleta. O degrau de luminosidade que separa `--bg` de `--surface-zone`
      desaparece, e as três zonas viram uma superfície só — a estrutura que esta
      feature construiu fica ilegível justamente para quem mais depende de
      estrutura.

      A regra vive em `src/styles/index.css` e é lida daqui, porque happy-dom não
      avalia `@media (forced-colors)`. É uma asserção sobre a folha, não sobre o
      DOM — e é o que resta quando o ambiente não emula o modo.
    */
    const INDEX_CSS = readFileSync(join(process.cwd(), 'src/styles/index.css'), 'utf8');

    const bloco = /@media \(forced-colors: active\) \{([\s\S]*?)\n\}/u.exec(INDEX_CSS);
    expect(bloco, 'nenhum bloco @media (forced-colors: active) em index.css').not.toBeNull();

    const corpo = bloco?.[1] ?? '';
    for (const zona of ['header', 'nav[aria-label]', 'main']) {
      expect(corpo, `a zona "${zona}" não recebe contorno sob cores forçadas`).toContain(zona);
    }
    expect(corpo).toMatch(/border:\s*1px solid/u);
  });
});

describe('SHELL_BREAKPOINT_REM espelha --breakpoint-shell', () => {
  it('as duas cópias do ponto de corte concordam', () => {
    /*
      A duplicação é inevitável: CSS não lê constante de JavaScript e `@media`
      não aceita `var()`. A feature 005 tinha o mesmo par com
      `--breakpoint-gutter` e o resolvia com um comentário pedindo atenção. Um
      comentário não falha quando alguém muda um lado só.
    */
    const match = /--breakpoint-shell:\s*([\d.]+)rem\s*;/u.exec(INDEX_CSS);
    expect(match, '--breakpoint-shell não está declarado em src/styles/index.css').not.toBeNull();
    expect(Number(match?.[1])).toBe(SHELL_BREAKPOINT_REM);
  });
});

describe('FR-054 · a ação de recomeçar não existe em dois lugares', () => {
  /** Estado com trabalho a descartar — sem ele o `ResetFlow` não renderiza nada. */
  function comTrabalho(): void {
    useAppStore.setState({
      step: 'input',
      rawText: 'Amor - Fulano\nOutra - Sicrano',
      destinations: { selected: ['spotify'], locked: false },
      queue: makeQueue(['spotify']),
    });
  }

  it('em largura ampla ela **não** está na barra superior', () => {
    // Em largura ampla ela vive no rodapé da trilha (T037). Aqui se verifica que
    // a barra não a duplica: duas cópias seriam duas paradas de tabulação para a
    // mesma ação, e a segunda pareceria um segundo comando.
    comTrabalho();
    render(<Topbar narrow={false} />);

    expect(screen.queryByRole('button', { name: t.flow.reset })).toBeNull();
  });

  it('em largura estreita ela migra para a barra superior', () => {
    // Abaixo do ponto de corte a trilha não é renderizada e perde o rodapé. Sem
    // a migração, recomeçar deixaria de existir no telefone (FR-054).
    comTrabalho();
    render(<Topbar narrow />);

    expect(screen.getByRole('button', { name: t.flow.reset })).toBeInTheDocument();
  });

  it('sem trabalho a descartar, ela não aparece em largura nenhuma', () => {
    // Comportamento da feature 006, preservado: o comando some sozinho quando
    // não há o que descartar (FR-065).
    useAppStore.setState({
      step: 'credential',
      rawText: '',
      destinations: { selected: [], locked: false },
      queue: makeQueue([]),
    });

    const { unmount } = render(<Topbar narrow />);
    expect(screen.queryByRole('button', { name: t.flow.reset })).toBeNull();
    unmount();

    render(<Topbar narrow={false} />);
    expect(screen.queryByRole('button', { name: t.flow.reset })).toBeNull();
  });
});

/**
 * A linha de contexto do cabeçalho — 008/FR-009 a FR-013.
 *
 * O módulo puro (`tests/unit/header-context.spec.ts`) cobre **qual** linha cada
 * etapa recebe. O que sobra para o componente é o que só existe renderizado: as
 * duas tintas, a região viva e a ausência que não deixa buraco.
 */
describe('008/FR-010 · as duas tintas da linha de contexto', () => {
  beforeEach(() => {
    useAppStore.setState({
      credentials: makeCredentials({ spotify: CLIENT_ID, youtube: YT_CLIENT_ID }),
      sessions: makeSessions({ spotify: makeSession('spotify') }),
    });
    useAppStore.getState().goToStep('destinations');
  });

  it('o primeiro nome sai em `text-accent-text` e o complemento em `text-ink-muted`', () => {
    const { container } = render(<Shell>{null}</Shell>);

    // Filtrado pelo conteúdo: a tinta de acento também veste os verbos do chip
    // de conexão, e um `querySelector` cru encontraria o primeiro deles.
    const nome = [...container.querySelectorAll('.text-accent-text')].find((node) =>
      node.textContent?.startsWith('Oi,'),
    );
    expect(nome, 'o primeiro nome não recebeu a tinta de acento').toBeDefined();
    expect(nome?.textContent).toContain('Fulano');

    const complemento = [...container.querySelectorAll('.text-ink-muted')].find((node) =>
      node.textContent?.includes(t.header.destinationsComplement),
    );
    expect(complemento, 'o complemento não recebeu a tinta secundária').toBeDefined();
  });

  it('o nome usa `--accent-text` e nunca o âmbar cheio', () => {
    // O arquivo desenha o nome em `--accent` cheio, que em tema claro dá 1,73:1
    // como texto. `--accent-text` é a tinta legível equivalente, e no tema
    // escuro os dois têm o mesmo valor — a divergência existe apenas no tema
    // claro, que o arquivo não define.
    const { container } = render(<Shell>{null}</Shell>);
    const comAmbarCheio = [...container.querySelectorAll('[class]')].filter((node) =>
      /\btext-accent\b(?!-)/u.test(node.getAttribute('class') ?? ''),
    );
    expect(comAmbarCheio).toEqual([]);
  });

  it('sem sessão, a linha exibe só o complemento — sem vírgula solta (FR-011)', () => {
    useAppStore.setState({ sessions: makeSessions({}) });
    const { container } = render(<Shell>{null}</Shell>);

    const linha = [...container.querySelectorAll('p')].find((node) =>
      node.textContent?.includes(t.header.destinationsComplement),
    );
    expect(linha, 'a linha sumiu por falta de nome').toBeDefined();
    expect(linha?.textContent).toBe(t.header.destinationsComplement);
    expect(linha?.textContent).not.toMatch(/,\s*$|\s{2}/u);
  });

  it.each(['credential', 'summary'] as const)(
    'a etapa %s não desenha linha nenhuma, e não reserva altura para ela',
    (step) => {
      useAppStore.getState().goToStep(step);
      const { container } = render(<Shell>{null}</Shell>);

      const comComplemento = [...container.querySelectorAll('p')].filter(
        (node) =>
          node.textContent?.includes(t.header.destinationsComplement) === true ||
          node.textContent?.includes(t.header.inputComplement) === true,
      );
      expect(comComplemento).toEqual([]);
    },
  );
});

describe('008/FR-013 · a região viva existe só na forma de serviço', () => {
  beforeEach(() => {
    useAppStore.setState({
      credentials: makeCredentials({ spotify: CLIENT_ID, youtube: YT_CLIENT_ID }),
      sessions: makeSessions({ spotify: makeSession('spotify') }),
      queue: makeQueue(['spotify', 'youtube']),
    });
  });

  it('a linha de serviço é `role="status"`', () => {
    // É ela que muda quando o serviço corrente troca **sem transição de etapa**
    // — o único momento em que algo muda na tela sem o foco se mover.
    useAppStore.getState().goToStep('service');
    const { container } = render(<Shell>{null}</Shell>);

    const viva = container.querySelector('p[role="status"]');
    expect(viva, 'a linha de serviço não é região viva').not.toBeNull();
    expect(viva?.textContent).toContain(t.providers.spotify.name);
  });

  it('a saudação **não** é região viva', () => {
    // Uma saudação anunciada a cada troca de etapa é ruído, não informação — e
    // concorreria com o anúncio do próprio título, que já recebe foco.
    useAppStore.getState().goToStep('destinations');
    const { container } = render(<Shell>{null}</Shell>);

    const viva = [...container.querySelectorAll('[role="status"]')].filter((node) =>
      node.textContent?.includes(t.header.destinationsComplement),
    );
    expect(viva).toEqual([]);
  });
});
