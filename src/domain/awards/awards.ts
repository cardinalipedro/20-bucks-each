import type { AuctionState, Coach, LotResult } from '@/domain/auction/types';
import { teamRating } from '@/domain/simulation/strength';

/** Overall points above a replacement-level player (75) per dollar spent. */
const REPLACEMENT_OVERALL = 75;

export function amountSpent(coach: Coach, state: AuctionState): number {
  return state.settings.startingCash - coach.cash;
}

function efficiency(coach: Coach, state: AuctionState): number {
  const value = coach.roster.reduce(
    (sum, slot) => sum + (slot.playerId ? Math.max(0, state.players[slot.playerId].overall - REPLACEMENT_OVERALL) : 0),
    0,
  );
  return value / Math.max(1, amountSpent(coach, state));
}

/** Coach who got the most quality per dollar. */
export function bestGm(state: AuctionState): Coach {
  return [...state.coaches].sort((a, b) => efficiency(b, state) - efficiency(a, state))[0];
}

/** Most expensive player of the auction, if anyone paid for one. */
export function biggestBuy(state: AuctionState): LotResult | undefined {
  return [...state.history].filter((result) => result.winnerId).sort((a, b) => b.price - a.price)[0];
}

export function rankByRating(state: AuctionState): Coach[] {
  return [...state.coaches].sort((a, b) => teamRating(b, state.players) - teamRating(a, state.players));
}
