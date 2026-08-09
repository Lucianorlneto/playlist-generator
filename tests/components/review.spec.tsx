/**
 * Tela de revisão (US2, FR-019, FR-023 a FR-025).
 *
 * A revisão passou a ser **por serviço**: os itens vivem na execução daquele
 * provedor, não em um estado global. O que não mudou é o contrato com o usuário
 * — Confiante marcado, Incerta desmarcada, ordem original preservada, e uma
 * re-busca de linha que não encosta nas demais.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import type { MatchItem } from '@/domain/types';
import { ReviewScreen } from '@/features/review/ReviewScreen';
import { t } from '@/i18n/pt-BR';
import { configureProviderClient } from '@/services/providers/http';
import { createRefresher } from '@/services/providers/spotify/auth';
import { useAppStore } from '@/store';

import {
  makeCandidate,
  makeItem,
  makeLine,
  makeQueue,
  makeRun,
  makeSession,
  makeSessions,
} from '../fixtures/factories';
import { requestLog, setCatalog } from '../msw/handlers';

const CLIENT_ID = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';

beforeEach(() => {
  configureProviderClient('spotify', {
    getSession: () => makeSession('spotify'),
    saveSession: () => undefined,
    clearSession: () => undefined,
    refresh: createRefresher(() => CLIENT_ID),
  });
});

/** Instala os itens na execução do Spotify, em fase de revisão. */
function seedRun(items: MatchItem[]) {
  const lines = items.map((item) => item.line);
  useAppStore.setState({
    sessions: makeSessions({ spotify: makeSession('spotify') }),
    lines,
    destinations: { selected: ['spotify'], locked: false },
    queue: makeQueue(['spotify'], {
      currentIndex: 0,
      runs: {
        spotify: makeRun('spotify', {
          phase: 'review',
          lineIds: lines.map((line) => line.id),
          items,
        }),
      },
    }),
  });
}

function seedItems() {
  const confident = makeItem({
    line: makeLine({ id: 'l0', index: 0, raw: 'Bohemian Rhapsody - Queen' }),
    status: 'confident',
    candidates: [makeCandidate({ id: 'bohemian' })],
    included: true,
  });

  const uncertain = makeItem({
    line: makeLine({
      id: 'l1',
      index: 1,
      raw: 'Imagine - Jhon Lennon',
      title: 'Imagine',
      artist: 'Jhon Lennon',
    }),
    status: 'uncertain',
    candidates: Array.from({ length: 6 }, (_, index) =>
      makeCandidate({
        id: `alt${index}`,
        title: `Imagine ${index}`,
        artists: ['John Lennon'],
        score: 0.7 - index * 0.01,
      }),
    ).slice(0, 5),
    included: false,
  });

  const unparsed = makeItem({
    line: makeLine({
      id: 'l2',
      index: 2,
      raw: 'linha sem separador nenhum',
      title: '',
      artist: '',
      parseStatus: 'unparsed',
    }),
    status: 'unparsed',
    candidates: [],
    selectedUri: null,
    included: false,
  });

  seedRun([confident, uncertain, unparsed]);
}

/** Itens da execução corrente — a leitura derivada que a tela também usa. */
function items(): MatchItem[] {
  return useAppStore.getState().items();
}

function itemById(id: string): MatchItem | undefined {
  return items().find((entry) => entry.line.id === id);
}

function searchRequests() {
  return requestLog.filter((entry) => entry.endpoint === 'search');
}

