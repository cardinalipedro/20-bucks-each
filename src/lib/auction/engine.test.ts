import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PLAYERS } from '../../data/players';
import { createAuction, passLot, placeBid, replaceWithBot, setAutopilot, tick } from './engine';
import { POOL_FACTOR } from './pool';
import { maxBid, minNextBid } from './rules';
import type { AuctionSettings, AuctionState } from './types';

const SETTINGS: AuctionSettings = { startingCash: 20, benchSize: 0, bidSeconds: 10 };

function runToEnd(state: AuctionState, start: number): AuctionState {
  let now = start;
  let current = state;
  for (let step = 0; step < 200_000 && current.phase === 'running'; step++) {
    now += 250;
    current = tick(current, now);
  }
  return current;
}

function newGame(coachCount: number, settings = SETTINGS, humans = 0, seed = 42) {
  return createAuction({
    settings,
    players: PLAYERS,
    coaches: Array.from({ length: coachCount }, (_, i) => ({ name: `C${i}`, isBot: i >= humans })),
    seed,
    now: 0,
  });
}

describe('auction engine', () => {
  it('has unique player ids and enough players for 16 coaches with bench', () => {
    const ids = new Set(PLAYERS.map((p) => p.id));
    assert.equal(ids.size, PLAYERS.length);
    assert.ok(PLAYERS.length >= 16 * 7, `only ${PLAYERS.length} players`);
  });

  for (const coachCount of [2, 5, 8, 16]) {
    for (const benchSize of [0, 2] as const) {
      it(`finishes with full, valid rosters (${coachCount} bots, bench ${benchSize})`, () => {
        const settings = { ...SETTINGS, benchSize };
        const end = runToEnd(newGame(coachCount, settings, 0, coachCount * 7 + benchSize), 0);
        assert.equal(end.phase, 'finished');

        const signed = new Set<string>();
        for (const coach of end.coaches) {
          assert.ok(coach.cash >= 0, `${coach.name} has negative cash`);
          const spent = coach.roster.reduce((sum, slot) => sum + slot.price, 0);
          assert.equal(spent + coach.cash, settings.startingCash);
          for (const slot of coach.roster) {
            assert.ok(slot.playerId, `${coach.name} has an empty slot`);
            assert.ok(!signed.has(slot.playerId!), `${slot.playerId} signed twice`);
            signed.add(slot.playerId!);
          }
        }
      });
    }
  }

  it('bots actually spend money', () => {
    const end = runToEnd(newGame(8), 0);
    const totalSpent = end.coaches.reduce((sum, c) => sum + (SETTINGS.startingCash - c.cash), 0);
    assert.ok(totalSpent > 8 * 10, `bots spent only $${totalSpent}`);
  });

  it('rejects bids above the max bid and below the minimum', () => {
    const state = newGame(2, SETTINGS, 1);
    const human = state.coaches[0];
    assert.equal(maxBid(human), 16);
    assert.equal(placeBid(state, human.id, 17, 1), state);
    assert.equal(placeBid(state, human.id, 0, 1), state);

    const afterBid = placeBid(state, human.id, 5, 1);
    assert.equal(afterBid.lot?.bids.at(-1)?.amount, 5);
    assert.equal(minNextBid(afterBid.lot!), 6);
  });

  it('closes the lot early when everyone else passes', () => {
    const state = newGame(2, SETTINGS, 2);
    const [a, b] = state.coaches;
    const playerId = state.lot!.playerId;
    const afterBid = placeBid(state, a.id, 3, 1);
    const afterPass = passLot(afterBid, b.id, 2);
    const winner = afterPass.coaches.find((c) => c.id === a.id)!;
    assert.ok(winner.roster.some((slot) => slot.playerId === playerId && slot.price === 3));
    assert.equal(winner.cash, 17);
    assert.equal(afterPass.lotNumber, 2);
  });

  it('auctions a limited pool with every position covered', () => {
    for (const coachCount of [2, 8, 16]) {
      const state = newGame(coachCount);
      const pool = [state.lot!.playerId, ...state.queue];
      const expected = Math.min(PLAYERS.length, Math.ceil(5 * coachCount * POOL_FACTOR));
      assert.ok(pool.length >= expected && pool.length <= expected + 5, `pool ${pool.length} vs ${expected}`);
      for (const position of ['PG', 'SG', 'SF', 'PF', 'C'] as const) {
        const count = pool.filter((id) => state.players[id].positions.includes(position)).length;
        assert.ok(count >= coachCount, `${position}: ${count} < ${coachCount}`);
      }
    }
  });

  it('gives the worst leftover players to a coach who passes on everything', () => {
    let state = newGame(4, SETTINGS, 1, 11);
    let now = 0;
    while (state.phase === 'running') {
      now += 250;
      state = passLot(state, 'coach-0', now);
      state = tick(state, now);
    }
    const human = state.coaches[0];
    const leftovers = state.unsold.map((id) => state.players[id].overall);
    assert.equal(human.cash, SETTINGS.startingCash);
    for (const slot of human.roster) {
      assert.equal(slot.price, 0);
      const overall = state.players[slot.playerId!].overall;
      assert.ok(leftovers.every((left) => left >= overall - 3), 'human got a better player than what was left');
    }
  });

  it('never resets the clock, a late bid only extends it to 3 seconds', () => {
    const state = newGame(2, SETTINGS, 2);
    const [a, b] = state.coaches;
    assert.equal(state.lot!.deadline, 10_000);

    const early = placeBid(state, a.id, 1, 1_000);
    assert.equal(early.lot!.deadline, 10_000);

    const late = placeBid(early, b.id, 2, 8_500);
    assert.equal(late.lot!.deadline, 11_500);
  });

  it('a bot takes over the team of a human who leaves', () => {
    let state = newGame(4, SETTINGS, 2);
    state = placeBid(state, 'coach-1', 3, 1);
    state = replaceWithBot(state, 'coach-1', 2);
    const replaced = state.coaches.find((c) => c.id === 'coach-1')!;
    assert.ok(replaced.isBot && replaced.replacedByBot);
    assert.equal(replaced.name, 'C1');
    assert.equal(state.lot!.bids.at(-1)?.coachId, 'coach-1', 'their winning bid still counts');

    // The human that stays never bids; the match still finishes with full rosters.
    let now = 2;
    while (state.phase === 'running') {
      now += 250;
      state = passLot(state, 'coach-0', now);
      state = tick(state, now);
    }
    const bot = state.coaches.find((c) => c.id === 'coach-1')!;
    assert.ok(bot.roster.every((slot) => slot.playerId));
    assert.ok(SETTINGS.startingCash - bot.cash >= 3, 'the replacement bot kept playing');
  });

  it('away mode lets a bot play and hands the team back', () => {
    let state = newGame(3, SETTINGS, 1);
    state = setAutopilot(state, 'coach-0', true, 1);
    assert.ok(state.coaches[0].isBot && state.coaches[0].away);

    let now = 1;
    for (let i = 0; i < 400 && state.phase === 'running'; i++) {
      now += 250;
      state = tick(state, now);
    }
    const spentWhileAway = SETTINGS.startingCash - state.coaches[0].cash;
    assert.ok(spentWhileAway > 0, 'the autopilot bought someone');

    state = setAutopilot(state, 'coach-0', false, now);
    assert.ok(!state.coaches[0].isBot && !state.coaches[0].away);
    assert.equal(state.botPlans['coach-0'], undefined);
    assert.equal(SETTINGS.startingCash - state.coaches[0].cash, spentWhileAway, 'money is kept');
  });

  it('sells at once when a bid cannot be covered by anyone else', () => {
    const state = newGame(2, SETTINGS, 2);
    const [a, b] = state.coaches;
    const playerId = state.lot!.playerId;
    // b passes first; then a bids: nobody left to cover it.
    const afterPass = passLot(state, b.id, 1);
    assert.equal(afterPass.lotNumber, 1, 'lot stays open: a can still bid');
    const afterBid = placeBid(afterPass, a.id, 1, 2);
    assert.equal(afterBid.lotNumber, 2, 'sold immediately');
    assert.ok(afterBid.coaches[0].roster.some((slot) => slot.playerId === playerId));

    // A max bid nobody can afford to beat also ends the lot.
    const fresh = newGame(2, SETTINGS, 2, 99);
    const allIn = placeBid(fresh, fresh.coaches[0].id, 16, 1);
    assert.equal(allIn.lotNumber, 2, 'the rival cannot pay $17, so the lot closed');
  });

  it('is deterministic for the same seed', () => {
    const first = runToEnd(newGame(6, SETTINGS, 0, 7), 0);
    const second = runToEnd(newGame(6, SETTINGS, 0, 7), 0);
    assert.deepEqual(first.history, second.history);
  });
});
