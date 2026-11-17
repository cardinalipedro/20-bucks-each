'use client';

import { useState } from 'react';
import { useI18n } from '@/presentation/i18n/I18nProvider';
import type { Player } from '@/domain/auction/types';
import type { PlayoffRound, Seed, Series } from '@/domain/simulation/types';
import { Modal } from '@/presentation/components/Modal';
import { SeriesDetails } from './GameDetails';
import styles from './Tournament.module.css';

interface BracketProps {
  rounds: PlayoffRound[];
  /** How many rounds have been played (their results are visible). */
  revealed: number;
  /** Whether the matchups of round `revealed` are already known. */
  nextKnown: boolean;
  names: Record<string, string>;
  players: Record<string, Player>;
  humanId: string;
}

export function Bracket({ rounds, revealed, nextKnown, names, players, humanId }: BracketProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState<Series | null>(null);

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
                <SeriesCard
                  key={seriesIndex}
                  series={series}
                  played={played}
                  names={names}
                  humanId={humanId}
                  onOpen={() => setOpen(series)}
                />
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

      {open && open.low && (
        <Modal title={t.tournament.seriesTitle(names[open.high.coachId], names[open.low.coachId])} onClose={() => setOpen(null)} wide>
          <SeriesDetails series={open} names={names} players={players} />
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
  played: boolean;
  names: Record<string, string>;
  humanId: string;
  onOpen: () => void;
}

function SeriesCard({ series, played, names, humanId, onOpen }: SeriesCardProps) {
  const { t } = useI18n();
  const isMine = series.high.coachId === humanId || series.low?.coachId === humanId;

  const row = (seed: Seed | null, wins: number) => {
    if (!seed) {
      return (
        <span className={styles.seriesRow}>
          <span className="muted">{t.tournament.byeLabel}</span>
        </span>
      );
    }
    const won = played && series.winnerId === seed.coachId;
    return (
      <span className={`${styles.seriesRow} ${won ? styles.seriesWinner : ''}`}>
        <span className={styles.seed}>{seed.seed}</span>
        <span className={styles.seriesName}>{names[seed.coachId]}</span>
        {played && series.low && <strong>{wins}</strong>}
      </span>
    );
  };

  const className = `${styles.seriesCard} ${isMine ? styles.seriesMine : ''}`;
  // Played series open their games and leaders; the rest are plain cards.
  if (played && series.low && series.games.length > 0) {
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
