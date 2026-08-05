import { render } from '@testing-library/react';
import axe from 'axe-core';
import { beforeEach, describe, expect, it } from 'vitest';

import { CredentialStep } from '@/features/credential/CredentialStep';
import { InputScreen } from '@/features/input/InputScreen';
import { ResultScreen } from '@/features/result/ResultScreen';
import { ReviewScreen } from '@/features/review/ReviewScreen';
import { createRefresher } from '@/services/spotify/auth';
import { configureSpotifyClient } from '@/services/spotify/client';
import { useAppStore } from '@/store';

import { makeCandidate, makeItem, makeLine, makeSession } from '../fixtures/factories';

const CLIENT_ID = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';

/**
 * axe-core nas quatro etapas (FR-046).
 *
 * As regras de contraste ficam de fora: happy-dom não calcula estilo o
 * suficiente para avaliá-las, e um resultado falso seria pior que nenhum. O
 * contraste é responsabilidade dos tokens de `src/styles/index.css`.
 */
async function semViolacoes(container: HTMLElement): Promise<void> {
  const resultado = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false } },
  });

  const descricao = resultado.violations
    .map((violation) => `${violation.id}: ${violation.help}`)
    .join('\n');

  expect(resultado.violations, descricao).toHaveLength(0);
}

beforeEach(() => {
  configureSpotifyClient({
    getSession: () => useAppStore.getState().session,
    saveSession: () => undefined,
    clearSession: () => undefined,
    refresh: createRefresher(() => CLIENT_ID),
  });
});

describe('Acessibilidade das quatro etapas', () => {
  it('etapa 1 — credencial sem credencial salva', async () => {
    const { container } = render(<CredentialStep />);
    await semViolacoes(container);
  });

  it('etapa 1 — credencial salva e mascarada', async () => {
    useAppStore.getState().setCredential(CLIENT_ID);
    const { container } = render(<CredentialStep />);
    await semViolacoes(container);
  });

  it('etapa 2 — entrada', async () => {
    useAppStore.setState({ rawText: 'Bohemian Rhapsody - Queen' });
    const { container } = render(<InputScreen />);
    await semViolacoes(container);
  });

  it('etapa 3 — revisão com os três status', async () => {
    useAppStore.setState({
      session: makeSession(),
      existingNames: [],
      items: [
        makeItem({
          line: makeLine({ id: 'l0', index: 0, raw: 'Bohemian Rhapsody - Queen' }),
          candidates: [makeCandidate({ id: 'a' })],
        }),
        makeItem({
          line: makeLine({ id: 'l1', index: 1, raw: 'Imagine - Jhon Lennon' }),
          status: 'uncertain',
          candidates: [makeCandidate({ id: 'b' })],
          included: false,
        }),
        makeItem({
          line: makeLine({
            id: 'l2',
            index: 2,
            raw: 'linha ruim',
            title: '',
            artist: '',
            parseStatus: 'unparsed',
          }),
          status: 'unparsed',
          candidates: [],
          selectedUri: null,
          included: false,
        }),
      ],
    });

    const { container } = render(<ReviewScreen />);
    await semViolacoes(container);
  });

  it('etapa 4 — resultado', async () => {
    useAppStore.setState({
      session: makeSession(),
      result: {
        playlistId: 'p1',
        playlistUrl: 'https://open.spotify.com/playlist/p1',
        playlistName: 'Clássicos',
        effectivePath: 'Sua Biblioteca / Fulano de Teste / Clássicos',
        addedCount: 3,
        skippedCount: 1,
        failedLines: ['Faixa Inexistente - Ninguém'],
      },
    });

    const { container } = render(<ResultScreen />);
    await semViolacoes(container);
  });
});
