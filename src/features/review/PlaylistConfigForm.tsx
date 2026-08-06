import { useState } from 'react';

import type { ProviderId } from '@/domain/providers';
import { canCreate } from '@/domain/validation';
import { nameOf } from '@/features/credential/providerText';
import { effectivePath } from '@/features/result/effectivePath';
import { format, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
import { Button } from '@/ui/Button';
import { TextField } from '@/ui/TextField';
import { Toggle } from '@/ui/Toggle';

import { refreshExistingNames } from './nameCheck';

export interface PlaylistConfigFormProps {
  provider: ProviderId;
}

const MESSAGE_BY_REASON: Partial<Record<string, string>> = {
  name_empty: t.playlistConfig.nameRequired,
  name_duplicate: t.playlistConfig.nameDuplicate,
  no_tracks_selected: t.playlistConfig.noTracksSelected,
  name_check_incomplete: t.errors.playlistListFailed.nextStep,
};

/**
 * Dados da playlist e **confirmação da criação naquele serviço** (FR-019,
 * FR-022, FR-026).
 *
 * O botão de criar é o único caminho para a fase `creating`: ele emite
 * `review_confirmed` para *este* provedor. Confirmar aqui não diz nada sobre o
 * próximo destino — que terá sua própria revisão e sua própria confirmação.
 *
 * Não há campo de pasta aqui nem em lugar nenhum: nenhuma das plataformas expõe
 * pastas a aplicativos de terceiros, e simular o campo seria prometer o que não
 * se pode cumprir.
 */
export function PlaylistConfigForm({ provider }: PlaylistConfigFormProps) {
  const config = useAppStore((state) => state.playlistConfig);
  const run = useAppStore((state) => state.queue.runs[provider] ?? null);
  const existingNames = useAppStore((state) => state.existingNames);
  const nameCheckRunning = useAppStore((state) => state.nameCheckRunning);
  const nameCheckError = useAppStore((state) => state.nameCheckError);
  const session = useAppStore((state) => state.sessions[provider]);
  const creating = useAppStore((state) => state.creating);
  const searchRunning = useAppStore((state) => state.search.running);
  const dispatchRun = useAppStore((state) => state.dispatchRun);

  const setPlaylistName = useAppStore((state) => state.setPlaylistName);
  const setPlaylistDescription = useAppStore((state) => state.setPlaylistDescription);
  const setPlaylistVisibility = useAppStore((state) => state.setPlaylistVisibility);

  const [touched, setTouched] = useState(false);

  const items = run?.items ?? [];
  const service = nameOf(provider);

  const validation = canCreate(items, config, existingNames);
  const rawMessage = validation.ok ? null : (MESSAGE_BY_REASON[validation.reason] ?? null);
  const blockingMessage = rawMessage === null ? null : format(rawMessage, { service });
  const showNameError = touched && !validation.ok && validation.reason !== 'no_tracks_selected';

  const previewPath =
    session === null ? null : effectivePath(provider, session.user.displayName, config.name);

  return (
    <section className="border-border flex flex-col gap-3 border-t pt-4">
      <h3 className="text-ink text-base font-bold">{t.playlistConfig.heading}</h3>

      <TextField
        label={t.playlistConfig.nameLabel}
        placeholder={t.playlistConfig.namePlaceholder}
        value={config.name}
        required
        error={showNameError ? blockingMessage : null}
        onChange={(event) => {
          setPlaylistName(event.target.value);
        }}
        onBlur={() => {
          setTouched(true);
        }}
      />
      <p className="field-message">{t.playlistConfig.nameDuplicateScope}</p>

      <TextField
        label={t.playlistConfig.descriptionLabel}
        placeholder={t.playlistConfig.descriptionPlaceholder}
        value={config.description}
        onChange={(event) => {
          setPlaylistDescription(event.target.value);
        }}
      />

      <Toggle
        label={t.playlistConfig.visibilityLabel}
        hint={t.playlistConfig.visibilityHint}
        checked={config.isPublic}
        stateLabel={
          config.isPublic ? t.playlistConfig.visibilityPublic : t.playlistConfig.visibilityPrivate
        }
        onChange={setPlaylistVisibility}
      />

      {previewPath !== null && config.name.trim() !== '' && (
        <p className="field-message">
          {t.playlistConfig.pathPreview} {previewPath}
        </p>
      )}

      {nameCheckRunning && (
        <p className="field-message">{format(t.playlistConfig.checkingNames, { service })}</p>
      )}

      {nameCheckError !== null && (
        <div role="alert" className="border-danger bg-danger-soft rounded-lg border p-2 text-sm">
          <p className="font-semibold">{nameCheckError.info.title}</p>
          <p>{nameCheckError.info.cause}</p>
          <p>{nameCheckError.info.nextStep}</p>
          <Button
            size="sm"
            className="mt-2"
            onClick={() => {
              void refreshExistingNames(provider);
            }}
          >
            {t.common.retry}
          </Button>
        </div>
      )}

      {!validation.ok && validation.reason === 'no_tracks_selected' && (
        <p className="field-message text-danger">{t.playlistConfig.noTracksSelected}</p>
      )}

      <div>
        <Button
          variant="primary"
          disabled={!validation.ok || creating || searchRunning}
          onClick={() => {
            setTouched(true);
            // **O** ponto de confirmação daquele serviço (FR-019, Princípio V).
            dispatchRun({ type: 'review_confirmed' }, provider);
          }}
        >
          {format(creating ? t.playlistConfig.creating : t.playlistConfig.create, { service })}
        </Button>
        {validation.ok && (
          <p className="field-message">
            {format(t.playlistConfig.confirmBody, {
              count: items.filter((item) => item.included).length,
              name: config.name.trim(),
            })}
          </p>
        )}
      </div>
    </section>
  );
}
