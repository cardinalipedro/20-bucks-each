import { botReactionDelay, decideBot } from './bots';
import { buildPool } from './pool';
import { canPlaySlot } from './positions';
import { createRng, type Rng } from './rng';
import {
  BID_EXTENSION_SECONDS,
  canBidOn,
  createRoster,
  findSlotFor,
  isRosterFull,
  maxBid,
  minNextBid,
  topBid,
} from './rules';
import type { AuctionSettings, AuctionState, Coach, Lot, Player } from './types';

export interface CoachSeed {
  name: string;
  isBot: boolean;
}

export interface CreateAuctionInput {
  settings: AuctionSettings;
  players: Player[];
  coaches: CoachSeed[];
  seed: number;
  now: number;
}

const MAX_BOT_ACTIONS_PER_TICK = 32;

// ---------------------------------------------------------------------------
// Public API: every function is pure and returns a new state.
// ---------------------------------------------------------------------------

export function createAuction({ settings, players, coaches, seed, now }: CreateAuctionInput): AuctionState {
  const rng = createRng(seed);
  const state: AuctionState = {
    settings,
    players: Object.fromEntries(players.map((player) => [player.id, player])),
    coaches: coaches.map((coach, index) => ({
      id: `coach-${index}`,
      name: coach.name,
      isBot: coach.isBot,
      cash: settings.startingCash,
      roster: createRoster(settings),
      aggressiveness: coach.isBot ? rng.between(0.85, 1.25) : 1,
    })),
    queue: buildPool(players, coaches.length, settings, rng),
    lot: null,
    unsold: [],
    history: [],
    botPlans: {},
    phase: 'running',
    lotNumber: 0,
    rngSeed: seed,
  };
  return withSeed(openNextLot(state, now, rng), rng);
}

export function placeBid(state: AuctionState, coachId: string, amount: number, now: number): AuctionState {
  const rng = createRng(state.rngSeed);
  const next = applyBid(state, coachId, amount, now, rng);
  return next === state ? state : withSeed(next, rng);
}

export function passLot(state: AuctionState, coachId: string, now: number): AuctionState {
  const rng = createRng(state.rngSeed);
  const next = applyPass(state, coachId, now, rng);
  return next === state ? state : withSeed(next, rng);
}

/**
 * A human left the match: a bot takes over their team, cash and current lot for good.
 * Their roster and money are kept, so the room keeps the same number of teams.
 */
export function replaceWithBot(state: AuctionState, coachId: string, now: number): AuctionState {
  const coach = state.coaches.find((c) => c.id === coachId);
  if (!coach || (coach.isBot && !coach.away)) return state;
  return handToBot(state, coachId, { replacedByBot: true, away: false }, now);
}

/**
 * Away mode: a bot plays for an idle human until they come back.
 * Turning it off gives the team back exactly as the bot left it.
 */
export function setAutopilot(state: AuctionState, coachId: string, on: boolean, now: number): AuctionState {
  const coach = state.coaches.find((c) => c.id === coachId);
  if (!coach || coach.replacedByBot) return state;

  if (on) {
    if (coach.isBot) return state;
    return handToBot(state, coachId, { away: true }, now);
  }

  if (!coach.away) return state;
  const coaches = state.coaches.map((c) => (c.id === coachId ? { ...c, isBot: false, away: false } : c));
  const botPlans = { ...state.botPlans };
  delete botPlans[coachId];
  return { ...state, coaches, botPlans };
}

function handToBot(state: AuctionState, coachId: string, patch: Partial<Coach>, now: number): AuctionState {
  const rng = createRng(state.rngSeed);
  const coaches = state.coaches.map((c) => (c.id === coachId ? { ...c, ...patch, isBot: true, aggressiveness: 1 } : c));
  const next: AuctionState = { ...state, coaches };
  if (next.phase !== 'running' || !next.lot) return next;

  const lot = next.lot;
  const isTop = topBid(lot)?.coachId === coachId;
  const plan = lot.passed.includes(coachId) || isTop ? Infinity : now + botReactionDelay(lot.deadline - now, rng);
  return withSeed({ ...next, botPlans: { ...next.botPlans, [coachId]: plan } }, rng);
}

