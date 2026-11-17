'use client';

import { useState } from 'react';
import { useI18n } from '@/presentation/i18n/I18nProvider';
import type { Result, RoomSettings } from '@/application/rooms/types';
import formStyles from '@/presentation/components/Form.module.css';
import { MatchSettingsFields } from '@/presentation/components/MatchSettingsFields';
import { Modal } from '@/presentation/components/Modal';
import modalStyles from '@/presentation/components/Modal.module.css';

interface RoomSettingsDialogProps {
  initial: RoomSettings;
  /** People already in the room: the limit cannot go below this. */
  minCoaches: number;
  onSave: (settings: RoomSettings) => Promise<Result<object>>;
  onClose: () => void;
}

/** Host-only: change visibility, player limit and match rules before starting. */
export function RoomSettingsDialog({ initial, minCoaches, onSave, onClose }: RoomSettingsDialogProps) {
  const { t } = useI18n();
  const [settings, setSettings] = useState<RoomSettings>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const result = await onSave(settings);
    setSaving(false);
    if (result.ok) onClose();
    else setError(t.errors[result.error]);
  };

  return (
    <Modal title={t.room.settingsTitle} onClose={onClose} wide>
      <div className={formStyles.form}>
        <fieldset className={formStyles.fieldset}>
          <legend className={formStyles.label}>{t.home.visibilityLabel}</legend>
          <div className="segmented">
            <button
              type="button"
              className="btn"
              aria-pressed={settings.visibility === 'public'}
              onClick={() => setSettings({ ...settings, visibility: 'public' })}
            >
              {t.home.visibilityPublic}
            </button>
            <button
              type="button"
              className="btn"
              aria-pressed={settings.visibility === 'private'}
              onClick={() => setSettings({ ...settings, visibility: 'private' })}
            >
              {t.home.visibilityPrivate}
            </button>
          </div>
          <p className={formStyles.hint}>
            {settings.visibility === 'public' ? t.home.publicHint : t.home.privateHint}
          </p>
        </fieldset>

        <MatchSettingsFields
          value={settings}
          onChange={(match) => setSettings({ ...settings, ...match })}
          mode="room"
          minCoaches={minCoaches}
          idPrefix="room-settings"
        />

        {error && (
          <p className={formStyles.error} role="alert">
            {error}
          </p>
        )}
      </div>
      <div className={modalStyles.actions}>
        <button type="button" className="btn" onClick={onClose}>
          {t.room.cancel}
        </button>
        <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
          {t.room.save}
        </button>
      </div>
    </Modal>
  );
}
