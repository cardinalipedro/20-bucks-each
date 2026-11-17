'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/presentation/i18n/I18nProvider';
import { LOCALE_LABELS, LOCALES } from '@/presentation/i18n/messages';
import { applyTheme, readTheme, type Theme } from '@/presentation/theme/theme';
import styles from './Preferences.module.css';

/** Language picker and light/dark toggle shown in the header. */
export function Preferences() {
  const { locale, setLocale, t } = useI18n();
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    setTheme(readTheme());
  }, []);

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setTheme(next);
  };

  return (
    <div className={styles.preferences}>
      <div className={styles.languages} role="group" aria-label={t.common.language}>
        {LOCALES.map((option) => (
          <button
            key={option}
            type="button"
            className={styles.language}
            aria-pressed={locale === option}
            onClick={() => setLocale(option)}
          >
            {LOCALE_LABELS[option]}
          </button>
        ))}
      </div>
      <button
        type="button"
        className={styles.themeToggle}
        aria-label={theme === 'dark' ? t.common.switchToLight : t.common.switchToDark}
        title={theme === 'dark' ? t.common.switchToLight : t.common.switchToDark}
        onClick={toggleTheme}
      >
        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      </button>
    </div>
  );
}

function SunIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}