describe('Tela de revisão (US2)', () => {
  it('exibe os três status', () => {
    seedItems();
    render(<ReviewScreen provider="spotify" />);

    expect(screen.getByText(t.review.status.confident)).toBeInTheDocument();
    expect(screen.getByText(t.review.status.uncertain)).toBeInTheDocument();
    expect(screen.getByText(t.review.status.unparsed)).toBeInTheDocument();
  });

  it('marca Confiantes e deixa Incertas desmarcadas (FR-023)', () => {
    seedItems();
    render(<ReviewScreen provider="spotify" />);

    const caixas = screen.getAllByRole('checkbox');
    expect(caixas[0]).toBeChecked();
    expect(caixas[1]).not.toBeChecked();
    expect(caixas[2]).toBeDisabled();
  });

  it('mantém a ordem original das linhas', () => {
    seedItems();
    // Execução fora de ordem de propósito: a tela precisa reordenar por índice.
    useAppStore.setState((state) => {
      const run = state.queue.runs.spotify;
      if (run === undefined) return state;
      return {
        queue: {
          ...state.queue,
          runs: { ...state.queue.runs, spotify: { ...run, items: [...run.items].reverse() } },
        },
      };
    });
    render(<ReviewScreen provider="spotify" />);

    const linhas = within(screen.getByRole('list', { name: t.review.listLabel })).getAllByRole(
      'listitem',
    );
    expect(linhas[0]).toHaveTextContent('Bohemian Rhapsody - Queen');
    expect(linhas[2]).toHaveTextContent('linha sem separador nenhum');
  });

  it('mostra no máximo 5 candidatas alternativas (FR-023)', async () => {
    const user = userEvent.setup();
    seedItems();
    render(<ReviewScreen provider="spotify" />);

    const alternativas = screen.getAllByRole('button', { name: t.review.alternatives });
    await user.click(alternativas[1]!);

    const escolher = screen.getAllByRole('button', { name: t.review.chooseCandidate });
    expect(escolher.length).toBeLessThanOrEqual(5);
    expect(escolher.length).toBeGreaterThan(0);
  });

  it('escolher uma alternativa marca o item e o torna Confiante', async () => {
    const user = userEvent.setup();
    seedItems();
    render(<ReviewScreen provider="spotify" />);

    await user.click(screen.getAllByRole('button', { name: t.review.alternatives })[1]!);
    await user.click(screen.getAllByRole('button', { name: t.review.chooseCandidate })[0]!);

    const item = itemById('l1');
    expect(item?.status).toBe('confident');
    expect(item?.included).toBe(true);
  });

  it('descartar remove o item da playlist e permite reincluir', async () => {
    const user = userEvent.setup();
    seedItems();
    render(<ReviewScreen provider="spotify" />);

    await user.click(screen.getAllByRole('button', { name: t.review.alternatives })[0]!);
    await user.click(screen.getByRole('button', { name: t.review.discardItem }));

    expect(itemById('l0')?.status).toBe('discarded');
    expect(itemById('l0')?.included).toBe(false);

    await user.click(screen.getByRole('button', { name: t.review.restoreItem }));
    expect(itemById('l0')?.status).toBe('confident');
  });

  it('editar uma linha só busca de novo na confirmação', async () => {
    const user = userEvent.setup();
    setCatalog([
      {
        id: 'wonderwall',
        name: 'Wonderwall',
        artists: ['Oasis'],
        album: '(Whats the Story) Morning Glory?',
        durationMs: 258_906,
      },
    ]);
    seedItems();
    render(<ReviewScreen provider="spotify" />);

    await user.click(screen.getAllByRole('button', { name: t.review.editLine })[2]!);

    const campo = screen.getByLabelText(t.review.editLineLabel);
    await user.clear(campo);
    await user.type(campo, 'Wonderwall - Oasis');

    // Digitar não dispara busca — nem uma requisição até aqui.
    expect(searchRequests()).toHaveLength(0);

    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(itemById('l2')?.status).toBe('confident');
    });

    expect(searchRequests().length).toBeGreaterThan(0);
    expect(itemById('l2')?.line.title).toBe('Wonderwall');
  });

  it('a re-busca de uma linha não altera as demais', async () => {
    const user = userEvent.setup();
    setCatalog([
      {
        id: 'wonderwall',
        name: 'Wonderwall',
        artists: ['Oasis'],
        album: 'Morning Glory',
        durationMs: 258_906,
      },
    ]);
    seedItems();
    const antes = items();
    render(<ReviewScreen provider="spotify" />);

    await user.click(screen.getAllByRole('button', { name: t.review.editLine })[2]!);
    const campo = screen.getByLabelText(t.review.editLineLabel);
    await user.clear(campo);
    await user.type(campo, 'Wonderwall - Oasis{Enter}');

    await waitFor(() => {
      expect(itemById('l2')?.status).toBe('confident');
    });

    const depois = items();
    // Identidade preservada: os outros itens são literalmente os mesmos objetos.
    expect(depois.find((item) => item.line.id === 'l0')).toBe(
      antes.find((item) => item.line.id === 'l0'),
    );
    expect(depois.find((item) => item.line.id === 'l1')).toBe(
      antes.find((item) => item.line.id === 'l1'),
    );
  });

  it('exibe o selo de duplicata', () => {
    const base = makeItem({
      line: makeLine({ id: 'l0', index: 0, raw: 'Bohemian Rhapsody - Queen' }),
    });
    const duplicata = makeItem({
      line: makeLine({ id: 'l1', index: 1, raw: 'Bohemian Rhapsody - Queen' }),
      duplicateOf: 'l0',
      included: false,
    });
    seedRun([base, duplicata]);

    render(<ReviewScreen provider="spotify" />);

    expect(screen.getByText(t.review.status.duplicate)).toBeInTheDocument();
    expect(screen.getByText(t.review.statusHint.duplicate)).toBeInTheDocument();
  });
});

/**
 * Piso de legibilidade da grade densa (FR-044) — T044.
 *
 * A revisão é a tela mais densa do aplicativo e a que o usuário lê linha a
 * linha. Personalidade tipográfica não pode sair cara justamente aqui: se o
 * nome da faixa ou o do artista encolherem para caber mais linha na tela, a
 * feature terá trocado legibilidade por estilo — e é o tipo de troca que
 * ninguém percebe fazendo, porque cada passo isolado parece pequeno.
 *
 * O piso é **o tamanho que existia antes desta feature**: `text-sm` do Tailwind,
 * 0,875rem, com entrelinha de 1,25rem (≈ 1,43). O teste lê os degraus declarados
 * em `src/styles/index.css` e falha se algum deles ficar abaixo disso.
 */
