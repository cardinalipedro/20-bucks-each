'use client';

import { teamStrength } from '@/lib/auction/rules';
import type { AuctionState, Coach } from '@/lib/auction/types';
import { useI18n } from '@/i18n/I18nProvider';
import { coachLabel, formatMoney, slotLabel } from '@/lib/format';
import { Header } from './Header';
import styles from './ResultsScreen.module.css';

interface ResultsScreenProps {
  state: AuctionState;
  humanId: string;
  onRestart: () => void;
}

/** Overall points above a replacement-level player (75) per dollar spent. */
const REPLACEMENT_OVERALL = 75;

function spent(coach: Coach, startingCash: number): number {
  return startingCash - coach.cash;
}

function efficiency(coach: Coach, state: AuctionState): number {
  const value = coach.roster.reduce(
    (sum, slot) => sum + (slot.playerId ? Math.max(0, state.players[slot.playerId].overall - REPLACEMENT_OVERALL) : 0),
    0,
  );
  return value / Math.max(1, spent(coach, state.settings.startingCash));
}

export function ResultsScreen({ state, humanId, onRestart }: ResultsScreenProps) {
  const { t } = useI18n();
  const { startingCash } = state.settings;
  const ranked = [...state.coaches].sort((a, b) => teamStrength(b, state.players) - teamStrength(a, state.players));
  const bestGm = [...state.coaches].sort((a, b) => efficiency(b, state) - efficiency(a, state))[0];
  const biggestBuy = [...state.history].filter((r) => r.winnerId).sort((a, b) => b.price - a.price)[0];
  const coachName = (id: string) => {
    const coach = state.coaches.find((c) => c.id === id);
    return coach ? coachLabel(coach, t) : '?';
  };

  return (
    <div className="container">
      <Header subtitle={t.results.subtitle}>
        <button type="button" className="btn btn-primary" onClick={onRestart}>
          {t.results.playAgain}
        </button>
      </Header>

      <h1 className={`display ${styles.title}`}>{t.results.title}</h1>
      <p className={`muted ${styles.note}`}>{t.results.note}</p>

      <div className={styles.awards}>
        <div className={`card ${styles.award}`}>
          <span className={styles.awardLabel}>{t.results.strongest}</span>
          <span className={`display ${styles.awardValue}`}>{coachLabel(ranked[0], t)}</span>
          <span className="muted">{t.results.strength(teamStrength(ranked[0], state.players))}</span>
        </div>
        <div className={`card ${styles.award}`}>
          <span className={styles.awardLabel}>{t.results.bestGm}</span>
          <span className={`display ${styles.awardValue}`}>{coachLabel(bestGm, t)}</span>
          <span className="muted">
            {t.results.bestGmDetail(formatMoney(spent(bestGm, startingCash)), teamStrength(bestGm, state.players))}
          </span>
        </div>
        {biggestBuy && (
          <div className={`card ${styles.award}`}>
            <span className={`${styles.awardLabel} ${styles.warn}`}>{t.results.biggestBuy}</span>
            <span className={`display ${styles.awardValue}`}>{state.players[biggestBuy.playerId].name}</span>
            <span className="muted">
              {t.results.paid(coachName(biggestBuy.winnerId!), formatMoney(biggestBuy.price))}
            </span>
          </div>
        )}
      </div>

      <ol className={styles.teams}>
        {ranked.map((coach, index) => (
          <li key={coach.id} className={`card ${styles.team} ${coach.id === humanId ? styles.mine : ''}`}>
            <div className={styles.teamHead}>
              <span className={`display ${styles.rank}`}>{index + 1}</span>
              <div>
                <h2 className={styles.teamName}>
                  {coachLabel(coach, t)}
                  {coach.id === humanId && <span className={styles.youBadge}>{t.common.youBadge}</span>}
                </h2>
                <span className="muted">
                  {t.results.spentOf(formatMoney(spent(coach, startingCash)), formatMoney(startingCash))}
                </span>
              </div>
              <span className={`display ${styles.strength}`}>{teamStrength(coach, state.players)}</span>
            </div>
            <ul className={styles.roster}>
              {coach.roster.map((slot, slotIndex) => {
                const player = slot.playerId ? state.players[slot.playerId] : null;
                return (
                  <li key={slotIndex} className={styles.rosterItem}>
                    <span className={styles.slotTag}>{slotLabel(slot.kind, t)}</span>
                    <span className={styles.playerName}>{player?.name ?? '—'}</span>
                    <span className={styles.ovr}>{player?.overall}</span>
                    <span className={styles.price}>{formatMoney(slot.price)}</span>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
