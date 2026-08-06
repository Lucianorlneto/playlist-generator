/**
 * Resultado do YouTube (FR-027, FR-028, FR-032).
 *
 * O que esta tela existe para não deixar implícito:
 *
 * - **é uma playlist do YouTube, não do YouTube Music** (FR-028). A plataforma
 *   não expõe o YouTube Music a terceiros, e sugerir o contrário seria prometer
 *   o que não foi feito;
 * - **pastas não são gerenciadas** e o caminho exibido é o real (FR-027);
 * - **a playlist incompleta por cota continua na conta** (FR-032), com o aviso
 *   de que repetir com o mesmo nome será bloqueado.
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { ResultScreen } from '@/features/result/ResultScreen';
import { format, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';

import {
  makeItem,
  makeLine,
  makeQueue,
  makeResult,
  makeRun,
  makeSession,
  makeSessions,
  makeVideoCandidate,
} from '../fixtures/factories';

const youtube = t.providers.youtube;

const linha = makeLine({ id: 'l0', index: 0, raw: 'Bohemian Rhapsody - Queen' });
const item = makeItem({
  line: linha,
  candidates: [makeVideoCandidate({ id: 'v1' })],
  selectedUri: 'v1',
  included: true,
});

function seedResult(overrides: Parameters<typeof makeResult>[0] = {}) {
  useAppStore.setState({
    sessions: makeSessions({ youtube: makeSession('youtube') }),
    lines: [linha],
    destinations: { selected: ['youtube'], locked: true },
    queue: makeQueue(['youtube'], {
      currentIndex: 0,
      runs: {
        youtube: makeRun('youtube', {
          phase: 'done',
          outcome: overrides.incompleteByQuota === true ? 'partial' : 'completed',
          lineIds: [linha.id],
          items: [item],
          result: makeResult({
            provider: 'youtube',
            playlistId: 'PL_teste_1',
            playlistUrl: 'https://www.youtube.com/playlist?list=PL_teste_1',
            playlistName: 'Clássicos',
            effectivePath: `${youtube.libraryRoot} / Clássicos`,
            addedCount: 1,
            skippedCount: 0,
            failedLines: [],
            ...overrides,
          }),
        }),
      },
    }),
  });
}

beforeEach(() => {
  seedResult();
});

describe('FR-028 — playlist do YouTube, nunca do YouTube Music', () => {
  it('declara explicitamente que não é playlist do YouTube Music', () => {
    render(<ResultScreen provider="youtube" />);

    for (const aviso of youtube.resultNotices) {
      expect(screen.getByText(aviso)).toBeInTheDocument();
    }
    // O aviso precisa nomear o YouTube Music para negá-lo — não basta omitir.
    expect(youtube.resultNotices.join(' ')).toContain('YouTube Music');
  });

  it('o cabeçalho nomeia o serviço em que a playlist foi criada', () => {
    render(<ResultScreen provider="youtube" />);

    expect(
      screen.getByRole('heading', {
        name: format(t.result.heading, { service: youtube.name }),
      }),
    ).toBeInTheDocument();
  });
});

describe('FR-027 — caminho efetivo e aviso de pastas', () => {
  it('exibe o caminho real que o YouTube expõe', () => {
    render(<ResultScreen provider="youtube" />);

    expect(screen.getByText(`${youtube.libraryRoot} / Clássicos`)).toBeInTheDocument();
  });

  it('informa que a aplicação não gerencia pastas neste serviço', () => {
    render(<ResultScreen provider="youtube" />);

    expect(screen.getByText(t.result.folderNoticeHeading)).toBeInTheDocument();
    expect(screen.getByText(youtube.folderNotice)).toBeInTheDocument();
  });

  it('o link da playlist aponta para o YouTube', () => {
    render(<ResultScreen provider="youtube" />);

    const link = screen.getByRole('link', { name: youtube.openPlaylist });
    expect(link).toHaveAttribute('href', 'https://www.youtube.com/playlist?list=PL_teste_1');
  });

  it('deixa claro em qual conta a playlist foi criada (FR-036)', () => {
    render(<ResultScreen provider="youtube" />);

    expect(
      screen.getByText(format(t.result.accountNotice, { account: 'Canal de Teste' })),
    ).toBeInTheDocument();
  });
});

describe('FR-032 — playlist incompleta deixada por encerramento de cota', () => {
  it('informa que a playlist existe incompleta e não foi removida', () => {
    seedResult({ incompleteByQuota: true, addedCount: 1, skippedCount: 3 });
    render(<ResultScreen provider="youtube" />);

    expect(
      screen.getByText(format(t.quota.exhaustedHeading, { service: youtube.name })),
    ).toBeInTheDocument();
  });

  it('adverte sobre o próximo passo e a checagem de nome duplicado', () => {
    seedResult({ incompleteByQuota: true, addedCount: 1, skippedCount: 3 });
    render(<ResultScreen provider="youtube" />);

    const aviso = screen.getByRole('alert');
    expect(aviso).toHaveTextContent(t.quota.exhaustedNextStep);
    // O rascunho é preservado até descarte explícito (FR-038, Princípio V).
    expect(aviso).toHaveTextContent(t.draft.keptAfterQuota);
  });

  it('não exibe o aviso de incompleta quando a criação foi inteira', () => {
    render(<ResultScreen provider="youtube" />);

    expect(
      screen.queryByText(format(t.quota.exhaustedHeading, { service: youtube.name })),
    ).not.toBeInTheDocument();
  });
});
