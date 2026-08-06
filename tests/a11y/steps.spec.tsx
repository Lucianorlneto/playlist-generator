/**
 * axe-core em todas as etapas do fluxo, incluindo as telas novas da 002
 * (FR-047): seletor de destinos, indicação de fila, estimativa de cota, ajuste
 * de lista para destino posterior e resumo consolidado.
 *
 * As regras de contraste ficam de fora: happy-dom não calcula estilo o
 * suficiente para avaliá-las, e um resultado falso seria pior que nenhum. O
 * contraste é responsabilidade dos tokens de `src/styles/index.css`.
 */

import { render } from '@testing-library/react';
import axe from 'axe-core';
import { beforeEach, describe, expect, it } from 'vitest';

import { CredentialStep } from '@/features/credential/CredentialStep';
import { DestinationsStep } from '@/features/destinations/DestinationsStep';
import { InputScreen } from '@/features/input/InputScreen';
import { ListReduction } from '@/features/input/ListReduction';
import { QueueIndicator } from '@/features/queue/QueueIndicator';
import { QuotaEstimateScreen } from '@/features/quota/QuotaEstimateScreen';
import { ResultScreen } from '@/features/result/ResultScreen';
import { ReviewScreen } from '@/features/review/ReviewScreen';
import { SummaryScreen } from '@/features/summary/SummaryScreen';
import { configureProviderClient } from '@/services/providers/http';
import { createRefresher } from '@/services/providers/spotify/auth';
import { useAppStore } from '@/store';

import {
  makeCandidate,
  makeCredentials,
  makeItem,
  makeLine,
  makeQueue,
  makeResult,
  makeRun,
  makeSession,
  makeSessions,
} from '../fixtures/factories';

const CLIENT_ID = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
const YT_CLIENT_ID = '123-abc.apps.googleusercontent.com';

async function semViolacoes(container: HTMLElement): Promise<void> {
  const resultado = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false } },
  });

  const descricao = resultado.violations
    .map((violation) => `${violation.id}: ${violation.help}`)
    .join('\n');

  expect(resultado.violations, descricao).toHaveLength(0);
}

const linhas = [
  makeLine({ id: 'l0', index: 0, raw: 'Bohemian Rhapsody - Queen' }),
  makeLine({ id: 'l1', index: 1, raw: 'Imagine - Jhon Lennon' }),
  makeLine({
    id: 'l2',
    index: 2,
    raw: 'linha ruim',
    title: '',
    artist: '',
    parseStatus: 'unparsed',
  }),
];

const itens = [
  makeItem({ line: linhas[0], candidates: [makeCandidate({ id: 'a' })] }),
  makeItem({
    line: linhas[1],
    status: 'uncertain',
    candidates: [makeCandidate({ id: 'b' })],
    included: false,
  }),
  makeItem({
    line: linhas[2],
    status: 'unparsed',
    candidates: [],
    selectedUri: null,
    included: false,
  }),
];

beforeEach(() => {
  configureProviderClient('spotify', {
    getSession: () => useAppStore.getState().sessions.spotify,
    saveSession: () => undefined,
    clearSession: () => undefined,
    refresh: createRefresher(() => CLIENT_ID),
  });
});

