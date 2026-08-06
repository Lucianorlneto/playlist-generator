/**
 * Campo de credencial de um serviço (US1, FR-001 a FR-006).
 *
 * O que a feature 002 mudou: há **um formulário por provedor**, e os rótulos
 * nomeiam o serviço — com dois campos na mesma tela, "Revelar credencial"
 * sozinho não diria qual. O teste exercita o Spotify e, no fim, verifica o
 * isolamento entre os dois (FR-006).
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { CredentialForm } from '@/features/credential/CredentialForm';
import { format, t } from '@/i18n/pt-BR';
import { loadCredential } from '@/services/storage/credentialRepo';
import { useAppStore } from '@/store';

const CLIENT_ID = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
const YT_CLIENT_ID = '123-abc.apps.googleusercontent.com';

const spotify = t.providers.spotify;
const revealLabel = format(t.credential.reveal, { service: spotify.name });
const hideLabel = format(t.credential.hide, { service: spotify.name });
const maskedLabel = format(t.credential.maskedLabel, { service: spotify.name });
const removeLabel = format(t.credential.remove, { service: spotify.name });

describe('Campo de credencial (US1, FR-003, FR-004)', () => {
  it('abre vazio na primeira vez', () => {
    render(<CredentialForm provider="spotify" />);

    expect(screen.getByLabelText(spotify.credentialLabel)).toHaveValue('');
  });

  it('exibe o valor mascarado depois de salvar, com os 4 últimos caracteres', async () => {
    const user = userEvent.setup();
    render(<CredentialForm provider="spotify" />);

    await user.type(screen.getByLabelText(spotify.credentialLabel), CLIENT_ID);
    await user.click(screen.getByRole('button', { name: t.credential.save }));

    const masked = screen.getByLabelText(maskedLabel);
    expect(masked.textContent).toBe('•'.repeat(CLIENT_ID.length - 4) + CLIENT_ID.slice(-4));
    expect(masked.textContent).not.toContain(CLIENT_ID);
    expect(loadCredential('spotify')).toEqual({ clientId: CLIENT_ID });
  });

  it('alterna revelar e ocultar com aria-pressed', async () => {
    const user = userEvent.setup();
    useAppStore.getState().setCredential('spotify', CLIENT_ID);
    render(<CredentialForm provider="spotify" />);

    const reveal = screen.getByRole('button', { name: revealLabel });
    expect(reveal).toHaveAttribute('aria-pressed', 'false');

    await user.click(reveal);

    const hide = screen.getByRole('button', { name: hideLabel });
    expect(hide).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText(maskedLabel).textContent).toBe(CLIENT_ID);

    await user.click(hide);
    expect(screen.getByRole('button', { name: revealLabel })).toBeInTheDocument();
  });

  it('bloqueia o salvamento com o campo vazio', async () => {
    const user = userEvent.setup();
    render(<CredentialForm provider="spotify" />);

    await user.click(screen.getByRole('button', { name: t.credential.save }));

    expect(screen.getByRole('alert')).toHaveTextContent(t.credential.emptyError);
    expect(loadCredential('spotify')).toBeNull();
  });

  it('avisa sobre formato divergente sem bloquear', async () => {
    const user = userEvent.setup();
    render(<CredentialForm provider="spotify" />);

    await user.type(screen.getByLabelText(spotify.credentialLabel), 'formato-estranho');
    expect(screen.getByText(spotify.formatWarning)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.credential.save }));

    expect(loadCredential('spotify')).toEqual({ clientId: 'formato-estranho' });
    expect(screen.getByLabelText(maskedLabel)).toBeInTheDocument();
  });

  it('remove a credencial por ação explícita, com confirmação', async () => {
    const user = userEvent.setup();
    useAppStore.getState().setCredential('spotify', CLIENT_ID);
    render(<CredentialForm provider="spotify" />);

    await user.click(screen.getByRole('button', { name: removeLabel }));
    expect(
      screen.getByText(format(t.credential.removeConfirm, { service: spotify.name })),
    ).toBeInTheDocument();

    const [confirm] = screen.getAllByRole('button', { name: removeLabel });
    await user.click(confirm!);

    expect(loadCredential('spotify')).toBeNull();
    expect(screen.getByLabelText(spotify.credentialLabel)).toHaveValue('');
  });

  it('cancelar a remoção preserva a credencial', async () => {
    const user = userEvent.setup();
    useAppStore.getState().setCredential('spotify', CLIENT_ID);
    render(<CredentialForm provider="spotify" />);

    await user.click(screen.getByRole('button', { name: removeLabel }));
    await user.click(screen.getByRole('button', { name: t.common.cancel }));

    expect(loadCredential('spotify')).toEqual({ clientId: CLIENT_ID });
  });

  it('salvar volta ao estado mascarado, mesmo se estava revelado antes', async () => {
    const user = userEvent.setup();
    useAppStore.getState().setCredential('spotify', CLIENT_ID);
    useAppStore.getState().toggleCredentialReveal('spotify');
    useAppStore.getState().removeCredential('spotify');

    render(<CredentialForm provider="spotify" />);
    await user.type(screen.getByLabelText(spotify.credentialLabel), CLIENT_ID);
    await user.click(screen.getByRole('button', { name: t.credential.save }));

    expect(screen.getByRole('button', { name: revealLabel })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('remover a credencial de um serviço não toca na do outro (FR-006)', async () => {
    const user = userEvent.setup();
    useAppStore.getState().setCredential('spotify', CLIENT_ID);
    useAppStore.getState().setCredential('youtube', YT_CLIENT_ID);

    render(<CredentialForm provider="spotify" />);

    await user.click(screen.getByRole('button', { name: removeLabel }));
    const [confirm] = screen.getAllByRole('button', { name: removeLabel });
    await user.click(confirm!);

    expect(loadCredential('spotify')).toBeNull();
    expect(loadCredential('youtube')).toEqual({ clientId: YT_CLIENT_ID });
  });
});
