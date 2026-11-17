'use client';

import { useMemo } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import type { Coach, Player } from '@/lib/auction/types';
import { slotLabel } from '@/lib/format';
import { teamRating } from '@/lib/sim/strength';
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
} from '@/lib/sim/tactics';
import { ExitGameButton } from '../ExitGame';
import { Header } from '../Header';
import styles from './Tactics.module.css';

interface TacticsScreenProps {
  coach: Coach;
  players: Record<string, Player>;
  tactic: Tactic;
  onChange: (tactic: Tactic) => void;
  onConfirm: () => void;
  /** Rooms only: the choice was sent and we are waiting for the others. */
  confirmed?: boolean;
  onUnconfirm?: () => void;
  /** Rooms only: countdown and how many coaches are done. */
  msLeft?: number;
  readyCount?: number;
  totalCount?: number;
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
  onConfirm,
  confirmed = false,
  onUnconfirm,
  msLeft,
  readyCount,
  totalCount,
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
            {t.tactics.yourTeam}
          </h2>
          <ul className={styles.roster}>
            {coach.roster.map((slot, index) => {
              const player = slot.playerId ? players[slot.playerId] : null;
              return (
                <li key={index}>
                  <span className={styles.slot}>{slotLabel(slot.kind, t)}</span>
                  <span className={styles.playerName}>{player?.name ?? '—'}</span>
                  <span className={styles.ovr}>{player?.overall}</span>
                </li>
              );
            })}
          </ul>
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
        </section>

        <div className={styles.choices}>
          <OptionGroup
            label={t.tactics.offenseLabel}
            options={OFFENSE_STYLES.map((offense) => ({
              id: offense,
              name: t.tactics.offense[offense].name,
              description: t.tactics.offense[offense].description,
              fit: fitLevel(offenseBonus(profile, offense)),
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
              fit: fitLevel(paceBonus(profile, pace)),
              selected: tactic.pace === pace,
              onSelect: () => onChange({ ...tactic, pace }),
            }))}
            disabled={confirmed}
          />

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
  fit: FitLevel;
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
            <span className={`${styles.fit} ${styles[`fit_${option.fit}`]}`}>{t.tactics.fit[option.fit]}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

