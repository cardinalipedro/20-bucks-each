'use client';

import { useI18n } from '@/presentation/i18n/I18nProvider';
import styles from './SyncBar.module.css';

export interface SyncControl {
  /** Milliseconds until the room moves on by itself (null when it will not). */
  msLeft: number | null;
  youReady: boolean;
  readyCount: number;
  total: number;
  onReady: (ready: boolean) => void;
}

/** Countdown and ready button shared by every player in a room. */
export function SyncBar({ msLeft, youReady, readyCount, total, onReady }: SyncControl) {
  const { t } = useI18n();
  const seconds = msLeft === null ? null : Math.max(0, Math.ceil(msLeft / 1000));

  return (
    <div className={styles.bar}>
      <span className={styles.status} aria-live="polite">
        {t.sync.status(seconds, readyCount, total)}
      </span>
      <button
        type="button"
        className={`btn ${youReady ? '' : 'btn-primary'} ${styles.button}`}
        aria-pressed={youReady}
        onClick={() => onReady(!youReady)}
      >
        {youReady ? t.sync.cancel : t.sync.ready}
      </button>
    </div>
  );
}