/** Advance the clock: lets bots act and closes the lot when time runs out. */
export function tick(state: AuctionState, now: number): AuctionState {
  if (state.phase !== 'running' || !state.lot) return state;
  const rng = createRng(state.rngSeed);
  let next = state;

  for (let i = 0; i < MAX_BOT_ACTIONS_PER_TICK; i++) {
    const lot = next.lot;
    if (!lot) break;
    const dueBot = next.coaches
      .filter((coach) => coach.isBot && next.botPlans[coach.id] <= now && next.botPlans[coach.id] < lot.deadline)
      .sort((a, b) => next.botPlans[a.id] - next.botPlans[b.id])[0];
    if (!dueBot) break;

    const at = next.botPlans[dueBot.id];
    const decision = decideBot(dueBot, next, rng);
    if (decision.type === 'bid') {
      next = applyBid(next, dueBot.id, decision.amount, at, rng);
    } else if (decision.type === 'pass') {
      next = applyPass(next, dueBot.id, at, rng);
    } else {
      next = { ...next, botPlans: { ...next.botPlans, [dueBot.id]: Infinity } };
    }
  }

  if (next.lot && next.phase === 'running' && now >= next.lot.deadline) {
    next = closeLot(next, now, rng);
  }
  return next === state ? state : withSeed(next, rng);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function withSeed(state: AuctionState, rng: Rng): AuctionState {
  return { ...state, rngSeed: rng.seed };
}

function applyBid(state: AuctionState, coachId: string, amount: number, now: number, rng: Rng): AuctionState {
  const lot = state.lot;
  const coach = state.coaches.find((c) => c.id === coachId);
  if (state.phase !== 'running' || !lot || !coach) return state;

  const player = state.players[lot.playerId];
  const isTop = topBid(lot)?.coachId === coachId;
  const isValid =
    !isTop &&
    !lot.passed.includes(coachId) &&
    canBidOn(coach, player, lot) &&
    amount >= minNextBid(lot) &&
    amount <= maxBid(coach);
  if (!isValid) return state;

  const bids = [...lot.bids, { coachId, amount, at: now }];
  // The clock never goes back to full time: a late bid only buys a few seconds.
  const updatedLot: Lot = {
    ...lot,
    bids,
    deadline: Math.max(lot.deadline, now + BID_EXTENSION_SECONDS * 1000),
  };
  // Anyone who can no longer afford the next bid is out automatically.
  updatedLot.passed = state.coaches
    .filter((c) => c.id !== coachId && (lot.passed.includes(c.id) || !canBidOn(c, player, updatedLot)))
    .map((c) => c.id);

  const next = { ...state, lot: updatedLot };
  return { ...next, botPlans: planBots(next, now, rng) };
}

function applyPass(state: AuctionState, coachId: string, now: number, rng: Rng): AuctionState {
  const lot = state.lot;
  if (state.phase !== 'running' || !lot || lot.passed.includes(coachId)) return state;
  if (topBid(lot)?.coachId === coachId) return state;

  const next: AuctionState = {
    ...state,
    lot: { ...lot, passed: [...lot.passed, coachId] },
    botPlans: { ...state.botPlans, [coachId]: Infinity },
  };
  return everyoneElseIsOut(next) ? closeLot(next, now, rng) : next;
}

function everyoneElseIsOut(state: AuctionState): boolean {
  const lot = state.lot;
  if (!lot) return false;
  const topCoachId = topBid(lot)?.coachId;
  return state.coaches.every((coach) => coach.id === topCoachId || lot.passed.includes(coach.id));
}

function planBots(state: AuctionState, now: number, rng: Rng): Record<string, number> {
  const lot = state.lot;
  const topCoachId = lot ? topBid(lot)?.coachId : undefined;
  const plans: Record<string, number> = {};
  for (const coach of state.coaches) {
    if (!coach.isBot) continue;
    const waiting = !lot || lot.passed.includes(coach.id) || coach.id === topCoachId;
    plans[coach.id] = waiting || !lot ? Infinity : now + botReactionDelay(lot.deadline - now, rng);
  }
  return plans;
}

function closeLot(state: AuctionState, now: number, rng: Rng): AuctionState {
  const lot = state.lot;
  if (!lot) return state;
  const top = topBid(lot);

  if (!top) {
    return openNextLot(
      {
        ...state,
        lot: null,
        unsold: [...state.unsold, lot.playerId],
        history: [...state.history, { playerId: lot.playerId, winnerId: null, price: 0 }],
      },
      now,
      rng,
    );
  }

  const player = state.players[lot.playerId];
  const coaches = state.coaches.map((coach) =>
    coach.id === top.coachId ? signPlayer(coach, player, top.amount) : coach,
  );
  return openNextLot(
    {
      ...state,
      coaches,
      lot: null,
      history: [...state.history, { playerId: lot.playerId, winnerId: top.coachId, price: top.amount }],
    },
    now,
    rng,
  );
}

function signPlayer(coach: Coach, player: Player, price: number, slotIndex = findSlotFor(coach, player)): Coach {
  if (slotIndex === -1) return coach;
  const roster = coach.roster.map((slot, index) =>
    index === slotIndex ? { ...slot, playerId: player.id, price } : slot,
  );
  return { ...coach, cash: coach.cash - price, roster };
}

function openNextLot(state: AuctionState, now: number, rng: Rng): AuctionState {
  if (state.coaches.every(isRosterFull)) return finish(state);

  const queue = [...state.queue];
  const unsold = [...state.unsold];

  while (queue.length > 0) {
    const playerId = queue.shift()!;
    const player = state.players[playerId];
    const emptyLot: Lot = { playerId, bids: [], deadline: now + state.settings.bidSeconds * 1000, passed: [] };
    const eligible = state.coaches.filter((coach) => canBidOn(coach, player, emptyLot));

    if (eligible.length === 0) {
      unsold.push(playerId);
      continue;
    }

    emptyLot.passed = state.coaches.filter((coach) => !eligible.includes(coach)).map((coach) => coach.id);
    const next: AuctionState = { ...state, queue, unsold, lot: emptyLot, lotNumber: state.lotNumber + 1 };
    return { ...next, botPlans: planBots(next, now, rng) };
  }

  return finish({ ...state, queue, unsold });
}

/**
 * Ends the auction. Any slot still open gets the WORST leftover player for $0,
 * so passing on everyone while waiting for a star does not pay off.
 */
function finish(state: AuctionState): AuctionState {
  const pool = [...state.queue, ...state.unsold]
    .map((id) => state.players[id])
    .sort((a, b) => a.overall - b.overall);

  const coaches = state.coaches.map((original) => {
    let coach = original;
    coach.roster.forEach((slot, index) => {
      if (slot.playerId !== null || pool.length === 0) return;
      const natural = pool.findIndex((p) => slot.kind === 'BENCH' || p.positions.includes(slot.kind));
      const fitIndex = natural !== -1 ? natural : pool.findIndex((p) => canPlaySlot(p, slot.kind));
      const [player] = pool.splice(fitIndex === -1 ? 0 : fitIndex, 1);
      coach = signPlayer(coach, player, 0, index);
    });
    return coach;
  });

  return {
    ...state,
    coaches,
    queue: [],
    unsold: pool.map((p) => p.id),
    lot: null,
    botPlans: {},
    phase: 'finished',
  };
}
