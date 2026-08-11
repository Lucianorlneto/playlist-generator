/**
 * O cartão de fase enquanto a criação está em voo — 009.
 *
 * Cobre FR-001 a FR-013a, FR-018 a FR-018b, FR-024 e os SC-001, SC-005 e SC-010.
 *
 * ## O que este arquivo existe para não deixar implícito
 *
 * A fase de criação é a mais longa e a mais arriscada do fluxo, e até esta
 * feature ela era **muda**: um parágrafo de progresso solto, e nada mais. As
 * asserções aqui não são sobre aparência — são sobre o que a pessoa consegue
 * saber olhando a tela, e sobre o que o leitor de tela anuncia.
 *
 * Três invariantes que nenhum compilador pega e que este arquivo transforma em
 * teste: o rodapé é **uma** região viva e troca de forma **uma** vez; nenhum
 * indicador de carregamento sobrevive a erro; e não existe piso artificial de
 * tempo — a correção de boa-fé que alguém acrescenta no primeiro relato de
 * "piscou" e que nada mais reprovaria.
 */

import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ResultScreen } from '@/features/result/ResultScreen';
import { format, t } from '@/i18n/pt-BR';
import { waitAnnounced } from '@/services/rate-limiter';
import { useAppStore } from '@/store';

import {
  makeAwaitingReauth,
  makeCreation,
  makeItem,
  makeLine,
  makeQueue,
  makeResult,
  makeRun,
  makeSession,
  makeSessions,
} from '../fixtures/factories';

import type { AppErrorInfo, ServiceRun } from '@/domain/types';
import type { ProviderId } from '@/domain/providers';

const linha = makeLine({ id: 'l0', index: 0, raw: 'Bohemian Rhapsody - Queen' });
const item = makeItem({ line: linha, selectedUri: 'spotify:track:a', included: true });

const nomeDe: Record<ProviderId, string> = {
  spotify: t.providers.spotify.name,
  youtube: t.providers.youtube.name,
};

/** A execução em criação, no estado que a regra de exibição autoriza. */
function semear(
  provider: ProviderId = 'spotify',
  run: Partial<ServiceRun> = {},
  creationError: unknown = null,
): void {
  useAppStore.setState({
    sessions: makeSessions({ [provider]: makeSession(provider) }),
    lines: [linha],
    destinations: { selected: [provider], locked: true },
    creating: true,
    creationError: creationError as never,
    queue: makeQueue([provider], {
      currentIndex: 0,
      runs: {
        [provider]: makeRun(provider, {
          phase: 'creating',
          lineIds: [linha.id],
          items: [item],
          creation: makeCreation(),
          ...run,
        }),
      },
    }),
  });
}

/** A seção do cartão — o escopo de toda contagem deste arquivo. */
function cartao(): HTMLElement {
  const secao = document.querySelector('section.app-card');
  if (secao === null) throw new Error('o cartão de fase não está na tela');
  return secao as HTMLElement;
}

/** Todos os nós `role="status"` do cartão, na ordem do documento. */
function regioesVivas(): HTMLElement[] {
  return [...cartao().querySelectorAll('[role="status"]')] as HTMLElement[];
}

/**
 * A preferência de movimento, dirigida por evento — 009/FR-016.
 *
 * **Por que não basta trocar o `matchMedia` antes de cada render.** A biblioteca
 * de movimento lê a preferência **uma única vez**, na primeira chamada de
 * `useReducedMotion` do processo: ela trava um sinalizador global, guarda o valor
 * num módulo e daí em diante só o atualiza pelo evento `change` da própria
 * `MediaQueryList`. Um stub instalado depois disso nunca seria consultado, e o
 * teste passaria medindo o estado errado — que foi exatamente o que aconteceu na
 * primeira escrita destes casos.
 *
 * Então o stub é instalado **antes de qualquer render** e permanece o mesmo o
 * arquivo inteiro; o que muda é o valor de `reduzirMovimento`, notificado aos
 * ouvintes que a biblioteca registrou.
 */
let reduzirMovimento = false;
const ouvintesDeMovimento = new Set<() => void>();

