'use client';

import styles from './Banner.module.css';

interface BannerProps {
  title: string;
  body: string;
  action?: { label: string; onClick: () => void };
  tone?: 'warn' | 'info';
}

/** Floating notice at the bottom of the screen (away mode, passed on a player…). */
export function Banner({ title, body, action, tone = 'warn' }: BannerProps) {
  return (
    <div className={`${styles.banner} ${tone === 'info' ? styles.info : ''}`} role="status">
      <div>
        <strong>{title}</strong>
        <p className={styles.body}>{body}</p>
      </div>
      {action && (
        <button type="button" className="btn btn-primary" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
