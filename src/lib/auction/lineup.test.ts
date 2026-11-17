import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PLAYERS } from '../../data/players';
import { canSwap, swapLineup } from './lineup';
import { adjacentPositions, canPlaySlot, playablePositions } from './positions';
import { createRoster, findSlotFor } from './rules';
import type { AuctionState, Coach, Player } from './types';

const byName = (name: string) => PLAYERS.find((p) => p.name === name)!;
const players: Record<string, Player> = Object.fromEntries(PLAYERS.map((p) => [p.id, p]));

function coachWith(names: Array<string | null>, benchSize: 0 | 2 = 0): Coach {
  const roster = createRoster({ startingCash: 20, benchSize, bidSeconds: 15 }).map((slot, i) => ({
    ...slot,
    playerId: names[i] ? byName(names[i]!).id : null,
    price: names[i] ? 1 : 0,
  }));
  return { id: 'coach-0', name: 'Pedro', isBot: false, cash: 15, roster, aggressiveness: 1 };
}

describe('positions', () => {
  it('lets a player play one position to each side', () => {
    assert.deepEqual(adjacentPositions('PG'), ['SG']);
    assert.deepEqual(adjacentPositions('SF'), ['SG', 'PF']);
    const mitchell = byName('Donovan Mitchell'); // SG only
    assert.deepEqual(playablePositions(mitchell).sort(), ['PG', 'SF', 'SG']);
    assert.ok(!canPlaySlot(mitchell, 'C'));
    assert.ok(canPlaySlot(mitchell, 'BENCH'));
  });

  it('auction places a player at a neighboring position before the bench', () => {
    const coach = coachWith([null, 'Anthony Edwards', null, null, null], 2);
    // SG is taken: a SG-only player goes to PG (natural slot full, neighbor open).
    const index = findSlotFor(coach, byName('Donovan Mitchell'));
    assert.equal(coach.roster[index].kind, 'PG');
  });
});

describe('lineup', () => {
  it('swaps players only when both fit the other slot', () => {
    const coach = coachWith(['Stephen Curry', 'Donovan Mitchell', 'Mikal Bridges', 'Julius Randle', 'Rudy Gobert']);
    assert.ok(canSwap(coach, 0, 1, players), 'PG and SG can trade');
    assert.ok(!canSwap(coach, 0, 4, players), 'Curry cannot play C');

    const state = { phase: 'finished', coaches: [coach], players } as unknown as AuctionState;
    const swapped = swapLineup(state, 'coach-0', 0, 1);
    assert.equal(swapped.coaches[0].roster[0].playerId, byName('Donovan Mitchell').id);
    assert.equal(swapped.coaches[0].roster[1].playerId, byName('Stephen Curry').id);
    assert.equal(swapLineup(state, 'coach-0', 0, 4), state, 'invalid swap is ignored');
    assert.equal(swapLineup({ ...state, phase: 'running' }, 'coach-0', 0, 1).coaches[0], coach, 'not during the auction');
  });
});
