import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PLAYERS } from '../../data/players';
import { createAuction, passLot, placeBid, tick } from './engine';
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

    const afterBid = placeBid(state, human.id, 16, 1);
    assert.equal(afterBid.lot?.bids.at(-1)?.amount, 16);
    assert.equal(minNextBid(afterBid.lot!), 17);
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

  it('is deterministic for the same seed', () => {
    const first = runToEnd(newGame(6, SETTINGS, 0, 7), 0);
    const second = runToEnd(newGame(6, SETTINGS, 0, 7), 0);
    assert.deepEqual(first.history, second.history);
  });
});
