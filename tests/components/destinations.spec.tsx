/**
 * Seletor de destinos (US1, FR-006, FR-008 a FR-012, SC-002, SC-003).
 *
 * Três regras que a tela precisa cumprir literalmente:
 *
 * - **o padrão é derivado**, não lembrado: o conjunto marcado é exatamente o dos
 *   serviços com credencial cadastrada (SC-003);
 * - **o motivo do bloqueio é texto na tela**, com atalho para resolver — um
 *   controle apagado sem explicação não atende FR-009;
 * - **remover uma credencial desmarca só aquele destino** (FR-006).
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { DestinationsStep } from '@/features/destinations/DestinationsStep';
import { format, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';

import { makeCredentials } from '../fixtures/factories';

const CLIENT_ID = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
const YT_CLIENT_ID = '123-abc.apps.googleusercontent.com';

const spotify = t.providers.spotify.name;
const youtube = t.providers.youtube.name;

const labelOf = (service: string) => format(t.destinations.selectLabel, { service });

function seedCredentials(present: Partial<Record<'spotify' | 'youtube', string>>) {
  useAppStore.setState({ credentials: makeCredentials(present) });
  useAppStore.getState().reconcileDestinations();
}

function checkbox(service: string): HTMLInputElement {
  return screen.getByRole('checkbox', { name: labelOf(service) });
}

beforeEach(() => {
  useAppStore.setState({ destinations: { selected: [], locked: false } });
});

describe('FR-010 / SC-003 — padrão derivado das credenciais', () => {
  it('marca exatamente os serviços que têm credencial cadastrada', () => {
    seedCredentials({ spotify: CLIENT_ID, youtube: YT_CLIENT_ID });
    render(<DestinationsStep />);

    expect(checkbox(spotify)).toBeChecked();
    expect(checkbox(youtube)).toBeChecked();
  });

  it('com só um cadastrado, marca só ele e desabilita o outro', () => {
    seedCredentials({ youtube: YT_CLIENT_ID });
    render(<DestinationsStep />);

    expect(checkbox(youtube)).toBeChecked();
    expect(checkbox(spotify)).not.toBeChecked();
    expect(checkbox(spotify)).toBeDisabled();
  });

  it('sem nenhuma credencial, nada é selecionável', () => {
    seedCredentials({});
    render(<DestinationsStep />);

    expect(checkbox(spotify)).toBeDisabled();
    expect(checkbox(youtube)).toBeDisabled();
  });
});

describe('FR-009 / SC-002 — motivo visível e atalho', () => {
  it('escreve o motivo do bloqueio e o associa ao controle', () => {
    seedCredentials({ spotify: CLIENT_ID });
    render(<DestinationsStep />);

    const motivo = format(t.destinations.unavailableReason, { service: youtube });
    expect(screen.getByText(motivo)).toBeInTheDocument();

    // O motivo é anunciado junto do controle, não solto na tela.
    const descrito = checkbox(youtube).getAttribute('aria-describedby');
    expect(descrito).not.toBeNull();
    expect(document.getElementById(descrito!)?.textContent).toBe(motivo);
  });

  it('oferece atalho para cadastrar a credencial que falta', async () => {
    const user = userEvent.setup();
    seedCredentials({ spotify: CLIENT_ID });
    render(<DestinationsStep />);

    await user.click(
      screen.getByRole('button', {
        name: format(t.destinations.unavailableAction, { service: youtube }),
      }),
    );

    expect(useAppStore.getState().step).toBe('credential');
  });

  it('serviço com credencial não exibe motivo de bloqueio', () => {
    seedCredentials({ spotify: CLIENT_ID });
    render(<DestinationsStep />);

    expect(
      screen.queryByText(format(t.destinations.unavailableReason, { service: spotify })),
    ).not.toBeInTheDocument();
    expect(checkbox(spotify)).toBeEnabled();
  });
});

describe('FR-011 — ao menos um destino para avançar', () => {
  it('permite avançar com um único destino', async () => {
    const user = userEvent.setup();
    seedCredentials({ spotify: CLIENT_ID, youtube: YT_CLIENT_ID });
    render(<DestinationsStep />);

    await user.click(checkbox(youtube));

    expect(useAppStore.getState().destinations.selected).toEqual(['spotify']);
    expect(screen.getByRole('button', { name: t.common.next })).toBeEnabled();
  });

  it('bloqueia o avanço com nenhum destino, explicando o motivo', async () => {
    const user = userEvent.setup();
    seedCredentials({ spotify: CLIENT_ID, youtube: YT_CLIENT_ID });
    render(<DestinationsStep />);

    await user.click(checkbox(spotify));
    await user.click(checkbox(youtube));

    expect(useAppStore.getState().destinations.selected).toEqual([]);
    expect(screen.getByText(t.destinations.noneSelected)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.common.next })).toBeDisabled();
  });
});

describe('FR-006 — remover credencial afeta só aquele destino', () => {
  it('desmarca e desabilita o destino do serviço removido', () => {
    seedCredentials({ spotify: CLIENT_ID, youtube: YT_CLIENT_ID });
    const { rerender } = render(<DestinationsStep />);
    expect(checkbox(youtube)).toBeChecked();

    useAppStore.getState().removeCredential('youtube');
    rerender(<DestinationsStep />);

    expect(checkbox(youtube)).not.toBeChecked();
    expect(checkbox(youtube)).toBeDisabled();
    // O outro serviço segue intacto.
    expect(checkbox(spotify)).toBeChecked();
    expect(useAppStore.getState().destinations.selected).toEqual(['spotify']);
  });
});

describe('FR-012 — seleção travada após a primeira criação', () => {
  it('desabilita os controles e explica que é preciso descartar o rascunho', () => {
    seedCredentials({ spotify: CLIENT_ID, youtube: YT_CLIENT_ID });
    useAppStore.getState().lockDestinations();
    render(<DestinationsStep />);

    expect(checkbox(spotify)).toBeDisabled();
    expect(checkbox(youtube)).toBeDisabled();
    expect(screen.getByText(t.destinations.lockedNotice)).toBeInTheDocument();
  });
});

describe('FR-015 — ordem fixa, sem controle de ordenação', () => {
  it('exibe Spotify antes de YouTube e não oferece reordenação', () => {
    seedCredentials({ spotify: CLIENT_ID, youtube: YT_CLIENT_ID });
    render(<DestinationsStep />);

    const grupo = screen.getByRole('group', { name: t.destinations.groupLabel });
    const rotulos = within(grupo)
      .getAllByRole('checkbox')
      .map((entry) => entry.getAttribute('id'));

    expect(rotulos).toEqual(['destino-spotify', 'destino-youtube']);
  });
});
