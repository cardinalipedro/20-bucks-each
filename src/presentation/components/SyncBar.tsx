'use client';

import { useI18n } from '@/presentation/i18n/I18nProvider';
import styles from './SyncBar.module.css';

export interface SyncControl {
  /** Milliseconds until the room moves on by itself (null when it will not). */
  msLeft: number | null;
  /** The round's games are still being played: no countdown, no ready yet. */
  playing: boolean;
  youReady: boolean;
  readyCount: number;
  total: number;
  onReady: (ready: boolean) => void;
}

/** Countdown and ready button shared by every player in a room. */
export function SyncBar({ msLeft, playing, youReady, readyCount, total, onReady }: SyncControl) {
  const { t } = useI18n();
  const seconds = msLeft === null ? null : Math.max(0, Math.ceil(msLeft / 1000));

  return (
    <div className={styles.bar}>
      <span className={styles.status} aria-live="polite">
        {playing ? t.sync.playing : t.sync.status(seconds, readyCount, total)}
      </span>
      <button
        type="button"
        className={`btn ${youReady ? '' : 'btn-primary'} ${styles.button}`}
        aria-pressed={youReady}
        disabled={playing}
        onClick={() => onReady(!youReady)}
      >
        {youReady ? t.sync.cancel : t.sync.ready}
      </button>
    </div>
  );
}
