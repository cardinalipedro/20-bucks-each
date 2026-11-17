import type { Tactic } from './tactics';

export type TournamentFormat = 'seasonAndPlayoffs' | 'seasonOnly' | 'playoffsOnly';

export interface TournamentSettings {
  format: TournamentFormat;
  /** How many teams reach the playoffs after a regular season. */
  playoffTeams: 4 | 8;
  /** Games per playoff series (best of N). */
  seriesLength: 1 | 3 | 7;
}

export interface PlayerLine {
  playerId: string;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  threesMade: number;
  threesAttempted: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
  /** Points scored in each period (same length as GameResult.periods). */
  periodPoints: number[];
}

/** A moment worth telling, revealed when its period is played. */
export type GameEvent =
  | { kind: 'hotPeriod'; period: number; coachId: string; playerId: string; points: number }
  | { kind: 'bigPeriod'; period: number; coachId: string; margin: number }
  | { kind: 'leadChange'; period: number; coachId: string; score: [number, number] }
  | { kind: 'overtime'; period: number; score: [number, number] }
  | { kind: 'comeback'; period: number; coachId: string; deficit: number }
  | { kind: 'closeFinish'; period: number; coachId: string; margin: number }
  | { kind: 'blowout'; period: number; coachId: string; margin: number }
  | { kind: 'gameHigh'; period: number; coachId: string; playerId: string; points: number; rebounds: number; assists: number };

export interface GameResult {
  homeId: string;
  awayId: string;
  homeScore: number;
  awayScore: number;
  /** Points per quarter, [home, away]. Overtime is a 5th entry. */
  periods: Array<[number, number]>;
  winnerId: string;
  box: Record<string, PlayerLine[]>;
  events: GameEvent[];
}

export interface SeasonRound {
  games: GameResult[];
  /** Team that sits out this round when the number of teams is odd. */
  byeId: string | null;
}

export interface Standing {
  coachId: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
}

export interface Seed {
  coachId: string;
  seed: number;
}

export interface Series {
  high: Seed;
  /** null = bye, the higher seed advances without playing. */
  low: Seed | null;
  games: GameResult[];
  highWins: number;
  lowWins: number;
  /** null while the series is still being played. */
  winnerId: string | null;
}

export interface PlayoffRound {
  series: Series[];
}

export interface PlayerSeasonStats {
  playerId: string;
  coachId: string;
  games: number;
  points: number;
  rebounds: number;
  assists: number;
}

/** A season round in the schedule, before it is played. */
export interface ScheduledRound {
  pairs: Array<[string, string]>;
  /** Team that sits out this round when the number of teams is odd. */
  byeId: string | null;
}

/** What one step of the competition played: a season round, or one game of every open playoff series. */
export type TournamentStep =
  | { kind: 'season'; round: number }
  | { kind: 'playoffs'; round: number; game: number };

/**
 * The competition as everyone may see it. It is played one step at a time, so
 * coaches can change their tactic and lineup between games.
 */
export interface TournamentView {
  settings: TournamentSettings;
  coachIds: string[];
  /** The full regular-season schedule (public from the start). */
  schedule: ScheduledRound[];
  /** Team rating used in the last step, per coach (roster + tactic). */
  ratings: Record<string, number>;
  /** Roster-only rating used in the last step, before the tactic. */
  baseRatings: Record<string, number>;
  /** Tactics used in the last step. */
  tactics: Record<string, Tactic>;
  /** Season rounds played so far. */
  seasonRounds: SeasonRound[];
  /** Current regular-season table (or seeding order without a season). */
  standings: Standing[];
  /** Playoff rounds known so far; the last one may still be in progress. */
  playoffRounds: PlayoffRound[];
  /** Every step played, in order. */
  steps: TournamentStep[];
  finished: boolean;
  championId: string | null;
  mvp: PlayerSeasonStats | null;
  /** Best player of the champion in the finals (null without playoffs). */
  finalsMvp: PlayerSeasonStats | null;
}

/** Full state, including the random generator: stays on the server so nobody can predict a game. */
export interface Tournament extends TournamentView {
  rngState: number;
}
