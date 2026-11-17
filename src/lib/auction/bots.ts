import type { Rng } from './rng';
import { canBidOn, emptySlotCount, findSlotFor, maxBid, minNextBid, topBid } from './rules';
import type { AuctionState, Coach, Player } from './types';

export type BotDecision = { type: 'bid'; amount: number } | { type: 'pass' } | { type: 'wait' };

const STAR_OVERALL = 98;
const REPLACEMENT_OVERALL = 72;
const STAR_PRICE = 12;

/** Market price of a player on a $20 / 5-slot scale. */
export function basePrice(overall: number): number {
  const quality = Math.max(0, (overall - REPLACEMENT_OVERALL) / (STAR_OVERALL - REPLACEMENT_OVERALL));
  return 1 + (STAR_PRICE - 1) * Math.pow(quality, 2.2);
}

/** How much this bot is willing to pay for the player right now. */
export function botValuation(bot: Coach, player: Player, state: AuctionState): number {
  const { startingCash, benchSize } = state.settings;
  const totalSlots = 5 + benchSize;
  const scale = startingCash / 20;

  const empty = emptySlotCount(bot);
  const cashPerSlot = bot.cash / Math.max(empty, 1);
  const fairPerSlot = startingCash / totalSlots;
  const budgetFactor = Math.min(2, Math.max(0.5, cashPerSlot / fairPerSlot));

  const slotIndex = findSlotFor(bot, player);
  const benchOnly = slotIndex !== -1 && bot.roster[slotIndex].kind === 'BENCH';
  const needFactor = benchOnly ? 0.5 : 1;

  const value = basePrice(player.overall) * scale * bot.aggressiveness * budgetFactor * needFactor;
  return Math.max(1, Math.floor(value));
}

export function decideBot(bot: Coach, state: AuctionState, rng: Rng): BotDecision {
  const lot = state.lot;
  if (!lot) return { type: 'wait' };

  const top = topBid(lot);
  if (top?.coachId === bot.id) return { type: 'wait' };

  const player = state.players[lot.playerId];
  if (!canBidOn(bot, player, lot)) return { type: 'pass' };

  const limit = Math.min(botValuation(bot, player, state), maxBid(bot));
  const next = minNextBid(lot);
  if (next > limit) return { type: 'pass' };

  // Occasionally jump the price to scare people off.
  const jump = limit - next >= 3 && rng.next() < 0.2 ? 2 : 0;
  return { type: 'bid', amount: next + jump };
}

/** Delay before a bot reacts, so bids feel human. */
export function botReactionDelay(bidSeconds: number, rng: Rng): number {
  return rng.between(700, bidSeconds * 1000 * 0.75);
}
