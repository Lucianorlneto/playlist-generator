/**
 * V33 — o primitivo `Dialog` sobre o elemento `<dialog>` nativo (`004/U1` a
 * `U6`, `004/A3`,
 * [ui-contract §1](../../specs/004-youtube-reconnect/contracts/ui-contract.md)).
 *
 * **Limite declarado de verificação** (D1 do plan.md): happy-dom expõe
 * `showModal()` e marca `open`, mas **não** emula a camada de topo do navegador
 * nem a contenção de foco que ela traz. Afirmar a contenção a partir daqui seria
 * um invariante falsamente verificado, que é o que o Princípio IV proíbe. A
 * prova da contenção está em `e2e/reconnect.spec.ts`, no navegador real.
 *
 * O que **é** verificável aqui — abrir, fechar, `Esc`, foco inicial, foco
 * devolvido e rotulagem — está tudo abaixo.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Dialog } from '@/ui/Dialog';

/**
 * happy-dom não implementa `showModal`/`close` nativos em toda versão. O duplo
 * abaixo registra as chamadas e mantém `open` coerente, que é exatamente o que
 * U1 e U2 afirmam — e deixa claro, no código, o que está sendo verificado.
 */
function instalarDialogNativo(): { showModal: () => void; close: () => void } {
  const proto = globalThis.HTMLDialogElement?.prototype;
  const showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  });
  const close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  });

  if (proto !== undefined) {
    Object.defineProperty(proto, 'showModal', { value: showModal, configurable: true, writable: true });
    Object.defineProperty(proto, 'close', { value: close, configurable: true, writable: true });
  }
  return { showModal, close };
}

interface CasoProps {
  open: boolean;
  onClose: () => void;
}

function Caso({ open, onClose }: CasoProps) {
  return (
    <Dialog open={open} onClose={onClose} labelledBy="titulo-do-caso">
      <h2 id="titulo-do-caso">Título do diálogo</h2>
      <button type="button">Ação primária</button>
      <button type="button">Ação secundária</button>
    </Dialog>
  );
}

let nativo: ReturnType<typeof instalarDialogNativo>;

beforeEach(() => {
  nativo = instalarDialogNativo();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('U1 — sempre modal, nunca `show()` não-modal', () => {
  it('abre com showModal quando `open` vira verdadeiro', () => {
    const { rerender } = render(<Caso open={false} onClose={() => undefined} />);
    expect(nativo.showModal).not.toHaveBeenCalled();

    rerender(<Caso open onClose={() => undefined} />);
    expect(nativo.showModal).toHaveBeenCalledTimes(1);
  });

  it('fecha com close quando `open` vira falso', () => {
    const { rerender } = render(<Caso open onClose={() => undefined} />);
    rerender(<Caso open={false} onClose={() => undefined} />);
    expect(nativo.close).toHaveBeenCalled();
  });

  it('não reabre a cada renderização com o mesmo `open`', () => {
    const { rerender } = render(<Caso open onClose={() => undefined} />);
    rerender(<Caso open onClose={() => undefined} />);
    expect(nativo.showModal).toHaveBeenCalledTimes(1);
  });
});

describe('U2 — o evento `close` nativo chama onClose uma única vez', () => {
  it('fechar pelo elemento nativo notifica o dono do estado', () => {
    const onClose = vi.fn();
    render(<Caso open onClose={onClose} />);

    const dialogo = document.querySelector('dialog');
    dialogo?.dispatchEvent(new Event('close'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('`Esc` chega como o mesmo evento `close` e notifica uma vez só', async () => {
    const onClose = vi.fn();
    render(<Caso open onClose={onClose} />);

    // O navegador traduz `Esc` em `close` no elemento nativo; aqui o caminho é
    // exercitado pelo mesmo evento, que é o contrato que o componente observa.
    await userEvent.keyboard('{Escape}');
    document.querySelector('dialog')?.dispatchEvent(new Event('close'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('U3/U4 — foco entra e volta', () => {
  it('o foco vai para o primeiro elemento focável ao abrir', () => {
    const { rerender } = render(<Caso open={false} onClose={() => undefined} />);
    rerender(<Caso open onClose={() => undefined} />);

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Ação primária' }));
  });

  it('o foco volta ao elemento que o tinha antes de abrir', () => {
    const gatilho = document.createElement('button');
    document.body.append(gatilho);
    gatilho.focus();

    const { rerender } = render(<Caso open={false} onClose={() => undefined} />);
    rerender(<Caso open onClose={() => undefined} />);
    rerender(<Caso open={false} onClose={() => undefined} />);

    expect(document.activeElement).toBe(gatilho);
    gatilho.remove();
  });
});

describe('U5/A3 — sempre rotulado e anunciado como diálogo', () => {
  it('aria-labelledby aponta para o título', () => {
    render(<Caso open onClose={() => undefined} />);
    expect(document.querySelector('dialog')?.getAttribute('aria-labelledby')).toBe(
      'titulo-do-caso',
    );
  });

  it('é alcançável pelo papel de diálogo, com o nome acessível do título', () => {
    render(<Caso open onClose={() => undefined} />);
    expect(screen.getByRole('dialog', { name: 'Título do diálogo' })).toBeTruthy();
  });
});

describe('U6 — a camada de topo do navegador resolve o empilhamento', () => {
  it('nenhum z-index é aplicado ao diálogo', () => {
    render(<Caso open onClose={() => undefined} />);
    const classes = document.querySelector('dialog')?.className ?? '';
    expect(classes).not.toMatch(/z-/u);
    expect(document.querySelector('dialog')?.style.zIndex).toBe('');
  });
});
