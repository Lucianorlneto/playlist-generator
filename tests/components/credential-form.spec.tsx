import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { CredentialForm } from '@/features/credential/CredentialForm';
import { t } from '@/i18n/pt-BR';
import { loadCredential } from '@/services/storage/credentialRepo';
import { useAppStore } from '@/store';

const CLIENT_ID = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';

describe('Campo de credencial (US1, FR-003, FR-004)', () => {
  it('abre vazio na primeira vez', () => {
    render(<CredentialForm />);

    const field = screen.getByLabelText(t.credential.fieldLabel);
    expect(field).toHaveValue('');
  });

  it('exibe o valor mascarado depois de salvar, com os 4 últimos caracteres', async () => {
    const user = userEvent.setup();
    render(<CredentialForm />);

    await user.type(screen.getByLabelText(t.credential.fieldLabel), CLIENT_ID);
    await user.click(screen.getByRole('button', { name: t.credential.save }));

    const masked = screen.getByLabelText(t.credential.maskedLabel);
    expect(masked.textContent).toBe('•'.repeat(CLIENT_ID.length - 4) + CLIENT_ID.slice(-4));
    expect(masked.textContent).not.toContain(CLIENT_ID);
    expect(loadCredential()).toEqual({ clientId: CLIENT_ID });
  });

  it('alterna revelar e ocultar com aria-pressed', async () => {
    const user = userEvent.setup();
    useAppStore.getState().setCredential(CLIENT_ID);
    render(<CredentialForm />);

    const reveal = screen.getByRole('button', { name: t.credential.reveal });
    expect(reveal).toHaveAttribute('aria-pressed', 'false');

    await user.click(reveal);

    const hide = screen.getByRole('button', { name: t.credential.hide });
    expect(hide).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText(t.credential.maskedLabel).textContent).toBe(CLIENT_ID);

    await user.click(hide);
    expect(screen.getByRole('button', { name: t.credential.reveal })).toBeInTheDocument();
  });

  it('bloqueia o salvamento com o campo vazio', async () => {
    const user = userEvent.setup();
    render(<CredentialForm />);

    await user.click(screen.getByRole('button', { name: t.credential.save }));

    expect(screen.getByRole('alert')).toHaveTextContent(t.credential.emptyError);
    expect(loadCredential()).toBeNull();
  });

  it('avisa sobre formato divergente sem bloquear', async () => {
    const user = userEvent.setup();
    render(<CredentialForm />);

    await user.type(screen.getByLabelText(t.credential.fieldLabel), 'formato-estranho');
    expect(screen.getByText(t.credential.formatWarning)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.credential.save }));

    expect(loadCredential()).toEqual({ clientId: 'formato-estranho' });
    expect(screen.getByLabelText(t.credential.maskedLabel)).toBeInTheDocument();
  });

  it('remove a credencial por ação explícita, com confirmação', async () => {
    const user = userEvent.setup();
    useAppStore.getState().setCredential(CLIENT_ID);
    render(<CredentialForm />);

    await user.click(screen.getByRole('button', { name: t.credential.remove }));
    expect(screen.getByText(t.credential.removeConfirm)).toBeInTheDocument();

    const [confirm] = screen.getAllByRole('button', { name: t.credential.remove });
    await user.click(confirm!);

    expect(loadCredential()).toBeNull();
    expect(screen.getByLabelText(t.credential.fieldLabel)).toHaveValue('');
  });

  it('cancelar a remoção preserva a credencial', async () => {
    const user = userEvent.setup();
    useAppStore.getState().setCredential(CLIENT_ID);
    render(<CredentialForm />);

    await user.click(screen.getByRole('button', { name: t.credential.remove }));
    await user.click(screen.getByRole('button', { name: t.common.cancel }));

    expect(loadCredential()).toEqual({ clientId: CLIENT_ID });
  });

  it('salvar volta ao estado mascarado, mesmo se estava revelado antes', async () => {
    const user = userEvent.setup();
    useAppStore.getState().setCredential(CLIENT_ID);
    useAppStore.getState().toggleCredentialReveal();
    useAppStore.getState().removeCredential();

    render(<CredentialForm />);
    await user.type(screen.getByLabelText(t.credential.fieldLabel), CLIENT_ID);
    await user.click(screen.getByRole('button', { name: t.credential.save }));

    expect(screen.getByRole('button', { name: t.credential.reveal })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
