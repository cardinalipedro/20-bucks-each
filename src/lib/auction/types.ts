export const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'] as const;

export type Position = (typeof POSITIONS)[number];

export type SlotKind = Position | 'BENCH';

export interface PlayerRatings {
  shooting: number;
  finishing: number;
  playmaking: number;
  defense: number;
  rebounding: number;
  athleticism: number;
}

export interface Player {
  id: string;
  name: string;
  /** First entry is the primary position. */
  positions: Position[];
  overall: number;
  ratings: PlayerRatings;
}

export interface RosterSlot {
  kind: SlotKind;
  playerId: string | null;
  price: number;
}

export interface Coach {
  id: string;
  name: string;
  isBot: boolean;
  cash: number;
  roster: RosterSlot[];
  /** Bots only: multiplies how much they are willing to pay (1 = neutral). */
  aggressiveness: number;
  /** A human who left the match and is now played by a bot. */
  replacedByBot?: boolean;
}

export interface AuctionSettings {
  startingCash: number;
  benchSize: 0 | 2;
  /** Clock for each player. Bids never reset it, they only extend the final seconds. */
  bidSeconds: number;
}

export interface Bid {
  coachId: string;
  amount: number;
  at: number;
}

export interface Lot {
  playerId: string;
  bids: Bid[];
  deadline: number;
  /** Coaches that are out of this lot (passed or cannot bid). */
  passed: string[];
}

export interface LotResult {
  playerId: string;
  winnerId: string | null;
  price: number;
}

export type AuctionPhase = 'running' | 'finished';

export interface AuctionState {
  settings: AuctionSettings;
  players: Record<string, Player>;
  coaches: Coach[];
  queue: string[];
  lot: Lot | null;
  unsold: string[];
  history: LotResult[];
  /** Timestamp at which each bot will act next (Infinity = waiting). */
  botPlans: Record<string, number>;
  phase: AuctionPhase;
  lotNumber: number;
  rngSeed: number;
}
