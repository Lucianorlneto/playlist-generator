import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { DestinationSelector } from '@/features/destinations/DestinationSelector';
import { format, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';

import { makeCredentials } from '../fixtures/factories';
import { instalarPreferenciaDeMovimento, preferirMovimentoReduzido } from '../support/movimento';

/**
 * O cartão de destino não é transformado — FR-031
 * (`010/contracts/surfaces.md` §4.1).
 *
 * ## A decisão, e a razão dela
 *
 * Apenas uma fusão das cores que mudam ao acionar: preenchimento, contorno e
 * caixa de marcação. **Nada de escala, pressão ou deslocamento.**
 *
 * O cartão é uma área clicável grande e contém texto que a pessoa está lendo no
 * momento em que clica; encolhê-lo moveria esse texto. A marcação já é legível
 * por **forma** — a caixa marcada — e o foco visível já dá o retorno de
 * acionamento por teclado, que uma pressão só por ponteiro não daria.
 *
 * ## Por que a asserção é sobre a classe, e não sobre a caixa medida
 *
 * `happy-dom` não calcula layout: uma asserção de "não se moveu" por
 * `getBoundingClientRect` passaria com um `scale-95` no cartão, porque todo
 * retângulo ali é zero. O que **é** observável e é o que se quer proibir é o
 * utilitário de transformação estar presente na classe.
 */

instalarPreferenciaDeMovimento();

const CLIENT_ID = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
const YT_CLIENT_ID = '1234567890-abcdefghijklmnop.apps.googleusercontent.com';

/**
 * Prefixos de utilitário que **movem** o cartão. `transition-transform` entra na
 * lista: declarar a transição de uma transformação é anunciar a intenção de ter
 * uma, e é isso que o FR-031 recusa.
 */
const TRANSFORMACOES = [
  'scale-',
  'translate-',
  'rotate-',
  'skew-',
  '-translate-',
  'transition-transform',
  'active:scale',
];

/** O controle de um cartão. Os dois têm o mesmo papel; o nome é que os separa. */
function controle(provider: 'spotify' | 'youtube'): HTMLElement {
  const service = provider === 'spotify' ? t.providers.spotify.name : t.providers.youtube.name;
  return screen.getByRole('checkbox', {
    name: format(t.destinations.selectLabel, { service }),
  });
}

function cartao(provider: 'spotify' | 'youtube'): HTMLElement {
  const no = document.querySelector<HTMLElement>(`[data-destino="${provider}"]`);
  if (no === null) throw new Error(`cartão de ${provider} não encontrado`);
  return no;
}

/** Toda classe do cartão e de tudo que ele contém. */
function classesDe(no: HTMLElement): string {
  return [no, ...no.querySelectorAll('*')]
    .map((elemento) => elemento.getAttribute('class') ?? '')
    .join(' ');
}

beforeEach(() => {
  preferirMovimentoReduzido(false);
  useAppStore.setState({
    step: 'destinations',
    destinations: { selected: [], locked: false },
    credentials: makeCredentials({ spotify: CLIENT_ID, youtube: YT_CLIENT_ID }),
  });
});

describe('FR-031 · marcar e desmarcar não transforma nada', () => {
  it('o cartão não selecionado não carrega utilitário de transformação', () => {
    render(<DestinationSelector />);

    const classes = classesDe(cartao('spotify'));
    for (const proibido of TRANSFORMACOES) {
      expect(
        classes,
        `O cartão carrega "${proibido}". O cartão é uma área clicável grande com texto que a ` +
          'pessoa está lendo no momento em que clica; encolhê-lo moveria esse texto (FR-031).',
      ).not.toContain(proibido);
    }
  });

  it('marcar não introduz transformação', async () => {
    const user = userEvent.setup();
    render(<DestinationSelector />);

    await user.click(controle('spotify'));

    const classes = classesDe(cartao('spotify'));
    for (const proibido of TRANSFORMACOES) expect(classes).not.toContain(proibido);
  });

  it('desmarcar também não', async () => {
    const user = userEvent.setup();
    useAppStore.setState({ destinations: { selected: ['spotify'], locked: false } });
    render(<DestinationSelector />);

    await user.click(controle('spotify'));

    const classes = classesDe(cartao('spotify'));
    for (const proibido of TRANSFORMACOES) expect(classes).not.toContain(proibido);
  });
});

describe('FR-029, FR-031 · o que muda é cor, e ela funde no degrau `quick`', () => {
  it('o cartão declara transição de cor, e no degrau da periferia', () => {
    /*
      **O contrapeso das asserções acima.** Uma lista de proibições passaria com
      o cartão inteiramente sem movimento nenhum — inclusive sem a fusão que o
      FR-031 **pede**. Este caso é o que distingue "não transforma" de "não faz
      nada".
    */
    render(<DestinationSelector />);

    const classes = classesDe(cartao('spotify'));
    expect(classes).toContain('transition-colors');
    expect(classes).toContain('duration-quick');
    // A supressão acompanha, como nos demais componentes do sistema (FR-015).
    expect(classes).toContain('motion-reduce:transition-none');
  });
});

describe('FR-015 · o estado permanece legível por forma', () => {
  it('a caixa de marcação continua sendo o portador do estado, com ou sem movimento', () => {
    preferirMovimentoReduzido(true);
    useAppStore.setState({ destinations: { selected: ['spotify'], locked: false } });
    render(<DestinationSelector />);

    // Marcado é marcado: o estado está no controle, não na animação.
    expect(controle('spotify')).toBeChecked();
    expect(controle('youtube')).not.toBeChecked();
  });
});
