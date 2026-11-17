'use client';

import { useI18n } from '@/i18n/I18nProvider';
import styles from './Room.module.css';

/** Shown while a bot is playing for you because you went idle. */
export function AwayBanner({ onBack, inLobby = false }: { onBack: () => void; inLobby?: boolean }) {
  const { t } = useI18n();
  return (
    <div className={styles.awayBanner} role="status">
      <div>
        <strong>{t.away.title}</strong>
        <p className={styles.awayBody}>{inLobby ? t.away.lobbyBody : t.away.body}</p>
      </div>
      <button type="button" className="btn btn-primary" onClick={onBack}>
        {t.away.back}
      </button>
    </div>
  );
}
