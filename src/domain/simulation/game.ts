import type { Rng } from '@/domain/shared/rng';
import type { Coach, Player } from '@/domain/auction/types';
import { inverseNormalCdf, normal, winProbability } from './probability';
import { PACE_POINTS, type Pace } from './tactics';
import type { GameResult, PlayerLine } from './types';

const MARGIN_SPREAD = 12;
const BASE_TOTAL_POINTS = 224;
const TOTAL_POINTS_SPREAD = 14;
const BASE_REBOUNDS = 44;
const ASSIST_RATE = 0.24;
const BENCH_MINUTES = 0.35;

interface GameContext {
  players: Record<string, Player>;
  ratings: Record<string, number>;
  /** Faster games have more points; missing = normal pace. */
  paces?: Record<string, Pace>;
}

/**
 * Simulates one game. The winner follows `winProbability` (65% strength,
 * 35% luck); the score, quarters and box score are generated around it.
 */
export function simulateGame(home: Coach, away: Coach, { players, ratings, paces = {} }: GameContext, rng: Rng): GameResult {
  const homeRating = ratings[home.id];
  const awayRating = ratings[away.id];
  const p = winProbability(homeRating, awayRating);

  // Margin ~ Normal(mean, spread) with the mean chosen so that P(margin > 0) = p.
  const margin = MARGIN_SPREAD * inverseNormalCdf(p) + MARGIN_SPREAD * normal(rng);
  const paceShift = PACE_POINTS[paces[home.id] ?? 'normal'] + PACE_POINTS[paces[away.id] ?? 'normal'];
  const total =
    BASE_TOTAL_POINTS + paceShift + ((homeRating + awayRating) / 2 - 85) + TOTAL_POINTS_SPREAD * normal(rng);

  let homeRegulation = Math.round((total + margin) / 2);
  let awayRegulation = Math.round((total - margin) / 2);
  const homeWins = margin > 0 || (margin === 0 && rng.next() < p);

  const periods: Array<[number, number]> = zip(splitIntoQuarters(homeRegulation, rng), splitIntoQuarters(awayRegulation, rng));

  if (homeRegulation === awayRegulation) {
    const base = 6 + Math.floor(rng.next() * 8);
    const edge = 1 + Math.floor(rng.next() * 5);
    const overtime: [number, number] = homeWins ? [base + edge, base] : [base, base + edge];
    periods.push(overtime);
    homeRegulation += overtime[0];
    awayRegulation += overtime[1];
  } else if (homeRegulation > awayRegulation !== homeWins) {
    // Rounding flipped a tiny margin: keep the sampled winner.
    [homeRegulation, awayRegulation] = [awayRegulation, homeRegulation];
    for (const period of periods) period.reverse();
  }

  return {
    homeId: home.id,
    awayId: away.id,
    homeScore: homeRegulation,
    awayScore: awayRegulation,
    periods,
    winnerId: homeRegulation > awayRegulation ? home.id : away.id,
    box: {
      [home.id]: boxScore(home, homeRegulation, players, rng),
      [away.id]: boxScore(away, awayRegulation, players, rng),
    },
  };
}

function splitIntoQuarters(points: number, rng: Rng): number[] {
  const weights = [0, 1, 2, 3].map(() => Math.max(0.6, 1 + 0.12 * normal(rng)));
  return allocate(points, weights);
}

function zip(a: number[], b: number[]): Array<[number, number]> {
  return a.map((value, index) => [value, b[index]]);
}

/** Splits team totals among the players, weighted by their ratings plus randomness. */
function boxScore(coach: Coach, points: number, players: Record<string, Player>, rng: Rng): PlayerLine[] {
  const roster = coach.roster
    .filter((slot) => slot.playerId)
    .map((slot) => ({ player: players[slot.playerId!], minutes: slot.kind === 'BENCH' ? BENCH_MINUTES : 1 }));

  const weight = (rating: number, power: number, minutes: number) =>
    minutes * Math.pow(rating / 100, power) * (0.7 + 0.6 * rng.next());

  const rebounds = Math.max(25, Math.round(BASE_REBOUNDS + 4 * normal(rng)));
  const assists = Math.round(points * ASSIST_RATE);

  const pointShares = allocate(
    points,
    roster.map(({ player, minutes }) => weight((player.ratings.shooting + player.ratings.finishing) / 2, 3, minutes)),
  );
  const reboundShares = allocate(
    rebounds,
    roster.map(({ player, minutes }) => weight(player.ratings.rebounding, 3, minutes)),
  );
  const assistShares = allocate(
    assists,
    roster.map(({ player, minutes }) => weight(player.ratings.playmaking, 4, minutes)),
  );

  return roster.map(({ player }, index) => ({
    playerId: player.id,
    points: pointShares[index],
    rebounds: reboundShares[index],
    assists: assistShares[index],
  }));
}

/** Splits an integer total by weights, keeping the exact sum (largest remainder). */
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (w / sum) * total);
  const result = raw.map(Math.floor);
  let remainder = total - result.reduce((a, b) => a + b, 0);
  const order = raw.map((value, index) => ({ index, fraction: value - Math.floor(value) })).sort((a, b) => b.fraction - a.fraction);
  for (const { index } of order) {
    if (remainder <= 0) break;
    result[index] += 1;
    remainder -= 1;
  }
  return result;
}
