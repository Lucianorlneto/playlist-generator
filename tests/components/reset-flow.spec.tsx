/**
 * Comando global de recomeço (`006/US3`, `US4`).
 *
 * Até a `006` não havia saída de dentro do ciclo de um serviço: descartar o
 * trabalho só era possível pela faixa de rascunho, que aparece na recuperação,
 * na migração e no esgotamento de cota. Quem se arrependia no meio do caminho
 * não tinha o que clicar.
 *
 * O que este arquivo prende, além da capacidade nova: **nada é descartado sem
 * confirmação** (SC-009), e o descarte não desconecta ninguém (FR-018).
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ResetFlow } from '@/app/ResetFlow';
import { t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
import { saveDraft } from '@/services/storage/draftRepo';
import { toWorkDraft } from '@/store/draftPersistence';

import {
  makeCredentials,
  makeLine,
  makeQueue,
  makeRun,
  makeResult,
  makeSession,
  makeSessions,
} from '../fixtures/factories';

const linha = makeLine({ id: 'l0', index: 0 });

function semearComTrabalho(runs?: Parameters<typeof makeQueue>[1]) {
  useAppStore.setState({
    step: 'service',
    rawText: 'Bohemian Rhapsody - Queen',
    lines: [linha],
    credentials: makeCredentials({ spotify: 'abc' }),
    sessions: makeSessions({ spotify: makeSession('spotify') }),
    destinations: { selected: ['spotify'], locked: true },
    queue: makeQueue(['spotify'], runs ?? { runs: { spotify: makeRun('spotify', { phase: 'connect', lineIds: [linha.id] }) } }),
  });
}

function semearVazio() {
  useAppStore.setState({
    step: 'destinations',
    rawText: '',
    lines: [],
    credentials: makeCredentials({ spotify: 'abc' }),
    sessions: makeSessions({ spotify: makeSession('spotify') }),
    destinations: { selected: [], locked: false },
    queue: { order: [], currentIndex: -1, runs: {} as never },
  });
}

function botaoRecomecar() {
  return screen.getByRole('button', { name: t.flow.reset });
}

describe('V8 — o comando só existe quando há o que descartar (FR-021)', () => {
  it('ausente na seleção de serviços de uma sessão recém-iniciada', () => {
    semearVazio();
    render(<ResetFlow />);

    expect(screen.queryByRole('button', { name: t.flow.reset })).not.toBeInTheDocument();
  });

  it('presente depois de destinos escolhidos e etapa avançada', () => {
    semearComTrabalho();
    render(<ResetFlow />);

    expect(botaoRecomecar()).toBeInTheDocument();
  });

  it('presente com texto colado, mesmo sem fila montada', () => {
    semearVazio();
    useAppStore.setState({ rawText: 'Bohemian Rhapsody - Queen' });
    render(<ResetFlow />);

    expect(botaoRecomecar()).toBeInTheDocument();
  });
});

describe('V9 — confirmar zera o trabalho e preserva o resto', () => {
  it('leva à seleção de serviços com tudo zerado (FR-016)', async () => {
    semearComTrabalho();
    render(<ResetFlow />);

    await userEvent.click(botaoRecomecar());
    await userEvent.click(screen.getByRole('button', { name: t.flow.resetConfirm }));

    const estado = useAppStore.getState();
    expect(estado.step).toBe('destinations');
    expect(estado.rawText).toBe('');
    expect(estado.lines).toHaveLength(0);
    expect(estado.queue.order).toHaveLength(0);
    expect(estado.destinations.locked).toBe(false);
  });

  it('credenciais e sessões continuam salvas (FR-018, SC-006)', async () => {
    semearComTrabalho();
    const credenciais = useAppStore.getState().credentials;
    const sessoes = useAppStore.getState().sessions;
    render(<ResetFlow />);

    await userEvent.click(botaoRecomecar());
    await userEvent.click(screen.getByRole('button', { name: t.flow.resetConfirm }));

    expect(useAppStore.getState().credentials).toEqual(credenciais);
    expect(useAppStore.getState().sessions).toEqual(sessoes);
  });

  it('a confirmação diz o que se perde e o que fica (FR-015)', async () => {
    semearComTrabalho();
    render(<ResetFlow />);

    await userEvent.click(botaoRecomecar());

    expect(screen.getByText(t.flow.resetBody)).toBeInTheDocument();
    expect(screen.getByText(t.flow.resetKeeps)).toBeInTheDocument();
  });
});

describe('V13 — o rascunho persistido é apagado (FR-017, SC-005)', () => {
  it('recarregar não traz o trabalho de volta', async () => {
    semearComTrabalho();
    saveDraft(toWorkDraft(useAppStore.getState()));
    render(<ResetFlow />);

    await userEvent.click(botaoRecomecar());
    await userEvent.click(screen.getByRole('button', { name: t.flow.resetConfirm }));

    // Importado aqui de propósito: a restauração é o caminho que o usuário
    // percorre ao recarregar, e é ela que precisa não encontrar nada.
    const { restoreDraft } = await import('@/store/restoreDraft');
    expect(restoreDraft().restored).toBe(false);
  });
});

describe('V10 — recusar não muda nada (FR-020, SC-007)', () => {
  it('cancelar preserva todo o trabalho', async () => {
    semearComTrabalho();
    const antes = useAppStore.getState();
    render(<ResetFlow />);

    await userEvent.click(botaoRecomecar());
    await userEvent.click(screen.getByRole('button', { name: t.common.cancel }));

    const depois = useAppStore.getState();
    expect(depois.step).toBe(antes.step);
    expect(depois.rawText).toBe(antes.rawText);
    expect(depois.lines).toEqual(antes.lines);
    expect(depois.queue.order).toEqual(antes.queue.order);
  });

  it('fechar por Esc também preserva', async () => {
    semearComTrabalho();
    render(<ResetFlow />);

    await userEvent.click(botaoRecomecar());
    await userEvent.keyboard('{Escape}');

    expect(useAppStore.getState().rawText).not.toBe('');
    expect(useAppStore.getState().step).toBe('service');
  });

  it('o foco volta ao botão que abriu o diálogo', async () => {
    semearComTrabalho();
    render(<ResetFlow />);

    await userEvent.click(botaoRecomecar());
    await userEvent.click(screen.getByRole('button', { name: t.common.cancel }));

    expect(botaoRecomecar()).toHaveFocus();
  });
});

/**
 * V11 — US4. O usuário precisa saber que "descartar" não alcança a conta dele.
 */
describe('V11 — a linha sobre playlists criadas é condicional (FR-015)', () => {
  it('não aparece quando nenhuma playlist foi criada', async () => {
    semearComTrabalho();
    render(<ResetFlow />);

    await userEvent.click(botaoRecomecar());

    expect(screen.queryByText(t.flow.resetKeepsPlaylist)).not.toBeInTheDocument();
  });

  it('aparece quando alguma execução tem resultado', async () => {
    semearComTrabalho({
      runs: {
        spotify: makeRun('spotify', {
          phase: 'done',
          outcome: 'completed',
          lineIds: [linha.id],
          result: makeResult(),
        }),
      },
    });
    render(<ResetFlow />);

    await userEvent.click(botaoRecomecar());

    expect(screen.getByText(t.flow.resetKeepsPlaylist)).toBeInTheDocument();
  });
});
