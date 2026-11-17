'use client';

import { useMemo } from 'react';
import { useI18n } from '@/presentation/i18n/I18nProvider';
import type { Coach, Player } from '@/domain/auction/types';
import { canSwap } from '@/domain/auction/lineup';
import { isNaturalPosition } from '@/domain/auction/positions';
import { slotLabel } from '@/presentation/format';
import { teamRating } from '@/domain/simulation/strength';
import {
  fitLevel,
  OFFENSE_STYLES,
  offenseBonus,
  PACES,
  paceBonus,
  tacticBonus,
  teamProfile,
  type FitLevel,
  type Tactic,
} from '@/domain/simulation/tactics';
import { ExitGameButton } from '@/presentation/components/ExitGame';
import { Header } from '@/presentation/components/Header';
import styles from './Tactics.module.css';

interface TacticsScreenProps {
  coach: Coach;
  players: Record<string, Player>;
  tactic: Tactic;
  onChange: (tactic: Tactic) => void;
  /** Trade the players of two roster slots. */
  onSwap: (a: number, b: number) => void;
  onConfirm: () => void;
  /** Rooms only: the choice was sent and we are waiting for the others. */
  confirmed?: boolean;
  onUnconfirm?: () => void;
  /** Rooms only: countdown and how many coaches are done. */
  msLeft?: number;
  readyCount?: number;
  totalCount?: number;
  /**
   * "Hide overall" matches: no ratings, attributes or tactic effects on screen,
   * so picking the tactic is a read of the roster, not a math problem.
   */
  hideRatings?: boolean;
}

const PROFILE_KEYS = ['shooting', 'paint', 'athleticism', 'playmaking'] as const;

