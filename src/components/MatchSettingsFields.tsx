'use client';

import { useI18n } from '@/i18n/I18nProvider';
import { MAX_COACHES, MIN_COACHES, type MatchSettings } from '@/lib/rooms/types';
import type { TournamentFormat, TournamentSettings } from '@/lib/sim/types';
import styles from './Form.module.css';

const CLOCK_SECONDS_OPTIONS = [10, 15, 20];
const FORMATS: TournamentFormat[] = ['seasonAndPlayoffs', 'seasonOnly', 'playoffsOnly'];
const PLAYOFF_TEAM_OPTIONS: Array<TournamentSettings['playoffTeams']> = [4, 8];
const SERIES_OPTIONS: Array<TournamentSettings['seriesLength']> = [1, 3, 7];

interface MatchSettingsFieldsProps {
  value: MatchSettings;
  onChange: (value: MatchSettings) => void;
  /** "solo": you + bots. "room": seats for people, optionally filled by bots. */
  mode: 'solo' | 'room';
  /** Lowest allowed number of coaches (e.g. people already in the room). */
  minCoaches?: number;
  idPrefix: string;
}

/** Match rules: coaches, roster, clock and competition format. */
export function MatchSettingsFields({ value, onChange, mode, minCoaches = MIN_COACHES, idPrefix }: MatchSettingsFieldsProps) {
  const { t } = useI18n();
  const set = (patch: Partial<MatchSettings>) => onChange({ ...value, ...patch });
  const setTournament = (patch: Partial<TournamentSettings>) =>
    onChange({ ...value, tournament: { ...value.tournament, ...patch } });

  const formatLabels: Record<TournamentFormat, string> = {
    seasonAndPlayoffs: t.setup.formatSeasonAndPlayoffs,
    seasonOnly: t.setup.formatSeasonOnly,
    playoffsOnly: t.setup.formatPlayoffsOnly,
  };
  const { format } = value.tournament;

  return (
    <>
      <div className={styles.field}>
        <label htmlFor={`${idPrefix}-coaches`} className={styles.label}>
          {t.setup.coachesLabel}: <span className={styles.value}>{value.maxCoaches}</span>
        </label>
        <input
          id={`${idPrefix}-coaches`}
          type="range"
          min={Math.max(MIN_COACHES, minCoaches)}
          max={MAX_COACHES}
          value={value.maxCoaches}
          className={styles.range}
          onChange={(event) => set({ maxCoaches: Number(event.target.value) })}
        />
        <div className={styles.rangeHint}>
          <span>{mode === 'solo' ? t.setup.coachesHint(value.maxCoaches - 1) : ''}</span>
          <span>
            {MIN_COACHES}–{MAX_COACHES}
          </span>
        </div>
        {mode === 'room' && (
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={value.fillWithBots}
              onChange={(event) => set({ fillWithBots: event.target.checked })}
            />
            {t.home.fillWithBots}
          </label>
        )}
      </div>

      <div className={styles.row}>
        <fieldset className={styles.fieldset}>
          <legend className={styles.label}>{t.setup.rosterLabel}</legend>
          <div className="segmented">
            <button type="button" className="btn" aria-pressed={value.benchSize === 0} onClick={() => set({ benchSize: 0 })}>
              {t.setup.rosterStarters}
            </button>
            <button type="button" className="btn" aria-pressed={value.benchSize === 2} onClick={() => set({ benchSize: 2 })}>
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
                aria-pressed={value.bidSeconds === seconds}
                onClick={() => set({ bidSeconds: seconds })}
              >
                {seconds}s
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className={styles.field}>
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={value.hideOverall}
            onChange={(event) => set({ hideOverall: event.target.checked })}
          />
          {t.setup.hideOverall}
        </label>
        <p className={styles.hint}>{t.setup.hideOverallHint}</p>
      </div>

      <fieldset className={styles.fieldset}>
        <legend className={styles.label}>{t.setup.formatLabel}</legend>
        <div className="segmented">
          {FORMATS.map((option) => (
            <button
              key={option}
              type="button"
              className="btn"
              aria-pressed={format === option}
              onClick={() => setTournament({ format: option })}
            >
              {formatLabels[option]}
            </button>
          ))}
        </div>
      </fieldset>

      {format !== 'seasonOnly' && (
        <div className={styles.row}>
          {format === 'seasonAndPlayoffs' && (
            <fieldset className={styles.fieldset}>
              <legend className={styles.label}>{t.setup.playoffTeamsLabel}</legend>
              <div className="segmented">
                {PLAYOFF_TEAM_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className="btn"
                    aria-pressed={value.tournament.playoffTeams === option}
                    onClick={() => setTournament({ playoffTeams: option })}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          <fieldset className={styles.fieldset}>
            <legend className={styles.label}>{t.setup.seriesLabel}</legend>
            <div className="segmented">
              {SERIES_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className="btn"
                  aria-pressed={value.tournament.seriesLength === option}
                  onClick={() => setTournament({ seriesLength: option })}
                >
                  {t.setup.seriesLength(option)}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      )}
    </>
  );
}
