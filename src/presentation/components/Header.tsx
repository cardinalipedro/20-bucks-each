'use client';

import { useI18n } from '@/presentation/i18n/I18nProvider';
import { DeerMascot } from './DeerMascot';
import { useExitGame } from './ExitGame';
import { Preferences } from './Preferences';
import styles from './Header.module.css';

interface HeaderProps {
  subtitle?: string;
  children?: React.ReactNode;
}

export function Header({ subtitle, children }: HeaderProps) {
  const { t } = useI18n();
  const { inGame, requestExit } = useExitGame();

  const logo = (
    <>
      <DeerMascot size={48} />
      <span className={styles.logoText}>
        <span className={`display ${styles.logo}`}>
          20 BUCKS <span className={styles.accent}>EACH</span>
        </span>
        {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      </span>
    </>
  );

  return (
    <header className={styles.header}>
      {inGame ? (
        <button
          type="button"
          className={`${styles.brand} ${styles.brandButton}`}
          onClick={requestExit}
          title={t.common.backToMenu}
          aria-label={`20 Bucks Each · ${t.common.backToMenu}`}
        >
          {logo}
        </button>
      ) : (
        <div className={styles.brand}>{logo}</div>
      )}
      <div className={styles.actions}>
        {children}
        <Preferences />
      </div>
    </header>
  );
}
