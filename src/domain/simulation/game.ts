import type { Rng } from '@/domain/shared/rng';
import type { Coach, Player } from '@/domain/auction/types';
import { allocate } from './allocate';
import { buildBoxScore } from './boxScore';
import { gameEvents } from './events';
import { inverseNormalCdf, normal, winProbability } from './probability';
import { PACE_POINTS, type OffenseStyle, type Pace } from './tactics';
import type { GameResult } from './types';

export { allocate };

const MARGIN_SPREAD = 12;
const BASE_TOTAL_POINTS = 224;
const TOTAL_POINTS_SPREAD = 14;

interface GameContext {
  players: Record<string, Player>;
  ratings: Record<string, number>;
  /** Faster games have more points; missing = normal pace. */
  paces?: Record<string, Pace>;
  /** Offensive style per team: shapes the shot mix (e.g. more threes). */
  offenses?: Record<string, OffenseStyle>;
}

/**
 * Simulates one game. The winner follows `winProbability` (65% strength,
 * 35% luck); the score, quarters and box score are generated around it.
 */
export function simulateGame(
  home: Coach,
  away: Coach,
  { players, ratings, paces = {}, offenses = {} }: GameContext,
  rng: Rng,
): GameResult {
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

  const box = {
    [home.id]: buildBoxScore(home, periods.map(([h]) => h), players, offenses[home.id] ?? 'balanced', rng),
    [away.id]: buildBoxScore(away, periods.map(([, a]) => a), players, offenses[away.id] ?? 'balanced', rng),
  };
  const game = {
    homeId: home.id,
    awayId: away.id,
    homeScore: homeRegulation,
    awayScore: awayRegulation,
    periods,
    winnerId: homeRegulation > awayRegulation ? home.id : away.id,
    box,
  };
  return { ...game, events: gameEvents(game) };
}

function splitIntoQuarters(points: number, rng: Rng): number[] {
  const weights = [0, 1, 2, 3].map(() => Math.max(0.6, 1 + 0.12 * normal(rng)));
  return allocate(points, weights);
}

function zip(a: number[], b: number[]): Array<[number, number]> {
  return a.map((value, index) => [value, b[index]]);
}
