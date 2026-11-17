import { DeerMascot } from './DeerMascot';
import { Preferences } from './Preferences';
import styles from './Header.module.css';

interface HeaderProps {
  subtitle?: string;
  children?: React.ReactNode;
}

export function Header({ subtitle, children }: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <DeerMascot size={48} />
        <div>
          <div className={`display ${styles.logo}`}>
            20 BUCKS <span className={styles.accent}>EACH</span>
          </div>
          {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
        </div>
      </div>
      <div className={styles.actions}>
        {children}
        <Preferences />
      </div>
    </header>
  );
}
