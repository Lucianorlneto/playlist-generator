/**
 * A trilha vertical de etapas (007/US2, FR-011, FR-013, FR-042).
 *
 * A composição — quais degraus existem, como se numeram, o que declaram — é
 * testada sem DOM em `tests/unit/rail-composition.spec.ts`. **Este arquivo testa
 * outra coisa**: que o componente desenha fielmente o que o domínio devolveu, e
 * que a distinção entre os três estados sobrevive sem cor.
 *
 * A divisão não é burocracia. Um teste que renderizasse para verificar a regra
 * do Resumo condicional estaria medindo duas coisas ao mesmo tempo, e uma falha
 * dele não diria qual das duas quebrou.
 */

import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { StepRail } from '@/app/StepRail';
import { t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';

import { makeCredentials, makeLine, makeQueue } from '../fixtures/factories';

const CLIENT_ID = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';

type Etapa = 'credential' | 'destinations' | 'input' | 'service' | 'summary';

function semear(step: Etapa, destinos: ('spotify' | 'youtube')[]) {
  useAppStore.setState({
    step,
    queue: makeQueue(destinos),
    lines: [makeLine(), makeLine()],
    credentials: makeCredentials({ spotify: CLIENT_ID }),
  });
}

beforeEach(() => {
  semear('input', ['spotify', 'youtube']);
});

function degraus(): HTMLElement[] {
  return within(screen.getByRole('navigation', { name: t.rail.title })).getAllByRole('listitem');
}

describe('FR-011 · cada degrau carrega o ordinal e o estado que o domínio devolveu', () => {
  it('os cinco degraus aparecem, na ordem do fluxo', () => {
    render(<StepRail />);

    expect(degraus()).toHaveLength(5);
    expect(degraus().map((li) => li.textContent)).toEqual([
      expect.stringContaining(t.steps.credential),
      expect.stringContaining(t.steps.destinations),
      expect.stringContaining(t.steps.input),
      expect.stringContaining(t.steps.service),
      expect.stringContaining(t.steps.summary),
    ]);
  });

  it('o ordinal é anunciado a leitor de tela em cada degrau', () => {
    render(<StepRail />);

    degraus().forEach((li, index) => {
      expect(li.textContent).toContain(
        `Etapa ${String(index + 1)} de ${String(degraus().length)}`,
      );
    });
  });

  it('a linha de apoio derivada nomeia os destinos reais quando eles existem', () => {
    render(<StepRail />);

    const destinos = degraus()[1];
    expect(destinos?.textContent).toContain(t.providers.spotify.name);
    expect(destinos?.textContent).toContain(t.providers.youtube.name);
  });

  it('a linha de apoio neutra descreve a etapa, sem afirmar decisão nenhuma', () => {
    // Na Configuração nada foi escolhido ainda. O arquivo de design mostra
    // "Spotify e YouTube" sob Destinos já nesta tela; reproduzir isso seria a
    // trilha afirmando uma escolha que o usuário não fez (FR-066).
    semear('credential', []);
    render(<StepRail />);

    const destinos = degraus()[1];
    expect(destinos?.textContent).toContain(t.rail.neutral.destinations);
    expect(destinos?.textContent).not.toContain(t.providers.spotify.name);
  });
});

describe('FR-013 · o Resumo some com destino único, e a numeração continua contígua', () => {
  it('com um destino, a trilha tem quatro degraus numerados de 1 a 4', () => {
    semear('input', ['spotify']);
    render(<StepRail />);

    expect(degraus()).toHaveLength(4);
    expect(screen.queryByText(t.steps.summary)).toBeNull();

    degraus().forEach((li, index) => {
      expect(li.textContent).toContain(`Etapa ${String(index + 1)} de 4`);
    });
  });

  it('com dois destinos, o Resumo é o quinto', () => {
    render(<StepRail />);

    expect(degraus()).toHaveLength(5);
    expect(degraus()[4]?.textContent).toContain(t.steps.summary);
    expect(degraus()[4]?.textContent).toContain('Etapa 5 de 5');
  });
});

describe('FR-041 · a posição atual é anunciada uma única vez', () => {
  it('exatamente um elemento carrega aria-current="step"', () => {
    for (const etapa of ['credential', 'destinations', 'input', 'service', 'summary'] as const) {
      semear(etapa, ['spotify', 'youtube']);
      const { container, unmount } = render(<StepRail />);

      expect(
        container.querySelectorAll('[aria-current="step"]'),
        `a etapa ${etapa} não produziu exatamente um aria-current`,
      ).toHaveLength(1);

      unmount();
    }
  });

  it('o aria-current está no degrau da etapa corrente', () => {
    semear('service', ['spotify', 'youtube']);
    const { container } = render(<StepRail />);

    const atual = container.querySelector('[aria-current="step"]');
    expect(atual?.textContent).toContain(t.steps.service);
  });
});

describe('FR-042 · a distinção entre estados sobrevive sem cor', () => {
  /**
   * O que se verifica aqui é **forma**, não matiz.
   *
   * O disco da etapa concluída carrega um ícone de confirmação; o da atual e o
   * da pendente carregam o numeral. É a diferença que sobrevive a cores
   * forçadas e a daltonismo — e é a razão pela qual `--ink-faint` não existe: a
   * terceira tinta que o arquivo de design usava para "pendente" reprova no
   * contraste em todos os substratos, e todo valor que passa fica
   * indistinguível de `--ink-muted`.
   */
  it('o degrau concluído mostra ícone; o atual e o pendente mostram numeral', () => {
    semear('input', ['spotify', 'youtube']);
    const { container } = render(<StepRail />);

    const lis = degraus();
    // Concluídos: Configuração (1) e Destinos (2).
    expect(lis[0]?.querySelector('.icon-glyph'), 'degrau concluído sem ícone').not.toBeNull();
    expect(lis[1]?.querySelector('.icon-glyph'), 'degrau concluído sem ícone').not.toBeNull();

    // Atual: Entrada (3). Pendente: Serviço (4) e Resumo (5).
    for (const index of [2, 3, 4]) {
      const li = lis[index];
      expect(li?.querySelector('.icon-glyph'), `degrau ${String(index + 1)} não devia ter ícone`).toBeNull();
      expect(li?.textContent).toContain(String(index + 1));
    }

    expect(container.querySelectorAll('.icon-glyph').length).toBeGreaterThanOrEqual(2);
  });

  it('o conector entre degraus é decorativo e não é anunciado', () => {
    render(<StepRail />);

    const nav = screen.getByRole('navigation', { name: t.rail.title });
    const escondidos = nav.querySelectorAll('[aria-hidden="true"]');
    // Disco e conector de cada degrau: nenhum dos dois carrega informação que
    // não esteja escrita ao lado.
    expect(escondidos.length).toBeGreaterThan(0);
    for (const node of escondidos) {
      expect(node.getAttribute('aria-current')).toBeNull();
    }
  });
});

describe('FR-015 e FR-065 · a ação de recomeçar vive no rodapé da trilha', () => {
  it('está presente quando há trabalho a descartar', () => {
    useAppStore.setState({
      step: 'input',
      rawText: 'Amor - Fulano',
      queue: makeQueue(['spotify']),
      credentials: makeCredentials({ spotify: CLIENT_ID }),
    });
    render(<StepRail />);

    expect(screen.getByRole('button', { name: t.flow.reset })).toBeInTheDocument();
  });

  it('some sozinha quando não há trabalho — comportamento da 006, intacto', () => {
    useAppStore.setState({
      step: 'credential',
      rawText: '',
      lines: [],
      queue: makeQueue([]),
      credentials: makeCredentials({}),
    });
    render(<StepRail />);

    expect(screen.queryByRole('button', { name: t.flow.reset })).toBeNull();
  });
});

describe('Princípio III · a trilha não decide nada', () => {
  it('a contagem de degraus vem do domínio, não de um filtro do componente', () => {
    // O teste que prova a separação: mudar apenas a fila muda a trilha, sem que
    // o componente tenha um `if` sobre `summary` em lugar nenhum. Se algum dia
    // a regra for reimplementada aqui, este caso continuaria passando — mas
    // `tests/unit/rail-composition.spec.ts` e este divergiriam na primeira
    // mudança de regra, que é exatamente o alarme desejado.
    semear('input', ['spotify']);
    const { unmount } = render(<StepRail />);
    expect(degraus()).toHaveLength(4);
    unmount();

    semear('input', ['spotify', 'youtube']);
    render(<StepRail />);
    expect(degraus()).toHaveLength(5);
  });
});
