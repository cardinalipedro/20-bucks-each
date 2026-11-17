'use client';

import { useI18n } from '@/i18n/I18nProvider';
import type { PlayoffRound, Seed, Series } from '@/lib/sim/types';
import styles from './Tournament.module.css';

interface BracketProps {
  rounds: PlayoffRound[];
  /** How many rounds have been played (their results are visible). */
  revealed: number;
  /** Whether the matchups of round `revealed` are already known. */
  nextKnown: boolean;
  names: Record<string, string>;
  humanId: string;
}

export function Bracket({ rounds, revealed, nextKnown, names, humanId }: BracketProps) {
  const { t } = useI18n();

  return (
    <div className={styles.bracket}>
      {rounds.map((round, index) => {
        const played = index < revealed;
        const known = played || (index === revealed && nextKnown);
        return (
          <section key={index} className={styles.bracketRound} aria-label={t.tournament.playoffRoundName(round.series.length)}>
            <h3 className="eyebrow">{t.tournament.playoffRoundName(round.series.length)}</h3>
            {round.series.map((series, seriesIndex) =>
              known ? (
                <SeriesCard key={seriesIndex} series={series} played={played} names={names} humanId={humanId} />
              ) : (
                <div key={seriesIndex} className={styles.seriesCard}>
                  <div className={styles.seriesRow}>
                    <span className="muted">{t.tournament.tbd}</span>
                  </div>
                  <div className={styles.seriesRow}>
                    <span className="muted">{t.tournament.tbd}</span>
                  </div>
                </div>
              ),
            )}
          </section>
        );
      })}
    </div>
  );
}

interface SeriesCardProps {
  series: Series;
  played: boolean;
  names: Record<string, string>;
  humanId: string;
}

function SeriesCard({ series, played, names, humanId }: SeriesCardProps) {
  const { t } = useI18n();
  const isMine = series.high.coachId === humanId || series.low?.coachId === humanId;

  const row = (seed: Seed | null, wins: number) => {
    if (!seed) {
      return (
        <div className={styles.seriesRow}>
          <span className="muted">{t.tournament.byeLabel}</span>
        </div>
      );
    }
    const won = played && series.winnerId === seed.coachId;
    return (
      <div className={`${styles.seriesRow} ${won ? styles.seriesWinner : ''}`}>
        <span className={styles.seed}>{seed.seed}</span>
        <span className={styles.seriesName}>{names[seed.coachId]}</span>
        {played && series.low && <strong>{wins}</strong>}
      </div>
    );
  };

  return (
    <div className={`${styles.seriesCard} ${isMine ? styles.seriesMine : ''}`}>
      {row(series.high, series.highWins)}
      {row(series.low, series.lowWins)}
    </div>
  );
}
