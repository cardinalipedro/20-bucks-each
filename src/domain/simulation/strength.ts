import { isNaturalPosition } from '@/domain/auction/positions';
import type { Coach, Player } from '@/domain/auction/types';

/** Rating lost for each starter playing out of position. */
const OUT_OF_POSITION_PENALTY = 3;
const BENCH_BASELINE = 75;
const BENCH_WEIGHT = 0.1;

/**
 * Team rating used by the simulation: average overall of the starters,
 * minus a penalty for players out of position, plus a small bench bonus.
 */
export function teamRating(coach: Coach, players: Record<string, Player>): number {
  const starters = coach.roster.filter((slot) => slot.kind !== 'BENCH');
  const bench = coach.roster.filter((slot) => slot.kind === 'BENCH' && slot.playerId);

  let total = 0;
  for (const slot of starters) {
    if (!slot.playerId) continue;
    const player = players[slot.playerId];
    const outOfPosition = !isNaturalPosition(player, slot.kind);
    total += player.overall - (outOfPosition ? OUT_OF_POSITION_PENALTY : 0);
  }
  const starterAverage = total / starters.length;

  const benchBonus =
    bench.length === 0
      ? 0
      : (bench.reduce((sum, slot) => sum + players[slot.playerId!].overall, 0) / bench.length - BENCH_BASELINE) *
        BENCH_WEIGHT;

  return Math.round((starterAverage + Math.max(0, benchBonus)) * 10) / 10;
}