function formatClock(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function signed(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}`;
}

export function TacticsScreen({
  coach,
  players,
  tactic,
  onChange,
  onSwap,
  onConfirm,
  confirmed = false,
  onUnconfirm,
  msLeft,
  readyCount,
  totalCount,
  hideRatings = false,
}: TacticsScreenProps) {
  const { t } = useI18n();
  const profile = useMemo(() => teamProfile(coach, players), [coach, players]);
  const base = teamRating(coach, players);
  const bonus = tacticBonus(profile, tactic);

  return (
    <div className="container">
      <Header subtitle={t.tactics.subtitle}>
        <ExitGameButton />
      </Header>

      <div className={styles.intro}>
        <h1 className={`display ${styles.title}`}>{t.tactics.title}</h1>
        <p className={styles.lead}>{t.tactics.lead}</p>
        {msLeft !== undefined && (
          <p className={styles.clock} aria-live="polite">
            {t.tactics.timeLeft(formatClock(msLeft))}
          </p>
        )}
      </div>

      <div className={styles.layout}>
        <section className={`card ${styles.team}`} aria-labelledby="your-team">
          <h2 id="your-team" className="eyebrow">
            {t.tactics.lineupTitle}
          </h2>
          <p className={styles.hint}>{t.tactics.lineupHint}</p>
          <ul className={styles.roster}>
            {coach.roster.map((slot, index) => {
              const player = slot.playerId ? players[slot.playerId] : null;
              const outOfPosition = !!player && slot.kind !== 'BENCH' && !isNaturalPosition(player, slot.kind);
              // Who can come into this slot: anyone whose swap is valid both ways.
              const options = coach.roster
                .map((other, otherIndex) => ({ other, otherIndex }))
                .filter(({ other, otherIndex }) => other.playerId && (otherIndex === index || canSwap(coach, index, otherIndex, players)));
              const label = slotLabel(slot.kind, t);
              return (
                <li key={index} className={styles.lineupRow}>
                  <label htmlFor={`slot-${index}`} className={styles.slot}>
                    {label}
                  </label>
                  <select
                    id={`slot-${index}`}
                    className={styles.lineupSelect}
                    value={index}
                    disabled={confirmed || options.length <= 1}
                    aria-label={t.tactics.slotLabel(label)}
                    onChange={(event) => onSwap(index, Number(event.target.value))}
                  >
                    {options.map(({ other, otherIndex }) => (
                      <option key={otherIndex} value={otherIndex}>
                        {players[other.playerId!].name} ({players[other.playerId!].positions.join('/')})
                      </option>
                    ))}
                  </select>
                  {outOfPosition && (
                    <span
                      className={styles.outOfPosition}
                      title={hideRatings ? t.tactics.outOfPositionHidden : t.tactics.outOfPosition}
                    >
                      {hideRatings ? '!' : '−3'}
                    </span>
                  )}
                  {!hideRatings && <span className={styles.ovr}>{player?.overall}</span>}
                </li>
              );
            })}
          </ul>
          {!hideRatings && (
          <div className={styles.profile}>
            {PROFILE_KEYS.map((key) => (
              <div key={key} className={styles.profileRow}>
                <div className={styles.profileHead}>
                  <span>{t.tactics.profile[key]}</span>
                  <strong>{Math.round(profile[key])}</strong>
                </div>
                <div className={styles.bar}>
                  <div className={styles.barFill} style={{ width: `${Math.round(profile[key])}%` }} />
                </div>
              </div>
            ))}
          </div>
          )}
        </section>

        <div className={styles.choices}>
          <OptionGroup
            label={t.tactics.offenseLabel}
            options={OFFENSE_STYLES.map((offense) => ({
              id: offense,
              name: t.tactics.offense[offense].name,
              description: t.tactics.offense[offense].description,
              fit: hideRatings ? null : fitLevel(offenseBonus(profile, offense)),
              selected: tactic.offense === offense,
              onSelect: () => onChange({ ...tactic, offense }),
            }))}
            disabled={confirmed}
          />
          <OptionGroup
            label={t.tactics.paceLabel}
            options={PACES.map((pace) => ({
              id: pace,
              name: t.tactics.pace[pace].name,
              description: t.tactics.pace[pace].description,
              fit: hideRatings ? null : fitLevel(paceBonus(profile, pace)),
              selected: tactic.pace === pace,
              onSelect: () => onChange({ ...tactic, pace }),
            }))}
            disabled={confirmed}
          />

          {hideRatings ? (
            <div className={`card ${styles.hiddenNote}`}>
              <strong>{t.tactics.hiddenTitle}</strong>
              <span className="muted">{t.tactics.hiddenNote}</span>
            </div>
          ) : (
          <div className={`card ${styles.summary}`}>
            <div>
              <span className={styles.summaryLabel}>{t.tactics.rosterStrength}</span>
              <span className={styles.summaryValue}>{base.toFixed(1)}</span>
            </div>
            <div>
              <span className={styles.summaryLabel}>{t.tactics.tacticEffect}</span>
              <span className={`${styles.summaryValue} ${bonus >= 0 ? styles.positive : styles.negative}`}>
                {signed(bonus)}
              </span>
            </div>
            <div>
              <span className={styles.summaryLabel}>{t.tactics.finalStrength}</span>
              <span className={`display ${styles.finalValue}`}>{(base + bonus).toFixed(1)}</span>
            </div>
          </div>
          )}

          {confirmed ? (
            <div className={`card ${styles.waiting}`} role="status">
              <strong>{t.tactics.confirmed}</strong>
              {readyCount !== undefined && totalCount !== undefined && (
                <span className="muted">{t.tactics.waitingOthers(readyCount, totalCount)}</span>
              )}
              {onUnconfirm && (
                <button type="button" className="btn" onClick={onUnconfirm}>
                  {t.tactics.change}
                </button>
              )}
            </div>
          ) : (
            <>
              <button type="button" className="btn btn-primary btn-big" onClick={onConfirm}>
                {t.tactics.confirm}
              </button>
              {msLeft !== undefined && <p className="muted">{t.tactics.timeoutNote}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface Option {
  id: string;
  name: string;
  description: string;
  /** Null when the match hides how well each option fits. */
  fit: FitLevel | null;
  selected: boolean;
  onSelect: () => void;
}

function OptionGroup({ label, options, disabled }: { label: string; options: Option[]; disabled: boolean }) {
  const { t } = useI18n();
  return (
    <fieldset className={styles.group}>
      <legend className="eyebrow">{label}</legend>
      <div className={styles.options}>
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={styles.option}
            aria-pressed={option.selected}
            disabled={disabled}
            onClick={option.onSelect}
          >
            <span className={styles.optionName}>{option.name}</span>
            <span className={styles.optionDescription}>{option.description}</span>
            {option.fit && (
              <span className={`${styles.fit} ${styles[`fit_${option.fit}`]}`}>{t.tactics.fit[option.fit]}</span>
            )}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

