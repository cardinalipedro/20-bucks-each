'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/presentation/i18n/I18nProvider';
import type { Player } from '@/domain/auction/types';
import type { GameResult } from '@/domain/simulation/types';
import styles from './Tournament.module.css';

const PERIOD_REVEAL_MS = 800;

interface LiveGameProps {
  game: GameResult;
  names: Record<string, string>;
  players: Record<string, Player>;
  /** Reveal the game quarter by quarter instead of showing the final score. */
  animate: boolean;
  label?: string;
  /** Called once the final score is on screen. */
  onDone?: () => void;
}

export function LiveGame({ game, names, players, animate, label, onDone }: LiveGameProps) {
  const { t } = useI18n();
  const total = game.periods.length;
  const [revealed, setRevealed] = useState(animate ? 0 : total);

  useEffect(() => {
    if (revealed >= total) {
      onDone?.();
      return;
    }
    const id = window.setTimeout(() => setRevealed((count) => count + 1), PERIOD_REVEAL_MS);
    return () => window.clearTimeout(id);
  }, [revealed, total, onDone]);

  const shown = game.periods.slice(0, revealed);
  const homeScore = shown.reduce((sum, [home]) => sum + home, 0);
  const awayScore = shown.reduce((sum, [, away]) => sum + away, 0);
  const isFinal = revealed >= total;

  const topScorer = (coachId: string) => {
    const best = [...game.box[coachId]].sort((a, b) => b.points - a.points)[0];
    return `${players[best.playerId].name} ${best.points} pts · ${best.rebounds} reb · ${best.assists} ast`;
  };

  const sideClass = (coachId: string) =>
    isFinal && game.winnerId === coachId ? `${styles.liveScore} ${styles.winner}` : styles.liveScore;

  return (
    <div className={`card ${styles.liveGame}`}>
      <div className={styles.liveHead}>
        <span className="eyebrow">{label}</span>
        <span className={isFinal ? styles.statusFinal : styles.statusLive}>
          {isFinal ? t.tournament.final : `${t.tournament.live} · ${t.tournament.period(Math.max(1, revealed + 1))}`}
        </span>
      </div>

      <div className={styles.liveScoreboard} aria-live="polite">
        <div className={styles.liveTeam}>
          <span className={styles.liveName}>{names[game.homeId]}</span>
          <span className={`display ${sideClass(game.homeId)}`}>{homeScore}</span>
        </div>
        <span className="muted">×</span>
        <div className={styles.liveTeam}>
          <span className={styles.liveName}>{names[game.awayId]}</span>
          <span className={`display ${sideClass(game.awayId)}`}>{awayScore}</span>
        </div>
      </div>

      <table className={styles.periods}>
        <thead>
          <tr>
            <th scope="col" />
            {game.periods.map((_, index) => (
              <th key={index} scope="col">
                {t.tournament.period(index + 1)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[game.homeId, game.awayId].map((coachId, side) => (
            <tr key={coachId}>
              <th scope="row">{names[coachId]}</th>
              {game.periods.map((period, index) => (
                <td key={index}>{index < revealed ? period[side] : '–'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {isFinal && (
        <div className={styles.topScorers}>
          <span>{topScorer(game.homeId)}</span>
          <span>{topScorer(game.awayId)}</span>
        </div>
      )}
    </div>
  );
}
