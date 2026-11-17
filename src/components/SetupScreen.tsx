'use client';

import { useState, type FormEvent } from 'react';
import type { GameConfig } from '@/hooks/useAuction';
import { useI18n } from '@/i18n/I18nProvider';
import { DeerMascot } from './DeerMascot';
import { Header } from './Header';
import styles from './SetupScreen.module.css';

interface SetupScreenProps {
  onStart: (config: GameConfig) => void;
}

const CLOCK_SECONDS_OPTIONS = [10, 15, 20];
const MAX_NAME_LENGTH = 20;

export function SetupScreen({ onStart }: SetupScreenProps) {
  const [coachName, setCoachName] = useState('');
  const [coachCount, setCoachCount] = useState(8);
  const [benchSize, setBenchSize] = useState<0 | 2>(0);
  const [bidSeconds, setBidSeconds] = useState(15);
  const { t } = useI18n();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onStart({ coachName: coachName.trim() || t.common.you, coachCount, benchSize, bidSeconds });
  };

  return (
    <div className="container">
      <Header subtitle={t.common.tagline} />

      <div className={styles.layout}>
        <section className={styles.main} aria-labelledby="setup-title">
          <div>
            <h1 id="setup-title" className={`display ${styles.title}`}>
              {t.setup.titleLine1}
              <br />
              {t.setup.titleLine2}
            </h1>
            <p className={styles.lead}>{t.setup.lead}</p>
          </div>

          <form className={`card ${styles.form}`} onSubmit={handleSubmit}>
            <div className={styles.row}>
              <div className={styles.field}>
                <label htmlFor="coach-name" className={styles.label}>
                  {t.setup.nameLabel}
                </label>
                <input
                  id="coach-name"
                  className={styles.input}
                  value={coachName}
                  maxLength={MAX_NAME_LENGTH}
                  placeholder={t.setup.namePlaceholder}
                  onChange={(event) => setCoachName(event.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="coach-count" className={styles.label}>
                  {t.setup.coachesLabel}: <span className={styles.value}>{coachCount}</span>
                </label>
                <input
                  id="coach-count"
                  type="range"
                  min={2}
                  max={16}
                  value={coachCount}
                  className={styles.range}
                  onChange={(event) => setCoachCount(Number(event.target.value))}
                />
                <div className={styles.rangeHint}>
                  <span>{t.setup.coachesHint(coachCount - 1)}</span>
                  <span>2–16</span>
                </div>
              </div>
            </div>

            <div className={styles.row}>
              <fieldset className={styles.fieldset}>
                <legend className={styles.label}>{t.setup.rosterLabel}</legend>
                <div className="segmented">
                  <button type="button" className="btn" aria-pressed={benchSize === 0} onClick={() => setBenchSize(0)}>
                    {t.setup.rosterStarters}
                  </button>
                  <button type="button" className="btn" aria-pressed={benchSize === 2} onClick={() => setBenchSize(2)}>
                    {t.setup.rosterWithBench}
                  </button>
                </div>
              </fieldset>
              <fieldset className={styles.fieldset}>
                <legend className={styles.label}>{t.setup.clockLabel}</legend>
                <div className="segmented">
                  {CLOCK_SECONDS_OPTIONS.map((seconds) => (
                    <button
                      key={seconds}
                      type="button"
                      className="btn"
                      aria-pressed={bidSeconds === seconds}
                      onClick={() => setBidSeconds(seconds)}
                    >
                      {seconds}s
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>

            <button type="submit" className="btn btn-primary btn-big">
              {t.setup.start}
            </button>
          </form>
        </section>

        <aside className={styles.side} aria-label={t.setup.rulesLabel}>
          <div className={styles.bill} role="img" aria-label={t.setup.billLabel}>
            <div className={styles.billInner}>
              <span className={`display ${styles.billValue}`}>$20</span>
              <span className={styles.billPortrait}>
                <DeerMascot size={84} />
              </span>
              <span className={`display ${styles.billValue}`}>20</span>
            </div>
          </div>

          <div className="card">
            <h2 className="eyebrow">{t.setup.rulesTitle}</h2>
            <ul className={styles.rules}>
              {t.setup.rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