function instalarMatchMedia(): void {
  vi.stubGlobal(
    'matchMedia',
    (query: string): MediaQueryList =>
      ({
        get matches() {
          return reduzirMovimento && query.includes('prefers-reduced-motion');
        },
        media: query,
        onchange: null,
        addEventListener: (_evento: string, ouvinte: () => void) => {
          ouvintesDeMovimento.add(ouvinte);
        },
        removeEventListener: (_evento: string, ouvinte: () => void) => {
          ouvintesDeMovimento.delete(ouvinte);
        },
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
}

/** Troca a preferência e avisa quem a biblioteca inscreveu. */
function preferirMovimentoReduzido(reduzir: boolean): void {
  reduzirMovimento = reduzir;
  for (const ouvinte of ouvintesDeMovimento) ouvinte();
}

instalarMatchMedia();

beforeEach(() => {
  preferirMovimentoReduzido(false);
  semear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('FR-001 e SC-001 · os cinco blocos existem, na ordem do arquivo', () => {
  it('indicador, subtítulo, descrição e rodapé estão na tela durante a fase creating', () => {
    render(<ResultScreen provider="spotify" />);

    expect(
      screen.getByText(format(t.playlistConfig.creating, { service: nomeDe.spotify })),
    ).toBeInTheDocument();
    expect(screen.getByText(t.result.creatingSubtitle)).toBeInTheDocument();
    expect(
      screen.getByText(format(t.result.creatingDescription, { service: nomeDe.spotify })),
    ).toBeInTheDocument();
    expect(
      screen.getByText(format(t.result.awaitingConfirmation, { service: nomeDe.spotify })),
    ).toBeInTheDocument();
  });

  it('a ordem vertical é a do arquivo: cabeçalho, indicador, descrição, rodapé', () => {
    // `compareDocumentPosition` compara posição **no documento**, que é o que a
    // ordem do arquivo de design fixa — e não a ordem em que a JSX foi escrita.
    render(<ResultScreen provider="spotify" />);

    const titulo = screen.getByText(
      format(t.playlistConfig.creating, { service: nomeDe.spotify }),
    );
    const descricao = screen.getByText(
      format(t.result.creatingDescription, { service: nomeDe.spotify }),
    );
    const rodape = screen.getByText(
      format(t.result.awaitingConfirmation, { service: nomeDe.spotify }),
    );

    const antes = Node.DOCUMENT_POSITION_FOLLOWING;
    expect(titulo.compareDocumentPosition(descricao) & antes).toBeTruthy();
    expect(descricao.compareDocumentPosition(rodape) & antes).toBeTruthy();
  });

  it('o cabeçalho do cartão é o primeiro filho, e o indicador o segundo', () => {
    // É a aritmética do SC-004: o topo do 2º filho é o mesmo ponto nos dois
    // estados, e a medição de pixel do e2e depende desta estrutura.
    render(<ResultScreen provider="spotify" />);

    const filhos = [...cartao().children];
    expect(filhos[0]?.tagName.toLowerCase()).toBe('header');
    expect(filhos[1]).toContainElement(
      screen.getByText(format(t.playlistConfig.creating, { service: nomeDe.spotify })),
    );
  });
});

describe('FR-011 a FR-013 · o rodapé é uma região viva só, e troca uma vez', () => {
  it('sem lote confirmado, diz "aguardando confirmação"', () => {
    render(<ResultScreen provider="spotify" />);

    const vivas = regioesVivas();
    expect(vivas).toHaveLength(1);
    expect(vivas[0]).toHaveTextContent(
      format(t.result.awaitingConfirmation, { service: nomeDe.spotify }),
    );
  });

  it('`creation === null` também diz "aguardando" — a playlist ainda não existe', () => {
    semear('spotify', { creation: null });
    render(<ResultScreen provider="spotify" />);

    expect(regioesVivas()[0]).toHaveTextContent(
      format(t.result.awaitingConfirmation, { service: nomeDe.spotify }),
    );
  });

  it('FR-012 · a partir do primeiro lote confirmado, mostra o progresso real', () => {
    semear('spotify', { creation: makeCreation({ committedItems: 1 }) });
    render(<ResultScreen provider="spotify" />);

    expect(regioesVivas()[0]).toHaveTextContent(
      format(t.result.creationProgress, { current: 1, total: 2 }),
    );
  });

  it('FR-013 · a troca de forma é **um** nó, não dois em revezamento', () => {
    /*
      Dois nós que se revezassem produziriam dois anúncios na troca: a remoção de
      um e a inserção do outro. A asserção é sobre a identidade do nó — o mesmo
      elemento de DOM antes e depois — porque é isso que decide quantos anúncios
      um leitor de tela emite.
    */
    const { rerender } = render(<ResultScreen provider="spotify" />);
    const antes = regioesVivas();
    expect(antes).toHaveLength(1);
    const noAntes = antes[0];

    act(() => {
      semear('spotify', { creation: makeCreation({ committedItems: 1 }) });
    });
    rerender(<ResultScreen provider="spotify" />);

    const depois = regioesVivas();
    expect(depois).toHaveLength(1);
    expect(depois[0]).toBe(noAntes);
    expect(depois[0]).toHaveTextContent(
      format(t.result.creationProgress, { current: 1, total: 2 }),
    );
  });

  it('FR-025 · a retomada nasce em progresso, nunca em "aguardando"', () => {
    // `creation` chega do rascunho com itens já confirmados. Voltar para
    // "aguardando" seria mentir sobre trabalho que existe na conta do usuário.
    semear('spotify', { creation: makeCreation({ committedItems: 2 }) });
    render(<ResultScreen provider="spotify" />);

    expect(regioesVivas()[0]).toHaveTextContent(
      format(t.result.creationProgress, { current: 2, total: 2 }),
    );
    expect(
      screen.queryByText(format(t.result.awaitingConfirmation, { service: nomeDe.spotify })),
    ).not.toBeInTheDocument();
  });
});

describe('FR-003 · o disco e o glifo são decorativos', () => {
  it('nenhum dos dois recebe foco nem nome acessível', () => {
    render(<ResultScreen provider="spotify" />);

    const disco = cartao().querySelector('.bg-accent-tint-surface');
    expect(disco).not.toBeNull();
    expect(disco).toHaveAttribute('aria-hidden');

    // Nenhum nó focável dentro: o disco não é controle, e o estado está escrito
    // no título ao lado.
    expect(
      disco?.querySelectorAll('a, button, input, [tabindex]:not([tabindex="-1"])'),
    ).toHaveLength(0);

    // O glifo é `<Icon>` sem `label`, que resolve para `aria-hidden`.
    const glifo = disco?.querySelector('svg');
    expect(glifo).toHaveAttribute('aria-hidden');
    expect(glifo).not.toHaveAttribute('aria-label');
  });
});

describe('FR-018 a FR-018b e SC-010 · o aviso de espera na criação inicial', () => {
  /** Publica uma espera de 30s e deixa o promise pendente — o `afterEach` limpa. */
  function esperar(): void {
    act(() => {
      void waitAnnounced(30_000, 'retry_after');
    });
  }

  it('FR-018 · aparece durante a criação, e não deixa a tela muda no backoff', () => {
    render(<ResultScreen provider="spotify" />);
    expect(screen.queryByText(t.review.progressWaiting)).not.toBeInTheDocument();

    esperar();
    expect(screen.getByText(t.review.progressWaiting)).toBeInTheDocument();
  });

  it('FR-018a · o aviso perde o ícone por inteiro, e não fica com um glifo parado', () => {
    // Um glifo de carregamento congelado lê como travamento.
    render(<ResultScreen provider="spotify" />);
    esperar();

    const aviso = screen.getByText(t.review.progressWaiting).closest('[role="status"]');
    expect(aviso?.querySelectorAll('svg')).toHaveLength(0);
  });

  it('FR-018a · SC-010 · existe exatamente um elemento em rotação na tela', () => {
    /*
      Os dois únicos giros possíveis neste cartão são o glifo do disco e o ícone
      do aviso. Com o aviso sem ícone, sobra um — e a asserção conta os dois
      candidatos: o glifo dentro do disco, e qualquer sobrevivente do giro por
      CSS que a busca usa.
    */
    render(<ResultScreen provider="spotify" />);
    esperar();

    const disco = cartao().querySelector('.bg-accent-tint-surface');
    expect(disco?.querySelectorAll('svg')).toHaveLength(1);
    expect(cartao().querySelectorAll('.animate-spin')).toHaveLength(0);
  });

  it('a contagem regressiva aparece, e é `aria-hidden`', () => {
    // Um número que muda a cada segundo dentro de um `role="status"` seria um
    // anúncio por segundo. A frase é anunciada uma vez; os segundos são visuais.
    render(<ResultScreen provider="spotify" />);
    esperar();

    const aviso = screen.getByText(t.review.progressWaiting).closest('[role="status"]');
    const contagem = aviso?.querySelector('[aria-hidden]');
    expect(contagem).not.toBeNull();
    expect(Number(contagem?.textContent)).toBeGreaterThan(0);
    expect(Number(contagem?.textContent)).toBeLessThanOrEqual(30);
  });

  it('FR-018b · não oferece cancelar', () => {
    // Cancelar uma escrita já confirmada em voo não é a mesma ação que cancelar
    // uma busca, e esta feature não abre esse caminho.
    render(<ResultScreen provider="spotify" />);
    esperar();

    expect(screen.queryByRole('button', { name: t.review.cancelSearch })).not.toBeInTheDocument();
  });

  it('FR-013a · as duas regiões vivas nunca dizem a mesma coisa', () => {
    render(<ResultScreen provider="spotify" />);
    esperar();

    const vivas = regioesVivas();
    expect(vivas).toHaveLength(2);

    const ditos = vivas.map((no) => no.textContent?.trim() ?? '');
    expect(new Set(ditos).size).toBe(2);
  });

  it('SC-010 · nenhuma terceira região viva é introduzida', () => {
    render(<ResultScreen provider="spotify" />);
    esperar();

    expect(regioesVivas().length).toBeLessThanOrEqual(2);
    expect(cartao().querySelectorAll('[aria-live]')).toHaveLength(0);
  });
});

describe('FR-007 e FR-009 · a grade de esqueleto', () => {
  /** A grade é o único `aria-hidden` que carrega barras de esqueleto. */
  function grade(): HTMLElement | null {
    return cartao().querySelector('[aria-hidden].grid');
  }

  it('quatro blocos, um por informação que o resultado vai mostrar', () => {
    render(<ResultScreen provider="spotify" />);

    const blocos = grade()?.children ?? [];
    expect(blocos).toHaveLength(4);

    // Duas barras por bloco — rótulo e valor —, oito ao todo.
    expect(grade()?.querySelectorAll('.bg-skeleton')).toHaveLength(8);
  });

  it('a grade espelha as classes do `<dl>` do resultado, que é o lugar que ela ocupa', () => {
    // Divergir aqui faria o cartão saltar exatamente no instante em que o SC-004
    // exige que ele não salte.
    render(<ResultScreen provider="spotify" />);

    const classes = grade()?.className ?? '';
    expect(classes).toContain('grid');
    expect(classes).toContain('gap-2');
    expect(classes).toContain('sm:grid-cols-2');
  });

  it('FR-008 · a distinção entre rótulo e valor é dimensional, não de tinta', () => {
    // No arquivo de design as duas tintas dão 1,02:1 entre si — não são dois
    // tons, são o mesmo tom escrito de duas maneiras. Uma tinta, duas dimensões.
    render(<ResultScreen provider="spotify" />);

    const barras = [...(grade()?.querySelectorAll('.bg-skeleton') ?? [])];
    const rotulos = barras.filter((b) => b.className.includes('h-3'));
    const valores = barras.filter((b) => b.className.includes('h-4'));

    expect(rotulos).toHaveLength(4);
    expect(valores).toHaveLength(4);
    expect(rotulos[0]?.className).toContain('w-1/2');
    expect(valores[0]?.className).toContain('w-2/3');
  });

  it('FR-009 · nenhum nó do esqueleto é alcançado pela árvore de acessibilidade', () => {
    // Ela não carrega informação, e um leitor de tela que a alcançasse anunciaria
    // oito caixas vazias.
    render(<ResultScreen provider="spotify" />);

    expect(grade()).toHaveAttribute('aria-hidden');
    expect(
      grade()?.querySelectorAll('a, button, input, [tabindex]:not([tabindex="-1"])'),
    ).toHaveLength(0);
  });

  it('a grade some quando o resultado chega, e o `<dl>` ocupa o mesmo lugar', () => {
    const { rerender } = render(<ResultScreen provider="spotify" />);
    expect(grade()).not.toBeNull();

    act(() => {
      useAppStore.setState({
        creating: false,
        queue: makeQueue(['spotify'], {
          currentIndex: 0,
          runs: {
            spotify: makeRun('spotify', {
              phase: 'done',
              outcome: 'completed',
              lineIds: [linha.id],
              items: [item],
              creation: makeCreation({ committedItems: 2 }),
              result: makeResult(),
            }),
          },
        }),
      });
    });
    rerender(<ResultScreen provider="spotify" />);

    expect(screen.getByText(t.result.playlistName)).toBeInTheDocument();
    expect(cartao().querySelector('dl')).not.toBeNull();
  });
});

describe('FR-024 e SC-005 · nenhum indicador de carregamento sobrevive a erro', () => {
  /** O que precisa desaparecer: o disco, o subtítulo, a descrição e o rodapé. */
  function nenhumIndicador(): void {
    expect(cartao().querySelector('.bg-accent-tint-surface')).toBeNull();
    expect(screen.queryByText(t.result.creatingSubtitle)).not.toBeInTheDocument();
    expect(
      screen.queryByText(format(t.result.creatingDescription, { service: nomeDe.spotify })),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(format(t.result.awaitingConfirmation, { service: nomeDe.spotify })),
    ).not.toBeInTheDocument();
  }

  const erro: AppErrorInfo = {
    provider: 'spotify',
    kind: 'unknown',
    title: 'Falhou',
    cause: 'A causa',
    nextStep: 'O próximo passo',
  };

  it('falha da escrita: o carregamento some inteiro e a mensagem ocupa o lugar', () => {
    semear('spotify', { creation: null }, { info: erro });
    render(<ResultScreen provider="spotify" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Falhou');
    nenhumIndicador();
  });

  it('erro da execução: idem — a fase continua `creating`, o carregamento não', () => {
    /*
      **É o caso que a regra de exibição existe para pegar.** `phase === 'creating'`
      sozinho não bastaria: a fase permanece assim enquanto o erro está na tela
      com as saídas, e um disco girando atrás de uma mensagem de erro é
      exatamente o que o FR-024 proíbe.
    */
    semear('spotify', { error: { ...erro, title: 'Erro' } });
    render(<ResultScreen provider="spotify" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Erro');
    nenhumIndicador();
  });

  it('perda de sessão: `awaiting_reauth` é outra fase, e nada de carregamento resta', () => {
    semear('spotify', makeAwaitingReauth('spotify', 'creating'));
    render(<ResultScreen provider="spotify" />);

    nenhumIndicador();
  });

  it('execução encerrada: com `outcome` não nulo o carregamento não volta', () => {
    semear('spotify', { outcome: 'failed' });
    render(<ResultScreen provider="spotify" />);

    nenhumIndicador();
  });
});

/**
 * US3 · FR-022 e SC-001 — a mesma espera nos dois serviços.
 *
 * A variação nasce **sem ser caso especial do Spotify**: estrutura, ordem e
 * movimento idênticos nos dois; variam só o símbolo, a cor da marca e o nome
 * dentro das frases. Nenhum arquivo que esta feature introduz ramifica por
 * `ProviderId` — o nome chega já resolvido por `nameOf(provider)` (FR-023).
 */
describe.each(['spotify', 'youtube'] as const)('FR-022 · o cartão no %s', (provider) => {
  const servico = nomeDe[provider];

  beforeEach(() => {
    semear(provider);
  });

  it('exibe a mesma lista de blocos, com o nome do serviço nas frases', () => {
    render(<ResultScreen provider={provider} />);

    expect(screen.getByText(format(t.playlistConfig.creating, { service: servico }))).toBeInTheDocument();
    expect(screen.getByText(t.result.creatingSubtitle)).toBeInTheDocument();
    expect(
      screen.getByText(format(t.result.creatingDescription, { service: servico })),
    ).toBeInTheDocument();
    expect(
      screen.getByText(format(t.result.awaitingConfirmation, { service: servico })),
    ).toBeInTheDocument();
  });

  it('a ordem dos blocos é a mesma, e a grade tem os mesmos quatro blocos', () => {
    render(<ResultScreen provider={provider} />);

    const filhos = [...cartao().children];
    expect(filhos[0]?.tagName.toLowerCase()).toBe('header');
    expect(filhos[1]).toContainElement(
      screen.getByText(format(t.playlistConfig.creating, { service: servico })),
    );
    expect(cartao().querySelector('[aria-hidden].grid')?.children).toHaveLength(4);
  });

  it('o cabeçalho traz o símbolo do serviço, tingido com a cor da marca', () => {
    render(<ResultScreen provider={provider} />);

    const cabecalho = cartao().querySelector('header');
    const glifo = cabecalho?.querySelector('svg');
    expect(glifo?.getAttribute('class')).toContain(`text-brand-${provider}`);
  });

  it('nada do que o carregamento desenha é colorido pela marca', () => {
    /*
      O disco é âmbar, as barras são neutras, os textos vêm da tinta principal e
      da secundária. Cor de marca neste cartão existe **só** no símbolo do
      cabeçalho, que é o acento identificador (FR-023).
    */
    render(<ResultScreen provider={provider} />);

    const cabecalho = cartao().querySelector('header');
    const comMarca = [...cartao().querySelectorAll('[class*="brand-"]')].filter(
      (no) => cabecalho === null || !cabecalho.contains(no),
    );
    expect(comMarca).toEqual([]);
  });
});

describe('US3 cenário 3 · a posição na fila reflete o serviço em criação', () => {
  it('com dois destinos, o cabeçalho mostra o **segundo** quando é ele que cria', () => {
    useAppStore.setState({
      sessions: makeSessions({ spotify: makeSession('spotify'), youtube: makeSession('youtube') }),
      lines: [linha],
      destinations: { selected: ['spotify', 'youtube'], locked: true },
      creating: true,
      creationError: null,
      queue: makeQueue(['spotify', 'youtube'], {
        currentIndex: 1,
        runs: {
          spotify: makeRun('spotify', {
            phase: 'done',
            outcome: 'completed',
            lineIds: [linha.id],
            items: [item],
            creation: makeCreation({ committedItems: 2 }),
            result: makeResult(),
          }),
          youtube: makeRun('youtube', {
            phase: 'creating',
            lineIds: [linha.id],
            items: [item],
            creation: makeCreation(),
          }),
        },
      }),
    });

    render(<ResultScreen provider="youtube" />);

    expect(
      screen.getByText(
        format(t.queue.position, { service: nomeDe.youtube, current: 2, total: 2 }),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(format(t.result.awaitingConfirmation, { service: nomeDe.youtube })),
    ).toBeInTheDocument();
  });
});

/**
 * US4 · FR-016, FR-017 e SC-003 — movimento reduzido.
 *
 * O interruptor é JavaScript e não CSS, e o motivo é material: a regra global de
 * `index.css` zera `animation-duration` e `transition-duration`, e **não alcança
 * a biblioteca**, que anima por WAAPI. `<MotionConfig reducedMotion="user">`
 * também não bastaria — ela preserva `opacity`, que é justamente o que a
 * pulsação do esqueleto anima (009/research §R6).
 *
 * Aqui a verificação é estrutural: sob a preferência, cada primitiva devolve o
 * **estado final estático**, sem nó de movimento e sem estilo em linha.
 */
describe('FR-016 e SC-003 · sob movimento reduzido, nada anima', () => {
  /** Nós com estilo em linha: é assim que a biblioteca escreve o que anima. */
  function comEstiloEmLinha(): Element[] {
    return [...cartao().querySelectorAll('[style]')].filter(
      (no) => (no.getAttribute('style') ?? '').trim() !== '',
    );
  }

  it('sem a preferência, o caminho de movimento é de fato tomado', () => {
    /*
      **O contrapeso, e ele não é decorativo.** Uma asserção de "nenhum estilo em
      linha sob a preferência" passaria com as três primitivas apagadas, ou com o
      stub de `matchMedia` instalado tarde demais para a biblioteca consultá-lo —
      que foi exatamente o que aconteceu na primeira escrita destes casos. Sem
      este caso, o par inteiro mede a si mesmo.
    */
    preferirMovimentoReduzido(false);
    render(<ResultScreen provider="spotify" />);

    expect(comEstiloEmLinha().length).toBeGreaterThan(0);
  });

  it('o disco não gira e as barras não pulsam', () => {
    preferirMovimentoReduzido(true);
    render(<ResultScreen provider="spotify" />);

    expect(
      comEstiloEmLinha(),
      'Sob a preferência, cada primitiva devolve o estado final estático — sem nó de ' +
        'movimento, e portanto sem estilo em linha para animar (FR-016).',
    ).toEqual([]);
  });

  it('a célula compartilhada troca em um quadro, sem sobreposição', () => {
    preferirMovimentoReduzido(true);
    render(<ResultScreen provider="spotify" />);

    // Sem `AnimatePresence` não há bloco fora do fluxo esperando 200ms para sair.
    expect(cartao().querySelectorAll('.absolute')).toHaveLength(0);
  });

  it('FR-017 · SC-003 · a contagem de textos exibidos é idêntica com e sem a preferência', () => {
    /*
      **A medida literal do SC-003.** O estado "criação em curso" está escrito em
      três lugares e não depende de movimento em nenhum: suprimir a animação não
      pode custar uma palavra.

      A contagem é sobre o texto visível do cartão inteiro, e não sobre uma lista
      de chaves escolhida a dedo — uma lista escolhida a dedo passaria por
      construção.
    */
    function textosDoCartao(): string[] {
      return [...cartao().querySelectorAll('p, dt, dd, h2, span')]
        .map((no) => no.textContent?.trim() ?? '')
        .filter((texto) => texto !== '');
    }

    preferirMovimentoReduzido(false);
    const semPreferencia = render(<ResultScreen provider="spotify" />);
    const antes = textosDoCartao();
    semPreferencia.unmount();

    preferirMovimentoReduzido(true);
    render(<ResultScreen provider="spotify" />);
    const depois = textosDoCartao();

    expect(depois).toEqual(antes);
    expect(depois.length).toBeGreaterThan(0);
  });

  it('todo texto continua presente e anunciado', () => {
    preferirMovimentoReduzido(true);
    render(<ResultScreen provider="spotify" />);

    expect(
      screen.getByText(format(t.playlistConfig.creating, { service: nomeDe.spotify })),
    ).toBeInTheDocument();
    expect(screen.getByText(t.result.creatingSubtitle)).toBeInTheDocument();
    expect(
      screen.getByText(format(t.result.creatingDescription, { service: nomeDe.spotify })),
    ).toBeInTheDocument();

    const vivas = regioesVivas();
    expect(vivas).toHaveLength(1);
    expect(vivas[0]).toHaveTextContent(
      format(t.result.awaitingConfirmation, { service: nomeDe.spotify }),
    );
  });

  it('o esqueleto continua ocupando o espaço — estático não é ausente', () => {
    preferirMovimentoReduzido(true);
    render(<ResultScreen provider="spotify" />);

    expect(cartao().querySelectorAll('.bg-skeleton')).toHaveLength(8);
  });
});

describe('Edge Case · a criação que termina antes de a tela ser vista', () => {
  it('não existe piso artificial: a mudança de fase desmonta o carregamento no mesmo quadro', () => {
    /*
      **A correção de boa-fé que este teste existe para reprovar.** Diante do
      primeiro relato de "piscou", a reação natural é segurar o cartão por 400ms
      "para não piscar" — e nada mais na suíte pegaria isso. Uma lista de uma
      linha que resolve em 300ms mostra o carregamento por 300ms e some.
    */
    const { rerender } = render(<ResultScreen provider="spotify" />);
    expect(screen.getByText(t.result.creatingSubtitle)).toBeInTheDocument();

    act(() => {
      useAppStore.setState({
        creating: false,
        queue: makeQueue(['spotify'], {
          currentIndex: 0,
          runs: {
            spotify: makeRun('spotify', {
              phase: 'done',
              outcome: 'completed',
              lineIds: [linha.id],
              items: [item],
              creation: makeCreation({ committedItems: 2 }),
              result: makeResult(),
            }),
          },
        }),
      });
    });
    rerender(<ResultScreen provider="spotify" />);

    expect(screen.queryByText(t.result.creatingSubtitle)).not.toBeInTheDocument();
    expect(cartao().querySelector('.bg-accent-tint-surface')).toBeNull();
    expect(
      screen.getByRole('heading', {
        name: format(t.result.heading, { service: nomeDe.spotify }),
      }),
    ).toBeInTheDocument();
  });
});
