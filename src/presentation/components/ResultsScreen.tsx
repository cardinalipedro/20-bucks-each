'use client';

import type { AuctionState, Coach } from '@/domain/auction/types';
import { useI18n } from '@/presentation/i18n/I18nProvider';
import { isNaturalPosition } from '@/domain/auction/positions';
import { amountSpent, bestGm as pickBestGm, biggestBuy as pickBiggestBuy, rankByRating } from '@/domain/awards/awards';
import { coachLabel, formatMoney, slotLabel } from '@/presentation/format';
import { teamRating } from '@/domain/simulation/strength';
import { ExitGameButton } from './ExitGame';
import { Header } from './Header';
import styles from './ResultsScreen.module.css';

interface ResultsScreenProps {
  state: AuctionState;
  humanId: string;
  onContinue: () => void;
  continueLabel: string;
}

export function ResultsScreen({ state, humanId, onContinue, continueLabel }: ResultsScreenProps) {
  const { t } = useI18n();
  const { startingCash } = state.settings;
  const ranked = rankByRating(state);
  const bestGm = pickBestGm(state);
  const biggestBuy = pickBiggestBuy(state);
  const rating = (coach: Coach) => teamRating(coach, state.players);
  const spent = (coach: Coach) => amountSpent(coach, state);
  const coachName = (id: string) => {
    const coach = state.coaches.find((c) => c.id === id);
    return coach ? coachLabel(coach, t) : '?';
  };

  return (
    <div className="container">
      <Header subtitle={t.results.subtitle}>
        <ExitGameButton />
      </Header>

      <h1 className={`display ${styles.title}`}>{t.results.title}</h1>
      <p className={`muted ${styles.note}`}>{t.results.note}</p>
      <button type="button" className={`btn btn-primary btn-big ${styles.continue}`} onClick={onContinue}>
        {continueLabel}
      </button>

      <div className={styles.awards}>
        <div className={`card ${styles.award}`}>
          <span className={styles.awardLabel}>{t.results.strongest}</span>
          <span className={`display ${styles.awardValue}`}>{coachLabel(ranked[0], t)}</span>
          <span className="muted">{t.results.strength(rating(ranked[0]))}</span>
        </div>
        <div className={`card ${styles.award}`}>
          <span className={styles.awardLabel}>{t.results.bestGm}</span>
          <span className={`display ${styles.awardValue}`}>{coachLabel(bestGm, t)}</span>
          <span className="muted">
            {t.results.bestGmDetail(formatMoney(spent(bestGm)), rating(bestGm))}
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
                  {t.results.spentOf(formatMoney(spent(coach)), formatMoney(startingCash))}
                </span>
              </div>
              <span className={`display ${styles.strength}`}>{rating(coach)}</span>
            </div>
            <ul className={styles.roster}>
              {coach.roster.map((slot, slotIndex) => {
                const player = slot.playerId ? state.players[slot.playerId] : null;
                return (
                  <li key={slotIndex} className={styles.rosterItem}>
                    <span className={styles.slotTag}>{slotLabel(slot.kind, t)}</span>
                    <span className={styles.playerName}>{player?.name ?? '—'}</span>
                    {player && slot.kind !== 'BENCH' && !isNaturalPosition(player, slot.kind) && (
                      <span className={styles.offPosition} title={t.tactics.outOfPosition}>
                        −3
                      </span>
                    )}
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
