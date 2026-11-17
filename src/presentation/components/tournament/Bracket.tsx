'use client';

import { useState } from 'react';
import { useI18n } from '@/presentation/i18n/I18nProvider';
import type { Player } from '@/domain/auction/types';
import type { PlayoffRound, Seed, Series } from '@/domain/simulation/types';
import { Modal } from '@/presentation/components/Modal';
import { SeriesDetails } from './GameDetails';
import styles from './Tournament.module.css';

interface BracketProps {
  /** Rounds known so far; the last one may still be in progress. */
  rounds: PlayoffRound[];
  names: Record<string, string>;
  players: Record<string, Player>;
  humanId: string;
}

export function Bracket({ rounds, names, players, humanId }: BracketProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState<{ round: number; series: number } | null>(null);
  // The first round fixes the bracket size, so later rounds can be drawn before they exist.
  const totalRounds = rounds.length === 0 ? 0 : Math.log2(rounds[0].series.length * 2);
  const openSeries = open ? rounds[open.round]?.series[open.series] : null;

  return (
    <div className={styles.bracket}>
      {Array.from({ length: totalRounds }, (_, index) => {
        const seriesCount = rounds[0].series.length / 2 ** index;
        const round = rounds[index];
        return (
          <section key={index} className={styles.bracketRound} aria-label={t.tournament.playoffRoundName(seriesCount)}>
            <h3 className="eyebrow">{t.tournament.playoffRoundName(seriesCount)}</h3>
            {round
              ? round.series.map((series, seriesIndex) => (
                  <SeriesCard
                    key={seriesIndex}
                    series={series}
                    names={names}
                    humanId={humanId}
                    onOpen={() => setOpen({ round: index, series: seriesIndex })}
                  />
                ))
              : Array.from({ length: seriesCount }, (_, seriesIndex) => (
                  <div key={seriesIndex} className={styles.seriesCard}>
                    <div className={styles.seriesRow}>
                      <span className="muted">{t.tournament.tbd}</span>
                    </div>
                    <div className={styles.seriesRow}>
                      <span className="muted">{t.tournament.tbd}</span>
                    </div>
                  </div>
                ))}
          </section>
        );
      })}

      {openSeries?.low && (
        <Modal
          title={t.tournament.seriesTitle(names[openSeries.high.coachId], names[openSeries.low.coachId])}
          onClose={() => setOpen(null)}
          wide
        >
          <SeriesDetails series={openSeries} names={names} players={players} />
          <div className={styles.modalActions}>
            <button type="button" className="btn" onClick={() => setOpen(null)}>
              {t.tournament.close}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

interface SeriesCardProps {
  series: Series;
  names: Record<string, string>;
  humanId: string;
  onOpen: () => void;
}

function SeriesCard({ series, names, humanId, onOpen }: SeriesCardProps) {
  const { t } = useI18n();
  const isMine = series.high.coachId === humanId || series.low?.coachId === humanId;
  const started = series.games.length > 0;

  const row = (seed: Seed | null, wins: number) => {
    if (!seed) {
      return (
        <span className={styles.seriesRow}>
          <span className="muted">{t.tournament.byeLabel}</span>
        </span>
      );
    }
    const won = series.low !== null && series.winnerId === seed.coachId;
    return (
      <span className={`${styles.seriesRow} ${won ? styles.seriesWinner : ''}`}>
        <span className={styles.seed}>{seed.seed}</span>
        <span className={styles.seriesName}>{names[seed.coachId]}</span>
        {started && <strong>{wins}</strong>}
      </span>
    );
  };

  const className = `${styles.seriesCard} ${isMine ? styles.seriesMine : ''}`;
  // Series with games played (finished or not) open their games and leaders.
  if (series.low && started) {
    return (
      <button
        type="button"
        className={`${className} ${styles.seriesButton}`}
        aria-label={t.tournament.viewSeries(names[series.high.coachId], names[series.low.coachId])}
        onClick={onOpen}
      >
        {row(series.high, series.highWins)}
        {row(series.low, series.lowWins)}
      </button>
    );
  }
  return (
    <div className={className}>
      {row(series.high, series.highWins)}
      {row(series.low, series.lowWins)}
    </div>
  );
}
