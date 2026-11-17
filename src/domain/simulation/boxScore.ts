import type { Coach, Player, Position } from '@/domain/auction/types';
import type { Rng } from '@/domain/shared/rng';
import { allocate } from './allocate';
import { normal } from './probability';
import type { OffenseStyle } from './tactics';
import type { PlayerLine } from './types';

const BENCH_MINUTES = 0.35;
const BASE_REBOUNDS = 44;
const ASSIST_RATE = 0.24;
const BASE_THREES = 11;
const BASE_STEALS = 7.5;
const BASE_BLOCKS = 5;

/** Extra made threes per game for each offensive style. */
const THREES_BY_STYLE: Record<OffenseStyle, number> = { balanced: 0, threes: 4, paint: -3 };

/** Rim protection by position: centers block far more shots than guards. */
const BLOCK_BY_POSITION: Record<Position, number> = { PG: 0.4, SG: 0.5, SF: 1, PF: 2, C: 3 };

interface Entry {
  player: Player;
  minutes: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Splits a team's points into a full, internally consistent box score:
 * made shots always add up to the points, attempts are never below makes,
 * and each player's points per period add up to the team's periods.
 */
export function buildBoxScore(
  coach: Coach,
  periodTotals: number[],
  players: Record<string, Player>,
  offense: OffenseStyle,
  rng: Rng,
): PlayerLine[] {
  const points = periodTotals.reduce((sum, value) => sum + value, 0);
  const roster: Entry[] = coach.roster
    .filter((slot) => slot.playerId)
    .map((slot) => ({ player: players[slot.playerId!], minutes: slot.kind === 'BENCH' ? BENCH_MINUTES : 1 }));

  const weight = (rating: number, power: number, minutes: number) =>
    minutes * Math.pow(rating / 100, power) * (0.7 + 0.6 * rng.next());
  const shares = (total: number, pick: (entry: Entry) => number, power: number) =>
    allocate(
      Math.max(0, total),
      roster.map((entry) => weight(pick(entry), power, entry.minutes)),
    );

  const pointShares = shares(points, ({ player }) => (player.ratings.shooting + player.ratings.finishing) / 2, 3);
  const reboundShares = shares(Math.max(25, Math.round(BASE_REBOUNDS + 4 * normal(rng))), ({ player }) => player.ratings.rebounding, 3);
  const assistShares = shares(Math.round(points * ASSIST_RATE), ({ player }) => player.ratings.playmaking, 4);
  const stealShares = shares(Math.round(clamp(BASE_STEALS + 2 * normal(rng), 2, 15)), ({ player }) => player.ratings.defense, 4);
  const blockShares = allocate(
    Math.round(clamp(BASE_BLOCKS + 2 * normal(rng), 0, 14)),
    roster.map(({ player, minutes }) => weight(player.ratings.defense, 3, minutes) * BLOCK_BY_POSITION[player.positions[0]]),
  );

  const teamShooting = roster.reduce((sum, { player }) => sum + player.ratings.shooting, 0) / roster.length;
  const threesTarget = Math.round(
    clamp(BASE_THREES + (teamShooting - 80) * 0.6 + THREES_BY_STYLE[offense] + 2 * normal(rng), 3, 24),
  );
  const threeShares = shares(threesTarget, ({ player }) => player.ratings.shooting, 5);

  const periodPoints = splitByPeriod(pointShares, periodTotals, rng);

  return roster.map(({ player }, index) => {
    const pts = pointShares[index];
    const threesMade = Math.min(threeShares[index], Math.floor(pts / 3));
    const rest = pts - 3 * threesMade;
    let freeThrowsMade = Math.min(rest, Math.round(rest * (0.12 + 0.1 * rng.next())));
    // Whatever is left must be two-pointers, so it has to be even.
    if ((rest - freeThrowsMade) % 2 === 1) freeThrowsMade += freeThrowsMade > 0 ? -1 : 1;
    const twosMade = (rest - freeThrowsMade) / 2;

    const threePct = clamp(0.3 + ((player.ratings.shooting - 70) / 30) * 0.12, 0.25, 0.45);
    const twoPct = clamp(0.45 + ((player.ratings.finishing - 70) / 30) * 0.12, 0.4, 0.62);
    const threesAttempted = threesMade + Math.round((threesMade / threePct - threesMade) * (0.8 + 0.4 * rng.next())) + (threesMade === 0 && pts > 0 ? Math.round(rng.next() * 3) : 0);
    const twosAttempted = twosMade + Math.round((twosMade / twoPct - twosMade) * (0.8 + 0.4 * rng.next()));
    const freeThrowsAttempted = freeThrowsMade + Math.round(freeThrowsMade * (0.1 + 0.25 * rng.next()));

    return {
      playerId: player.id,
      points: pts,
      rebounds: reboundShares[index],
      assists: assistShares[index],
      steals: stealShares[index],
      blocks: blockShares[index],
      fieldGoalsMade: twosMade + threesMade,
      fieldGoalsAttempted: twosAttempted + threesAttempted,
      threesMade,
      threesAttempted,
      freeThrowsMade,
      freeThrowsAttempted,
      periodPoints: periodPoints[index],
    };
  });
}

/**
 * Spreads each player's points over the periods so that rows add up to the
 * player's total and columns add up to the team's period scores.
 */
function splitByPeriod(playerTotals: number[], periodTotals: number[], rng: Rng): number[][] {
  const remaining = [...playerTotals];
  const rows = playerTotals.map(() => [] as number[]);

  periodTotals.forEach((periodTotal, period) => {
    const isLast = period === periodTotals.length - 1;
    const column = isLast ? [...remaining] : allocateCapped(periodTotal, remaining, rng);
    column.forEach((value, index) => {
      rows[index].push(value);
      remaining[index] -= value;
    });
  });
  return rows;
}

/**
 * Like allocate, weighted by what each player still has to score (with some
 * randomness, so hot and cold quarters happen), never giving anyone more
 * than they have left.
 */
function allocateCapped(total: number, caps: number[], rng: Rng): number[] {
  const available = caps.reduce((sum, cap) => sum + cap, 0);
  if (available === 0) return caps.map(() => 0);
  const column = allocate(
    Math.min(total, available),
    caps.map((cap) => cap * (0.5 + rng.next())),
  );
  // Move any excess to whoever still has the most points left to score.
  for (let index = 0; index < column.length; index++) {
    while (column[index] > caps[index]) {
      const target = column.reduce((best, value, i) => (caps[i] - value > caps[best] - column[best] ? i : best), 0);
      column[index] -= 1;
      column[target] += 1;
    }
  }
  return column;
}
