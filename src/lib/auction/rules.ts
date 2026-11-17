import { playablePositions } from './positions';
import { POSITIONS, type AuctionSettings, type Coach, type Lot, type Player, type RosterSlot } from './types';

export const MIN_BID = 1;

/** A bid in the final seconds pushes the clock back up to this many seconds. */
export const BID_EXTENSION_SECONDS = 3;

export function createRoster(settings: AuctionSettings): RosterSlot[] {
  const starters: RosterSlot[] = POSITIONS.map((kind) => ({ kind, playerId: null, price: 0 }));
  const bench: RosterSlot[] = Array.from({ length: settings.benchSize }, () => ({
    kind: 'BENCH',
    playerId: null,
    price: 0,
  }));
  return [...starters, ...bench];
}

export function emptySlotCount(coach: Coach): number {
  return coach.roster.filter((slot) => slot.playerId === null).length;
}

export function isRosterFull(coach: Coach): boolean {
  return emptySlotCount(coach) === 0;
}

/**
 * Index of the slot this player would take, or -1.
 * Natural positions first, then a neighboring position (played with a
 * penalty), then the bench.
 */
export function findSlotFor(coach: Coach, player: Player): number {
  for (const position of playablePositions(player)) {
    const index = coach.roster.findIndex((slot) => slot.playerId === null && slot.kind === position);
    if (index !== -1) return index;
  }
  return coach.roster.findIndex((slot) => slot.playerId === null && slot.kind === 'BENCH');
}

/** Highest bid allowed so the coach can still pay $1 for every other empty slot. */
export function maxBid(coach: Coach): number {
  const empty = emptySlotCount(coach);
  if (empty === 0) return 0;
  return coach.cash - (empty - 1) * MIN_BID;
}

export function topBid(lot: Lot) {
  return lot.bids.length > 0 ? lot.bids[lot.bids.length - 1] : null;
}

export function minNextBid(lot: Lot): number {
  const top = topBid(lot);
  return top ? top.amount + 1 : MIN_BID;
}

export function canBidOn(coach: Coach, player: Player, lot: Lot): boolean {
  return findSlotFor(coach, player) !== -1 && maxBid(coach) >= minNextBid(lot);
}
