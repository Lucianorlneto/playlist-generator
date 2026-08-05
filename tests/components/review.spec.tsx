import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { ReviewScreen } from '@/features/review/ReviewScreen';
import { t } from '@/i18n/pt-BR';
import { createRefresher } from '@/services/spotify/auth';
import { configureSpotifyClient } from '@/services/spotify/client';
import { useAppStore } from '@/store';

import { makeCandidate, makeItem, makeLine, makeSession } from '../fixtures/factories';
import { requestLog, setCatalog } from '../msw/handlers';

const CLIENT_ID = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';

beforeEach(() => {
  configureSpotifyClient({
    getSession: () => makeSession(),
    saveSession: () => undefined,
    clearSession: () => undefined,
    refresh: createRefresher(() => CLIENT_ID),
  });
});

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

  useAppStore.setState({ items: [confident, uncertain, unparsed] });
}

function searchRequests() {
  return requestLog.filter((entry) => entry.endpoint === 'search');
}

describe('Tela de revisão (US2)', () => {
  it('exibe os três status', () => {
    seedItems();
    render(<ReviewScreen />);

    expect(screen.getByText(t.review.status.confident)).toBeInTheDocument();
    expect(screen.getByText(t.review.status.uncertain)).toBeInTheDocument();
    expect(screen.getByText(t.review.status.unparsed)).toBeInTheDocument();
  });

  it('marca Confiantes e deixa Incertas desmarcadas (FR-025)', () => {
    seedItems();
    render(<ReviewScreen />);

    const caixas = screen.getAllByRole('checkbox');
    expect(caixas[0]).toBeChecked();
    expect(caixas[1]).not.toBeChecked();
    expect(caixas[2]).toBeDisabled();
  });

  it('mantém a ordem original das linhas (FR-019)', () => {
    seedItems();
    // Store fora de ordem de propósito: a tela precisa reordenar por índice.
    useAppStore.setState((state) => ({ items: [...state.items].reverse() }));
    render(<ReviewScreen />);

    const linhas = within(screen.getByRole('list', { name: t.review.listLabel })).getAllByRole(
      'listitem',
    );
    expect(linhas[0]).toHaveTextContent('Bohemian Rhapsody - Queen');
    expect(linhas[2]).toHaveTextContent('linha sem separador nenhum');
  });

  it('mostra no máximo 5 candidatas alternativas (FR-023)', async () => {
    const user = userEvent.setup();
    seedItems();
    render(<ReviewScreen />);

    const alternativas = screen.getAllByRole('button', { name: t.review.alternatives });
    await user.click(alternativas[1]!);

    const escolher = screen.getAllByRole('button', { name: t.review.chooseCandidate });
    expect(escolher.length).toBeLessThanOrEqual(5);
    expect(escolher.length).toBeGreaterThan(0);
  });

  it('escolher uma alternativa marca o item e o torna Confiante (FR-024)', async () => {
    const user = userEvent.setup();
    seedItems();
    render(<ReviewScreen />);

    await user.click(screen.getAllByRole('button', { name: t.review.alternatives })[1]!);
    await user.click(screen.getAllByRole('button', { name: t.review.chooseCandidate })[0]!);

    const item = useAppStore.getState().items.find((entry) => entry.line.id === 'l1');
    expect(item?.status).toBe('confident');
    expect(item?.included).toBe(true);
  });

  it('descartar remove o item da playlist e permite reincluir (FR-024)', async () => {
    const user = userEvent.setup();
    seedItems();
    render(<ReviewScreen />);

    await user.click(screen.getAllByRole('button', { name: t.review.alternatives })[0]!);
    await user.click(screen.getByRole('button', { name: t.review.discardItem }));

    let item = useAppStore.getState().items.find((entry) => entry.line.id === 'l0');
    expect(item?.status).toBe('discarded');
    expect(item?.included).toBe(false);

    await user.click(screen.getByRole('button', { name: t.review.restoreItem }));
    item = useAppStore.getState().items.find((entry) => entry.line.id === 'l0');
    expect(item?.status).toBe('confident');
  });

  it('editar uma linha só busca de novo na confirmação (FR-017)', async () => {
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
    render(<ReviewScreen />);

    await user.click(screen.getAllByRole('button', { name: t.review.editLine })[2]!);

    const campo = screen.getByLabelText(t.review.editLineLabel);
    await user.clear(campo);
    await user.type(campo, 'Wonderwall - Oasis');

    // Digitar não dispara busca — nem uma requisição até aqui.
    expect(searchRequests()).toHaveLength(0);

    await user.keyboard('{Enter}');

    await waitFor(() => {
      const editado = useAppStore.getState().items.find((entry) => entry.line.id === 'l2');
      expect(editado?.status).toBe('confident');
    });

    expect(searchRequests().length).toBeGreaterThan(0);
    const editado = useAppStore.getState().items.find((entry) => entry.line.id === 'l2');
    expect(editado?.line.title).toBe('Wonderwall');
  });

  it('a re-busca de uma linha não altera as demais (FR-017)', async () => {
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
    const antes = useAppStore.getState().items;
    render(<ReviewScreen />);

    await user.click(screen.getAllByRole('button', { name: t.review.editLine })[2]!);
    const campo = screen.getByLabelText(t.review.editLineLabel);
    await user.clear(campo);
    await user.type(campo, 'Wonderwall - Oasis{Enter}');

    await waitFor(() => {
      const editado = useAppStore.getState().items.find((entry) => entry.line.id === 'l2');
      expect(editado?.status).toBe('confident');
    });

    const depois = useAppStore.getState().items;
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
    useAppStore.setState({ items: [base, duplicata] });

    render(<ReviewScreen />);

    expect(screen.getByText(t.review.status.duplicate)).toBeInTheDocument();
    expect(screen.getByText(t.review.statusHint.duplicate)).toBeInTheDocument();
  });
});
