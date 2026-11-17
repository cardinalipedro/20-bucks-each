import type { AuctionState } from '../auction/types';
import type { Tournament, TournamentFormat, TournamentSettings } from '../sim/types';

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
  tournament: TournamentSettings;
}

export type Visibility = 'public' | 'private';

export interface RoomSettings extends MatchSettings {
  visibility: Visibility;
}

export type RoomPhase = 'lobby' | 'auction' | 'tournament';

export type RoomError = 'not_found' | 'full' | 'started' | 'not_host' | 'not_enough_players' | 'too_many_members' | 'invalid';

export type Result<T> = ({ ok: true } & T) | { ok: false; error: RoomError };

/** What every client sees about a member (never the secret token). */
export interface MemberView {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
  away: boolean;
  left: boolean;
  coachId: string | null;
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
  tournament: Tournament | null;
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
  tournament: { format: 'seasonAndPlayoffs', playoffTeams: 4, seriesLength: 3 },
};
