import { useEffect, useState } from 'react';

import { canCreate } from '@/domain/validation';
import { startCreation } from '@/features/result/creationRunner';
import { effectivePath } from '@/features/result/effectivePath';
import { format, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
import { Button } from '@/ui/Button';
import { TextField } from '@/ui/TextField';
import { Toggle } from '@/ui/Toggle';

import { refreshExistingNames } from './nameCheck';

const MESSAGE_BY_REASON = {
  name_empty: t.playlistConfig.nameRequired,
  name_duplicate: t.playlistConfig.nameDuplicate,
  no_tracks_selected: t.playlistConfig.noTracksSelected,
  name_check_incomplete: t.errors.playlistListFailed.nextStep,
} as const;

/**
 * Dados da playlist e confirmação da criação (FR-028 a FR-031).
 *
 * Não há campo de pasta aqui nem em lugar nenhum: a plataforma não expõe pastas,
 * e simular o campo seria prometer o que não se pode cumprir (FR-038).
 */
export function PlaylistConfigForm() {
  const config = useAppStore((state) => state.playlistConfig);
  const items = useAppStore((state) => state.items);
  const existingNames = useAppStore((state) => state.existingNames);
  const nameCheckRunning = useAppStore((state) => state.nameCheckRunning);
  const nameCheckError = useAppStore((state) => state.nameCheckError);
  const session = useAppStore((state) => state.session);
  const creating = useAppStore((state) => state.creating);
  const searchRunning = useAppStore((state) => state.search.running);

  const setPlaylistName = useAppStore((state) => state.setPlaylistName);
  const setPlaylistDescription = useAppStore((state) => state.setPlaylistDescription);
  const setPlaylistVisibility = useAppStore((state) => state.setPlaylistVisibility);

  const [touched, setTouched] = useState(false);

  // A lista de nomes é buscada uma vez ao entrar na revisão; sem ela a criação
  // fica bloqueada com opção de repetir (FR-029).
  useEffect(() => {
    if (session !== null && existingNames === null && nameCheckError === null) {
      void refreshExistingNames();
    }
  }, [session, existingNames, nameCheckError]);

  const validation = canCreate(items, config, existingNames);
  const blockingMessage = validation.ok ? null : MESSAGE_BY_REASON[validation.reason];
  const showNameError = touched && !validation.ok && validation.reason !== 'no_tracks_selected';

  const previewPath =
    session === null ? null : effectivePath(session.user.displayName, config.name);

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

      {nameCheckRunning && <p className="field-message">{t.playlistConfig.checkingNames}</p>}

      {nameCheckError !== null && (
        <div role="alert" className="border-danger bg-danger-soft rounded-lg border p-2 text-sm">
          <p className="font-semibold">{nameCheckError.info.title}</p>
          <p>{nameCheckError.info.cause}</p>
          <p>{nameCheckError.info.nextStep}</p>
          <Button
            size="sm"
            className="mt-2"
            onClick={() => {
              void refreshExistingNames();
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
            void startCreation();
          }}
        >
          {creating ? t.playlistConfig.creating : t.playlistConfig.create}
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
