import { shuffle, type Rng } from './rng';
import { POSITIONS, type AuctionSettings, type Player } from './types';

/**
 * How many players go to auction compared to the number of open slots.
 * A small surplus keeps the auction competitive: waiting for a better player
 * is a gamble, because the pool runs out.
 */
export const POOL_FACTOR = 1.3;

/**
 * Picks a random, limited set of players for one auction. Every position gets
 * enough players (by primary position) for each coach, plus a surplus.
 * Returns player ids in auction order.
 */
export function buildPool(players: Player[], coachCount: number, settings: AuctionSettings, rng: Rng): string[] {
  const perPosition = Math.ceil(coachCount * POOL_FACTOR);
  const totalSlots = (POSITIONS.length + settings.benchSize) * coachCount;
  const target = Math.min(players.length, Math.ceil(totalSlots * POOL_FACTOR));

  const picked = new Set<string>();
  for (const position of POSITIONS) {
    const candidates = shuffle(
      players.filter((p) => p.positions[0] === position),
      rng,
    );
    candidates.slice(0, perPosition).forEach((p) => picked.add(p.id));
  }

  const rest = shuffle(
    players.filter((p) => !picked.has(p.id)),
    rng,
  );
  for (const player of rest) {
    if (picked.size >= target) break;
    picked.add(player.id);
  }

  return shuffle([...picked], rng);
}
