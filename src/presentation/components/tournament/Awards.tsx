'use client';

import { useI18n } from '@/presentation/i18n/I18nProvider';
import type { AuctionState } from '@/domain/auction/types';
import { amountSpent, bestGm, biggestBuy } from '@/domain/awards/awards';
import { formatMoney, slotLabel } from '@/presentation/format';
import type { TournamentView } from '@/domain/simulation/types';
import { DeerMascot } from '@/presentation/components/DeerMascot';
import styles from './Tournament.module.css';

interface AwardsProps {
  tournament: TournamentView;
  auction: AuctionState;
  names: Record<string, string>;
  humanId: string;
}

export function Awards({ tournament, auction, names, humanId }: AwardsProps) {
  const { t } = useI18n();
  const champion = auction.coaches.find((coach) => coach.id === tournament.championId)!;
  const gm = bestGm(auction);
  const buy = biggestBuy(auction);
  const mvp = tournament.mvp;
  const perGame = (value: number) => (mvp ? (value / mvp.games).toFixed(1) : '0');
  const finalsMvp = tournament.finalsMvp;
  const finalsPerGame = (value: number) => (finalsMvp ? (value / finalsMvp.games).toFixed(1) : '0');

  return (
    <div className={styles.awardsView}>
      <section className={styles.championCard} aria-labelledby="champion-title">
        <DeerMascot size={96} />
        <div className={styles.championInfo}>
          <span className={styles.championLabel}>{t.tournament.champion}</span>
          <h2 id="champion-title" className={`display ${styles.championName}`}>
            {names[champion.id]}
          </h2>
          {champion.id === humanId && <span className={styles.championYou}>{t.tournament.youWon}</span>}
          <ul className={styles.championRoster}>
            {champion.roster.map((slot, index) => (
              <li key={index}>
                <span className={styles.seed}>{slotLabel(slot.kind, t)}</span>
                {slot.playerId ? auction.players[slot.playerId].name : '—'}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className={styles.awardGrid}>
        {mvp && (
          <div className={`card ${styles.award}`}>
            <span className={styles.awardLabel}>{t.tournament.mvp}</span>
            <span className={`display ${styles.awardValue}`}>{auction.players[mvp.playerId].name}</span>
            <span className="muted">{t.tournament.mvpLine(perGame(mvp.points), perGame(mvp.rebounds), perGame(mvp.assists))}</span>
            <span className="muted">{t.tournament.teamOf(names[mvp.coachId])}</span>
          </div>
        )}
        {finalsMvp && (
          <div className={`card ${styles.award}`}>
            <span className={styles.awardLabel}>{t.tournament.finalsMvp}</span>
            <span className={`display ${styles.awardValue}`}>{auction.players[finalsMvp.playerId].name}</span>
            <span className="muted">
              {t.tournament.finalsMvpLine(
                finalsPerGame(finalsMvp.points),
                finalsPerGame(finalsMvp.rebounds),
                finalsPerGame(finalsMvp.assists),
              )}
            </span>
            <span className="muted">{t.tournament.teamOf(names[finalsMvp.coachId])}</span>
          </div>
        )}
        <div className={`card ${styles.award}`}>
          <span className={styles.awardLabel}>{t.results.bestGm}</span>
          <span className={`display ${styles.awardValue}`}>{names[gm.id]}</span>
          <span className="muted">
            {t.results.bestGmDetail(formatMoney(amountSpent(gm, auction)), tournament.ratings[gm.id])}
          </span>
        </div>
        {buy && (
          <div className={`card ${styles.award}`}>
            <span className={`${styles.awardLabel} ${styles.warn}`}>{t.results.biggestBuy}</span>
            <span className={`display ${styles.awardValue}`}>{auction.players[buy.playerId].name}</span>
            <span className="muted">{t.results.paid(names[buy.winnerId!], formatMoney(buy.price))}</span>
          </div>
        )}
      </div>
    </div>
  );
}