describe('Acessibilidade do fluxo (FR-047)', () => {
  it('configuração — sem nenhuma credencial salva', async () => {
    const { container } = render(<CredentialStep />);
    await semViolacoes(container);
  });

  it('configuração — com credencial salva e mascarada', async () => {
    useAppStore.getState().setCredential('spotify', CLIENT_ID);
    const { container } = render(<CredentialStep />);
    await semViolacoes(container);
  });

  it('destinos — um habilitado e um desabilitado com motivo', async () => {
    useAppStore.setState({ credentials: makeCredentials({ spotify: CLIENT_ID }) });
    useAppStore.getState().reconcileDestinations();

    const { container } = render(<DestinationsStep />);
    await semViolacoes(container);
  });

  it('destinos — ambos habilitados e marcados', async () => {
    useAppStore.setState({
      credentials: makeCredentials({ spotify: CLIENT_ID, youtube: YT_CLIENT_ID }),
    });
    useAppStore.getState().reconcileDestinations();

    const { container } = render(<DestinationsStep />);
    await semViolacoes(container);
  });

  it('entrada', async () => {
    useAppStore.setState({ rawText: 'Bohemian Rhapsody - Queen' });
    const { container } = render(<InputScreen />);
    await semViolacoes(container);
  });

  it('indicação de fila com dois destinos', async () => {
    useAppStore.setState({
      destinations: { selected: ['spotify', 'youtube'], locked: true },
      queue: makeQueue(['spotify', 'youtube'], { currentIndex: 0 }),
    });

    const { container } = render(<QueueIndicator />);
    await semViolacoes(container);
  });

  it('estimativa de cota — dentro do saldo', async () => {
    useAppStore.setState({
      lines: linhas,
      destinations: { selected: ['youtube'], locked: false },
      queue: makeQueue(['youtube'], {
        currentIndex: 0,
        runs: {
          youtube: makeRun('youtube', {
            phase: 'estimate',
            lineIds: linhas.map((line) => line.id),
            estimate: {
              provider: 'youtube',
              lineCount: 3,
              selectedCount: 3,
              estimatedUnits: 500,
              availableUnits: 10_000,
              blocked: false,
              maxLinesThatFit: 66,
            },
          }),
        },
      }),
    });

    const { container } = render(<QuotaEstimateScreen provider="youtube" />);
    await semViolacoes(container);
  });

  it('estimativa de cota — bloqueada por saldo insuficiente', async () => {
    useAppStore.setState({
      lines: linhas,
      destinations: { selected: ['youtube'], locked: false },
      queue: makeQueue(['youtube'], {
        currentIndex: 0,
        runs: {
          youtube: makeRun('youtube', {
            phase: 'estimate',
            lineIds: linhas.map((line) => line.id),
            estimate: {
              provider: 'youtube',
              lineCount: 200,
              selectedCount: 200,
              estimatedUnits: 30_000,
              availableUnits: 10_000,
              blocked: true,
              maxLinesThatFit: 66,
            },
          }),
        },
      }),
    });

    const { container } = render(<QuotaEstimateScreen provider="youtube" />);
    await semViolacoes(container);
  });

  it('ajuste de lista para destino posterior', async () => {
    const { container } = render(
      <ListReduction
        provider="youtube"
        lines={linhas}
        lineIds={linhas.map((line) => line.id)}
        maxLinesThatFit={2}
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );
    await semViolacoes(container);
  });

  it('revisão com os três status', async () => {
    useAppStore.setState({
      sessions: makeSessions({ spotify: makeSession('spotify') }),
      existingNames: [],
      lines: linhas,
      destinations: { selected: ['spotify'], locked: false },
      queue: makeQueue(['spotify'], {
        currentIndex: 0,
        runs: {
          spotify: makeRun('spotify', {
            phase: 'review',
            lineIds: linhas.map((line) => line.id),
            items: itens,
          }),
        },
      }),
    });

    const { container } = render(<ReviewScreen provider="spotify" />);
    await semViolacoes(container);
  });

  it('resultado de um serviço', async () => {
    useAppStore.setState({
      sessions: makeSessions({ spotify: makeSession('spotify') }),
      lines: linhas,
      destinations: { selected: ['spotify'], locked: true },
      queue: makeQueue(['spotify'], {
        currentIndex: 0,
        runs: {
          spotify: makeRun('spotify', {
            phase: 'done',
            outcome: 'completed',
            lineIds: linhas.map((line) => line.id),
            items: itens,
            result: makeResult({ failedLines: ['Faixa Inexistente - Ninguém'] }),
          }),
        },
      }),
    });

    const { container } = render(<ResultScreen provider="spotify" />);
    await semViolacoes(container);
  });

  it('resumo consolidado com dois destinos e listas divergentes', async () => {
    useAppStore.setState({
      sessions: makeSessions({
        spotify: makeSession('spotify'),
        youtube: makeSession('youtube'),
      }),
      lines: linhas,
      destinations: { selected: ['spotify', 'youtube'], locked: true },
      queue: makeQueue(['spotify', 'youtube'], {
        currentIndex: 1,
        runs: {
          spotify: makeRun('spotify', {
            phase: 'done',
            outcome: 'completed',
            lineIds: linhas.map((line) => line.id),
            frozenLines: linhas,
            items: itens,
            result: makeResult(),
          }),
          youtube: makeRun('youtube', {
            phase: 'done',
            outcome: 'partial',
            lineIds: ['l0'],
            frozenLines: [linhas[0]!],
            items: [itens[0]!],
            result: makeResult({
              provider: 'youtube',
              playlistUrl: 'https://www.youtube.com/playlist?list=PL_teste',
              addedCount: 1,
              incompleteByQuota: true,
              failedLines: ['Imagine - Jhon Lennon'],
            }),
          }),
        },
      }),
    });

    const { container } = render(<SummaryScreen />);
    await semViolacoes(container);
  });
});