describe('FR-044 · piso de legibilidade da grade densa', () => {
  const INDEX_CSS = readFileSync(join(process.cwd(), 'src/styles/index.css'), 'utf8');

  /** Valor de um degrau declarado no `@theme`, em rem. */
  function remOf(token: string): number {
    const match = new RegExp(`--text-${token}:\\s*([\\d.]+)rem\\s*;`, 'u').exec(INDEX_CSS);
    expect(match, `--text-${token} não está declarado em src/styles/index.css`).not.toBeNull();
    return Number(match?.[1]);
  }

  function lineHeightOf(token: string): number {
    const match = new RegExp(`--text-${token}--line-height:\\s*([\\d.]+)\\s*;`, 'u').exec(INDEX_CSS);
    expect(match, `--text-${token}--line-height não está declarado`).not.toBeNull();
    return Number(match?.[1]);
  }

  /**
   * O que a versão anterior à 005 usava nestas duas linhas: `text-sm`, que no
   * Tailwind é 0,875rem com entrelinha de 1,25rem.
   *
   * A entrelinha é comparada em **valor absoluto**, não em razão. A razão
   * sozinha enganaria: 1,4 sobre um corpo maior produz uma linha mais alta que
   * 1,43 sobre um corpo menor, e o que afeta a leitura de um bloco denso é a
   * altura da linha, não o multiplicador que a produziu.
   */
  const PISO_REM = 0.875;
  const PISO_ENTRELINHA_REM = 1.25;

  /**
   * **O degrau mudou de nome; o piso não mudou de valor.**
   *
   * Até a feature 006 o nome da faixa usava `--text-item` e a linha de artista
   * usava `--text-body` — dois degraus distintos que mediam o mesmo 0,9375rem e
   * só divergiam em entrelinha e peso. A 007 renormalizou a escala e fundiu os
   * dois em `--text-body` (`contracts/token-migration.md` §4), que é o piso de
   * texto com conteúdo do sistema.
   *
   * O que este bloco protege continua sendo o mesmo: a tela mais densa do
   * aplicativo não pode ser onde a legibilidade sai barata. O piso permanece nos
   * 0,875rem de `text-sm`, agora conferido num degrau só porque só há um.
   */
  it('o nome de faixa e a linha de artista usam `--text-body`, e ele não encolheu', () => {
    expect(remOf('body')).toBeGreaterThanOrEqual(PISO_REM);
    expect(remOf('body') * lineHeightOf('body')).toBeGreaterThanOrEqual(PISO_ENTRELINHA_REM);
  });

  it('`--text-item` não existe mais — a escala tem seis degraus, não sete', () => {
    // Um degrau removido da escala não quebra nada: o utilitário deixa de
    // emitir CSS e o texto herda o tamanho de cima, em silêncio. Esta asserção
    // é o que impede alguém de "consertar" a falha reintroduzindo o nome.
    expect(INDEX_CSS).not.toMatch(/--text-item\s*:/u);
  });

  it('a linha renderizada aplica de fato esse degrau, no nome e no artista', () => {
    // Sem esta asserção, o degrau poderia ficar generoso no arquivo de estilo e
    // a linha continuar usando outro — o piso valeria no papel.
    seedItems();
    const { container } = render(<ReviewScreen provider="spotify" />);

    const linhas = container.querySelectorAll('.text-body');
    expect(linhas.length, 'nenhum elemento usa `text-body` na revisão').toBeGreaterThanOrEqual(2);
    expect([...linhas].some((el) => el.textContent !== '')).toBe(true);
  });

  it('o numeral é tabular — a coluna depende disso', () => {
    seedItems();
    const { container } = render(<ReviewScreen provider="spotify" />);

    const numerais = container.querySelectorAll('.data-numeral');
    expect(numerais.length).toBeGreaterThan(0);
    // `data-numeral` carrega `font-variant-numeric: tabular-nums`; T004 mediu
    // 4,6 px de diferença entre `08` e `11` sem ele.
    expect(INDEX_CSS).toMatch(/@utility data-numeral[\s\S]*?tabular-nums/u);
  });

  it('o numeral exibido é o índice da linha de entrada, base 1 (design.md §5)', () => {
    seedItems();
    const { container } = render(<ReviewScreen provider="spotify" />);

    /*
      Cada linha desenha o numeral duas vezes — uma na goteira, uma como prefixo
      em linha —, e o CSS esconde a que não vale no breakpoint corrente. Não há
      risco de as duas divergirem: ambas leem a mesma variável, calculada uma vez
      por `lineNumeral(item.line.index)`. Por isso o teste compara o conjunto.
    */
    const numerais = [
      ...new Set(
        [...container.querySelectorAll('.data-numeral')].map((node) => node.textContent?.trim()),
      ),
    ];
    // Três itens semeados com index 0, 1 e 2 — preenchidos a duas casas.
    expect(numerais).toEqual(['01', '02', '03']);
  });
});
