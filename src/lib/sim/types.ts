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
}

export interface GameResult {
  homeId: string;
  awayId: string;
  homeScore: number;
  awayScore: number;
  /** Points per quarter, [home, away]. Overtime is a 5th entry. */
  periods: Array<[number, number]>;
  winnerId: string;
  box: Record<string, PlayerLine[]>;
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
  winnerId: string;
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

export interface Tournament {
  settings: TournamentSettings;
  /** Team rating used by the simulation, per coach. */
  ratings: Record<string, number>;
  seasonRounds: SeasonRound[];
  finalStandings: Standing[];
  playoffRounds: PlayoffRound[];
  championId: string;
  mvp: PlayerSeasonStats | null;
}
