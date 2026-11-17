import type { AuctionState } from '@/domain/auction/types';
import type { Tactic } from '@/domain/simulation/tactics';
import type { TournamentFormat, TournamentSettings, TournamentView } from '@/domain/simulation/types';

export const MIN_COACHES = 2;
export const MAX_COACHES = 16;
export const MAX_NAME_LENGTH = 20;

/** Match rules shared by solo games and rooms. */
export interface MatchSettings {
  maxCoaches: number;
  /** Rooms only: empty seats are filled with bots when the match starts. */
  fillWithBots: boolean;
  benchSize: 0 | 2;
  bidSeconds: number;
  /** Hide overall and attributes during the auction. */
  hideOverall: boolean;
  tournament: TournamentSettings;
}

export type Visibility = 'public' | 'private';

export interface RoomSettings extends MatchSettings {
  visibility: Visibility;
}

export type RoomPhase = 'lobby' | 'auction' | 'tactics' | 'tournament';

export type RoomError =
  | 'not_found'
  | 'full'
  | 'started'
  | 'not_host'
  | 'not_enough_players'
  | 'not_ready'
  | 'too_many_members'
  | 'kicked'
  | 'invalid';

export type Result<T> = ({ ok: true } & T) | { ok: false; error: RoomError };

/** What every client sees about a member (never the secret token). */
export interface MemberView {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
  /** Lobby: idle (a bot marked them ready). Match: a bot is playing for them. */
  away: boolean;
  ready: boolean;
  left: boolean;
  coachId: string | null;
}

export interface TacticChoice {
  tactic: Tactic;
  confirmed: boolean;
}

/**
 * Shared playback of the simulated competition. Step 0 is the auction
 * results, then one step per season round and playoff round, and the last
 * step is the awards. Everyone moves on together.
 */
export interface RevealView {
  /** Steps played so far (0 = still on the auction results). */
  step: number;
  /** The competition is over and the awards are on screen. */
  awards: boolean;
  /** The step's live games are still playing until then: no countdown yet. */
  playingUntil: number;
  /** When the room moves on even if not everyone is ready (null on the awards). */
  deadline: number | null;
  youReady: boolean;
  readyCount: number;
  total: number;
}

/** Tactics phase as each client sees it: your own choice, and only who has confirmed. */
export interface TacticsView {
  /** Only during the tactics phase; between games there is no deadline. */
  deadline: number | null;
  yours: TacticChoice | null;
  confirmed: Record<string, boolean>;
}

/**
 * Auction state as sent to clients: no player database (clients have it),
 * and the upcoming queue is hidden on purpose, only its size is sent.
 */
export type AuctionView = Omit<AuctionState, 'players' | 'queue' | 'botPlans' | 'rngSeed'> & { queueLength: number };

export interface RoomView {
  code: string;
  phase: RoomPhase;
  settings: RoomSettings;
  members: MemberView[];
  youId: string;
  auction: AuctionView | null;
  tactics: TacticsView | null;
  /** Without the random state: nobody can predict the next game. */
  tournament: TournamentView | null;
  reveal: RevealView | null;
  /** Server clock when this view was sent, to sync timers. */
  serverNow: number;
}

export interface PublicRoomSummary {
  code: string;
  hostName: string;
  members: number;
  maxCoaches: number;
  format: TournamentFormat;
  benchSize: 0 | 2;
}

export const DEFAULT_MATCH_SETTINGS: MatchSettings = {
  maxCoaches: 8,
  fillWithBots: true,
  benchSize: 0,
  bidSeconds: 15,
  hideOverall: false,
  tournament: { format: 'seasonAndPlayoffs', playoffTeams: 4, seriesLength: 3 },
};
