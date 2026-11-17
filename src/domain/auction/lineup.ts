import { canPlaySlot } from './positions';
import type { AuctionState, Coach, Player } from './types';

/** Whether two roster slots can trade players (each must be allowed in the other's slot). */
export function canSwap(coach: Coach, a: number, b: number, players: Record<string, Player>): boolean {
  const slotA = coach.roster[a];
  const slotB = coach.roster[b];
  if (!slotA || !slotB || a === b) return false;
  const playerA = slotA.playerId ? players[slotA.playerId] : null;
  const playerB = slotB.playerId ? players[slotB.playerId] : null;
  return (!playerA || canPlaySlot(playerA, slotB.kind)) && (!playerB || canPlaySlot(playerB, slotA.kind));
}

/** Trades the players (and what was paid for them) between two slots. */
export function swapSlots(coach: Coach, a: number, b: number, players: Record<string, Player>): Coach {
  if (!canSwap(coach, a, b, players)) return coach;
  const roster = coach.roster.map((slot) => ({ ...slot }));
  const { playerId, price } = roster[a];
  roster[a] = { ...roster[a], playerId: roster[b].playerId, price: roster[b].price };
  roster[b] = { ...roster[b], playerId, price };
  return { ...coach, roster };
}

/** Lineup changes are only allowed once the auction is over. */
export function swapLineup(state: AuctionState, coachId: string, a: unknown, b: unknown): AuctionState {
  if (state.phase !== 'finished' || !Number.isInteger(a) || !Number.isInteger(b)) return state;
  const coach = state.coaches.find((c) => c.id === coachId);
  if (!coach || !canSwap(coach, a as number, b as number, state.players)) return state;
  const updated = swapSlots(coach, a as number, b as number, state.players);
  return { ...state, coaches: state.coaches.map((c) => (c.id === coachId ? updated : c)) };
}
