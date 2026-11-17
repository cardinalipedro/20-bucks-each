import type { Coach, Player, PlayerRatings } from '@/domain/auction/types';

export const OFFENSE_STYLES = ['balanced', 'threes', 'paint'] as const;
export const PACES = ['slow', 'normal', 'fast'] as const;

export type OffenseStyle = (typeof OFFENSE_STYLES)[number];
export type Pace = (typeof PACES)[number];

export interface Tactic {
  offense: OffenseStyle;
  pace: Pace;
}

export const DEFAULT_TACTIC: Tactic = { offense: 'balanced', pace: 'normal' };

/**
 * Median starter averages of auctioned teams. A style helps a team that is
 * above the median in what the style needs, and hurts one that is below it.
 */
const BASELINE = {
  shooting: 80.4,
  paint: 77.4,
  athleticism: 81.8,
  playmaking: 76,
};
/** Rating points gained per attribute point above the baseline. */
const FIT_FACTOR = 0.6;
const MAX_PART_BONUS = 3;
const MAX_TOTAL_BONUS = 4;

/** Points per team added to (fast) or removed from (slow) a game's score. */
export const PACE_POINTS: Record<Pace, number> = { slow: -10, normal: 0, fast: 10 };

export interface TeamProfile {
  shooting: number;
  paint: number;
  athleticism: number;
  playmaking: number;
}

/** Averages of the starters in the attributes that tactics care about. */
export function teamProfile(coach: Coach, players: Record<string, Player>): TeamProfile {
  const starters = coach.roster
    .filter((slot) => slot.kind !== 'BENCH' && slot.playerId)
    .map((slot) => players[slot.playerId!]);
  const average = (key: keyof PlayerRatings) =>
    starters.reduce((sum, player) => sum + player.ratings[key], 0) / Math.max(1, starters.length);

  return {
    shooting: average('shooting'),
    paint: (average('finishing') + average('rebounding')) / 2,
    athleticism: average('athleticism'),
    playmaking: average('playmaking'),
  };
}

function fit(value: number, baseline: number): number {
  const bonus = (value - baseline) * FIT_FACTOR;
  return Math.max(-MAX_PART_BONUS, Math.min(MAX_PART_BONUS, bonus));
}

export function offenseBonus(profile: TeamProfile, offense: OffenseStyle): number {
  if (offense === 'threes') return fit(profile.shooting, BASELINE.shooting);
  if (offense === 'paint') return fit(profile.paint, BASELINE.paint);
  return 0;
}

export function paceBonus(profile: TeamProfile, pace: Pace): number {
  // Running needs athletes; slowing down needs players who run the offense.
  if (pace === 'fast') return fit(profile.athleticism, BASELINE.athleticism);
  if (pace === 'slow') return fit(profile.playmaking, BASELINE.playmaking);
  return 0;
}

/** Rating points a tactic adds to (or removes from) a team. */
export function tacticBonus(profile: TeamProfile, tactic: Tactic): number {
  const total = offenseBonus(profile, tactic.offense) + paceBonus(profile, tactic.pace);
  return Math.round(Math.max(-MAX_TOTAL_BONUS, Math.min(MAX_TOTAL_BONUS, total)) * 10) / 10;
}

/** The tactic that suits a roster best (what bots and away players use). */
export function bestTactic(profile: TeamProfile): Tactic {
  const offense = [...OFFENSE_STYLES].sort((a, b) => offenseBonus(profile, b) - offenseBonus(profile, a))[0];
  const pace = [...PACES].sort((a, b) => paceBonus(profile, b) - paceBonus(profile, a))[0];
  return { offense, pace };
}

export type FitLevel = 'great' | 'good' | 'neutral' | 'poor' | 'bad';

/** Label shown next to each option, so players can read the fit at a glance. */
export function fitLevel(bonus: number): FitLevel {
  if (bonus >= 1.5) return 'great';
  if (bonus >= 0.5) return 'good';
  if (bonus > -0.5) return 'neutral';
  if (bonus > -1.5) return 'poor';
  return 'bad';
}

export function isTactic(value: unknown): value is Tactic {
  if (!value || typeof value !== 'object') return false;
  const { offense, pace } = value as Record<string, unknown>;
  return (OFFENSE_STYLES as readonly unknown[]).includes(offense) && (PACES as readonly unknown[]).includes(pace);
}
