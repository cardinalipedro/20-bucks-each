'use client';

import { teamStrength } from '@/lib/auction/rules';
import type { AuctionState, Coach } from '@/lib/auction/types';
import { formatMoney, slotLabel } from '@/lib/format';
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
  const { startingCash } = state.settings;
  const ranked = [...state.coaches].sort((a, b) => teamStrength(b, state.players) - teamStrength(a, state.players));
  const bestGm = [...state.coaches].sort((a, b) => efficiency(b, state) - efficiency(a, state))[0];
  const biggestBuy = [...state.history].filter((r) => r.winnerId).sort((a, b) => b.price - a.price)[0];
  const coachName = (id: string) => state.coaches.find((coach) => coach.id === id)?.name ?? '?';

  return (
    <div className="container">
      <Header subtitle="Leilão encerrado">
        <button type="button" className="btn btn-primary" onClick={onRestart}>
          Jogar de novo
        </button>
      </Header>

      <h1 className={`display ${styles.title}`}>Os times estão fechados</h1>
      <p className={`muted ${styles.note}`}>
        Por enquanto o ranking é pela força do quinteto, que é a média dos overalls. A temporada e os playoffs
        simulados chegam na próxima etapa.
      </p>

      <div className={styles.awards}>
        <div className={`card ${styles.award}`}>
          <span className={styles.awardLabel}>TIME MAIS FORTE</span>
          <span className={`display ${styles.awardValue}`}>{ranked[0].name}</span>
          <span className="muted">Força {teamStrength(ranked[0], state.players)}</span>
        </div>
        <div className={`card ${styles.award}`}>
          <span className={styles.awardLabel}>MELHOR GM</span>
          <span className={`display ${styles.awardValue}`}>{bestGm.name}</span>
          <span className="muted">
            Gastou {formatMoney(spent(bestGm, startingCash))} e montou força {teamStrength(bestGm, state.players)}
          </span>
        </div>
        {biggestBuy && (
          <div className={`card ${styles.award}`}>
            <span className={`${styles.awardLabel} ${styles.warn}`}>MAIOR COMPRA</span>
            <span className={`display ${styles.awardValue}`}>{state.players[biggestBuy.playerId].name}</span>
            <span className="muted">
              {coachName(biggestBuy.winnerId!)} pagou {formatMoney(biggestBuy.price)}
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
                  {coach.name}
                  {coach.id === humanId && <span className={styles.youBadge}>VOCÊ</span>}
                </h2>
                <span className="muted">
                  Gastou {formatMoney(spent(coach, startingCash))} de {formatMoney(startingCash)}
                </span>
              </div>
              <span className={`display ${styles.strength}`}>{teamStrength(coach, state.players)}</span>
            </div>
            <ul className={styles.roster}>
              {coach.roster.map((slot, slotIndex) => {
                const player = slot.playerId ? state.players[slot.playerId] : null;
                return (
                  <li key={slotIndex} className={styles.rosterItem}>
                    <span className={styles.slotTag}>{slotLabel(slot.kind)}</span>
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
