/**
 * A barra de ações de Destinos e Entrada (007/US3, FR-016 a FR-019).
 *
 * A faixa existe por um defeito concreto do fluxo anterior: nas duas etapas em
 * que o usuário pode ficar preso — sem destino escolhido, sem lista colada — o
 * botão de avançar ficava apagado e a explicação vivia num parágrafo **abaixo**
 * dele, competindo com o resto da tela. Quem não lia o parágrafo via só um botão
 * morto.
 *
 * Os casos abaixo são os cinco cenários de aceitação da história, na ordem em
 * que a spec os lista.
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ActionBar } from '@/app/ActionBar';
import { DestinationsActionBar } from '@/features/destinations/DestinationsActionBar';
import { InputActionBar } from '@/features/input/InputActionBar';
import { t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';

function faixa(): HTMLElement {
  return screen.getByRole('group', { name: t.actionBar.label });
}

beforeEach(() => {
  useAppStore.setState({
    step: 'destinations',
    destinations: { selected: [], locked: false },
    rawText: '',
  });
});

describe('FR-018 · estado vazio: o avanço não é possível e o motivo está escrito', () => {
  it('Destinos sem seleção diz por que não dá para avançar', () => {
    render(<DestinationsActionBar />);

    expect(within(faixa()).getByText(t.actionBar.blockedPrefix)).toBeInTheDocument();
    expect(faixa().textContent).toContain(t.destinations.noneSelected);
    expect(screen.getByRole('button', { name: t.common.next })).toBeDisabled();
  });

  it('Entrada sem lista colada diz por que não dá para avançar', () => {
    useAppStore.setState({ step: 'input', rawText: '' });
    render(<InputActionBar />);

    expect(faixa().textContent).toContain(t.input.emptyHint);
    expect(screen.getByRole('button', { name: t.input.start })).toBeDisabled();
  });
});

describe('FR-016 · estado com destinos escolhidos', () => {
  it('com dois destinos, a faixa diz a contagem e o avanço fica disponível', () => {
    useAppStore.setState({ destinations: { selected: ['spotify', 'youtube'], locked: false } });
    render(<DestinationsActionBar />);

    expect(faixa().textContent).toContain('2');
    expect(screen.getByRole('button', { name: t.common.next })).toBeEnabled();
    // Sem bloqueio, sem prefixo de motivo: a faixa não avisa sobre o que não há.
    expect(within(faixa()).queryByText(t.actionBar.blockedPrefix)).toBeNull();
  });

  it('avançar leva à etapa seguinte', async () => {
    useAppStore.setState({ destinations: { selected: ['spotify'], locked: false } });
    render(<DestinationsActionBar />);

    await userEvent.click(screen.getByRole('button', { name: t.common.next }));
    expect(useAppStore.getState().step).toBe('input');
  });

  it('voltar leva à etapa anterior', async () => {
    render(<DestinationsActionBar />);

    await userEvent.click(screen.getByRole('button', { name: t.actionBar.back }));
    expect(useAppStore.getState().step).toBe('credential');
  });
});

describe('FR-018 · a indisponibilidade é perceptível sem cor', () => {
  it('o botão está desabilitado — estado que o navegador anuncia', () => {
    // Não é `opacity` nem tinta: `disabled` é um atributo, o teclado o respeita
    // e o leitor de tela o anuncia. A cor é a terceira pista, nunca a primeira.
    render(
      <ActionBar
        state="estado"
        blockedReason="motivo"
        advanceLabel="Avançar"
        onAdvance={() => undefined}
      />,
    );

    expect(screen.getByRole('button', { name: 'Avançar' })).toBeDisabled();
  });

  it('o motivo aparece como texto, não só como ícone', () => {
    render(
      <ActionBar
        state="estado"
        blockedReason="a lista está vazia"
        advanceLabel="Avançar"
        onAdvance={() => undefined}
      />,
    );

    expect(faixa().textContent).toContain('a lista está vazia');
  });

  it('o motivo substitui o estado, em vez de acompanhá-lo', () => {
    // A pergunta do usuário naquele momento é "por que não posso avançar?".
    // Responder outra coisa antes seria ruído.
    render(
      <ActionBar
        state="ESTADO NORMAL"
        blockedReason="MOTIVO DO BLOQUEIO"
        advanceLabel="Avançar"
        onAdvance={() => undefined}
      />,
    );

    expect(faixa().textContent).toContain('MOTIVO DO BLOQUEIO');
    expect(faixa().textContent).not.toContain('ESTADO NORMAL');
  });

  it('a mudança de estado é anunciada sem roubar o foco', () => {
    render(
      <ActionBar state="estado" advanceLabel="Avançar" onAdvance={() => undefined} />,
    );

    expect(within(faixa()).getByRole('status')).toBeInTheDocument();
  });
});

describe('FR-019 · a primeira etapa não oferece retorno inoperante', () => {
  it('sem `onBack`, nenhum botão de voltar é renderizado', () => {
    // Um "Voltar" que não volta para lugar nenhum é pior que nenhum botão:
    // promete uma saída e não a cumpre.
    render(
      <ActionBar state="estado" advanceLabel="Avançar" onAdvance={() => undefined} />,
    );

    expect(screen.queryByRole('button', { name: t.actionBar.back })).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});

describe('FR-017 · avançar é a única ação primária da tela', () => {
  it('há exatamente um botão preenchido, e é o de avançar', () => {
    render(
      <ActionBar
        state="estado"
        advanceLabel="Avançar"
        onAdvance={() => undefined}
        onBack={() => undefined}
      />,
    );

    const botoes = within(faixa()).getAllByRole('button');
    const preenchidos = botoes.filter((b) => b.className.includes('bg-accent'));

    expect(preenchidos).toHaveLength(1);
    expect(preenchidos[0]?.textContent).toContain('Avançar');
  });

  it('texto claro sobre âmbar não existe: o rótulo primário usa --accent-ink', () => {
    // FR-022 em forma executável. `--accent` em cheia saturação dá 1,7:1 contra
    // branco, e o par aprovado é `--accent-ink` sobre `--accent`.
    render(
      <ActionBar state="estado" advanceLabel="Avançar" onAdvance={() => undefined} />,
    );

    const primario = screen.getByRole('button', { name: 'Avançar' });
    expect(primario.className).toContain('text-accent-ink');
  });
});

describe('ocupado é diferente de bloqueado', () => {
  it('busca em curso desabilita o avanço sem acusar o usuário', async () => {
    // Lista vazia é algo que o usuário precisa **fazer**; busca em curso é algo
    // que ele precisa **esperar**. Tratá-los como o mesmo estado faria a faixa
    // culpar o usuário por uma espera do aplicativo.
    useAppStore.setState({
      step: 'input',
      rawText: 'Bohemian Rhapsody - Queen',
      search: { ...useAppStore.getState().search, running: true },
    });
    render(<InputActionBar />);

    expect(screen.getByRole('button', { name: t.input.start })).toBeDisabled();
    expect(within(faixa()).queryByText(t.actionBar.blockedPrefix)).toBeNull();
    expect(faixa().textContent).toContain(t.common.loading);

    await Promise.resolve();
  });
});

describe('FR-042 · o ícone nunca é o único portador do estado', () => {
  it('todo ícone da faixa é decorativo, e o estado está escrito ao lado', () => {
    const { container } = render(
      <ActionBar
        state="2 destinos selecionados"
        advanceLabel="Avançar"
        onAdvance={() => undefined}
        onBack={() => undefined}
      />,
    );

    const glifos = container.querySelectorAll('.icon-glyph');
    expect(glifos.length).toBeGreaterThan(0);
    for (const glifo of glifos) {
      expect(glifo.getAttribute('aria-hidden')).toBe('true');
    }
    expect(faixa().textContent).toContain('2 destinos selecionados');
  });
});

describe('o avanço é chamado exatamente uma vez', () => {
  it('um clique, uma chamada', async () => {
    const avancar = vi.fn();
    render(<ActionBar state="e" advanceLabel="Avançar" onAdvance={avancar} />);

    await userEvent.click(screen.getByRole('button', { name: 'Avançar' }));
    expect(avancar).toHaveBeenCalledTimes(1);
  });

  it('bloqueado, o clique não chama nada', async () => {
    const avancar = vi.fn();
    render(
      <ActionBar state="e" blockedReason="motivo" advanceLabel="Avançar" onAdvance={avancar} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Avançar' }));
    expect(avancar).not.toHaveBeenCalled();
  });
});
