import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PLAYERS } from '../../data/players';
import { createAuction, tick } from '../auction/engine';
import { createRng } from '../auction/rng';
import type { AuctionState } from '../auction/types';
import { allocate, simulateGame } from './game';
import { winProbability } from './probability';
import { bracketOrder, roundRobin, simulateTournament } from './tournament';
import { bestTactic, OFFENSE_STYLES, offenseBonus, PACES, paceBonus, teamProfile, type Tactic, type TeamProfile } from './tactics';
import type { TournamentFormat } from './types';

const teamProfileOf = teamProfile;
const bestOf = bestTactic;
function worstOf(profile: TeamProfile): Tactic {
  const offense = [...OFFENSE_STYLES].sort((a, b) => offenseBonus(profile, a) - offenseBonus(profile, b))[0];
  const pace = [...PACES].sort((a, b) => paceBonus(profile, a) - paceBonus(profile, b))[0];
  return { offense, pace };
}

function finishedAuction(coachCount: number, benchSize: 0 | 2 = 0, seed = 5): AuctionState {
  let state = createAuction({
    settings: { startingCash: 20, benchSize, bidSeconds: 15 },
    players: PLAYERS,
    coaches: Array.from({ length: coachCount }, (_, i) => ({ name: `B${i}`, isBot: true })),
    seed,
    now: 0,
  });
  let now = 0;
  while (state.phase === 'running') {
    now += 250;
    state = tick(state, now);
  }
  return state;
}

describe('win probability', () => {
  it('blends 65% strength with 35% luck', () => {
    assert.equal(winProbability(85, 85), 0.5);
    assert.ok(Math.abs(winProbability(90, 85) - 0.72) < 0.01);
    assert.ok(winProbability(60, 99) > 0.175, 'underdog always keeps some chance');
    assert.ok(winProbability(99, 60) < 0.825);
  });

  it('simulated games follow the expected win rate', () => {
    const { coaches, players } = finishedAuction(2);
    const [a, b] = coaches;
    const ratings = { [a.id]: 90, [b.id]: 85 };
    const rng = createRng(123);
    const games = 4000;
    let aWins = 0;
    for (let i = 0; i < games; i++) {
      const game = i % 2 === 0 ? simulateGame(a, b, { players, ratings }, rng) : simulateGame(b, a, { players, ratings }, rng);
      if (game.winnerId === a.id) aWins += 1;
    }
    const rate = aWins / games;
    assert.ok(Math.abs(rate - winProbability(90, 85)) < 0.03, `win rate ${rate}`);
  });

  it('produces consistent scores and box scores', () => {
    const { coaches, players } = finishedAuction(2, 2);
    const [a, b] = coaches;
    const ratings = { [a.id]: 88, [b.id]: 86 };
    const rng = createRng(9);
    for (let i = 0; i < 500; i++) {
      const game = simulateGame(a, b, { players, ratings }, rng);
      assert.notEqual(game.homeScore, game.awayScore);
      assert.equal(game.winnerId, game.homeScore > game.awayScore ? a.id : b.id);
      assert.equal(game.periods.reduce((sum, [h]) => sum + h, 0), game.homeScore);
      assert.equal(game.periods.reduce((sum, [, w]) => sum + w, 0), game.awayScore);
      assert.equal(game.box[a.id].reduce((sum, line) => sum + line.points, 0), game.homeScore);
      assert.equal(game.box[a.id].length, 7);
      assert.ok(game.homeScore > 70 && game.homeScore < 170, `odd score ${game.homeScore}`);
    }
  });
});

describe('scheduling', () => {
  it('allocate keeps the exact total', () => {
    assert.deepEqual(allocate(10, [1, 1, 1]).reduce((a, b) => a + b, 0), 10);
    assert.deepEqual(allocate(7, [2, 0, 1]), [5, 0, 2]);
  });

  for (const n of [2, 5, 6, 9]) {
    it(`round robin with ${n} teams has every pair exactly once`, () => {
      const ids = Array.from({ length: n }, (_, i) => `t${i}`);
      const pairs = roundRobin(ids).flat().map(([a, b]) => [a, b].sort().join('-'));
      assert.equal(pairs.length, (n * (n - 1)) / 2);
      assert.equal(new Set(pairs).size, pairs.length);
    });
  }

  it('builds a standard bracket order', () => {
    assert.deepEqual(bracketOrder(8), [1, 8, 4, 5, 2, 7, 3, 6]);
    assert.deepEqual(bracketOrder(4), [1, 4, 2, 3]);
  });
});

describe('tournament', () => {
  const formats: TournamentFormat[] = ['seasonAndPlayoffs', 'seasonOnly', 'playoffsOnly'];
  for (const coachCount of [2, 3, 6, 9, 16]) {
    for (const format of formats) {
      it(`${format} with ${coachCount} teams`, () => {
        const { coaches, players } = finishedAuction(coachCount, 0, coachCount);
        const tournament = simulateTournament({
          coaches,
          players,
          settings: { format, playoffTeams: 8, seriesLength: 3 },
          seed: 1,
        });
        const ids = new Set(coaches.map((c) => c.id));
        assert.ok(ids.has(tournament.championId));
        assert.ok(tournament.mvp);

        if (format === 'playoffsOnly') assert.equal(tournament.seasonRounds.length, 0);
        else {
          const gamesPerTeam = coachCount <= 6 ? 2 * (coachCount - 1) : coachCount - 1;
          for (const standing of tournament.finalStandings) {
            assert.equal(standing.wins + standing.losses, gamesPerTeam);
          }
        }

        if (format === 'seasonOnly') {
          assert.equal(tournament.playoffRounds.length, 0);
          assert.equal(tournament.championId, tournament.finalStandings[0].coachId);
        } else {
          const final = tournament.playoffRounds.at(-1)!;
          assert.equal(final.series.length, 1);
          for (const series of tournament.playoffRounds.flatMap((r) => r.series)) {
            if (!series.low) continue;
            assert.equal(Math.max(series.highWins, series.lowWins), 2);
            assert.equal(series.games.length, series.highWins + series.lowWins);
          }
          const firstRoundTeams = tournament.playoffRounds[0].series.flatMap((s) => (s.low ? [s.high, s.low] : [s.high]));
          const expected = format === 'playoffsOnly' ? coachCount : Math.min(8, coachCount);
          assert.equal(firstRoundTeams.length, expected);
        }
      });
    }
  }

  it('the best team does not always win', () => {
    const { coaches, players } = finishedAuction(8);
    const ratings = simulateTournament({
      coaches,
      players,
      settings: { format: 'seasonAndPlayoffs', playoffTeams: 4, seriesLength: 1 },
      seed: 0,
    }).ratings;
    const best = Object.entries(ratings).sort((a, b) => b[1] - a[1])[0][0];
    let bestTitles = 0;
    const runs = 200;
    for (let seed = 0; seed < runs; seed++) {
      const t = simulateTournament({
        coaches,
        players,
        settings: { format: 'seasonAndPlayoffs', playoffTeams: 4, seriesLength: 1 },
        seed,
      });
      if (t.championId === best) bestTitles += 1;
    }
    assert.ok(bestTitles > 0 && bestTitles < runs, `best team won ${bestTitles}/${runs}`);
  });
});

describe('tactics', () => {
  it('rewards a style that fits the roster and punishes one that does not', async () => {
    const { offenseBonus, paceBonus, bestTactic, tacticBonus, fitLevel } = await import('./tactics');
    const shooters = { shooting: 86, paint: 72, athleticism: 78, playmaking: 80 };
    assert.ok(offenseBonus(shooters, 'threes') > 2);
    assert.ok(offenseBonus(shooters, 'paint') < -2);
    assert.equal(offenseBonus(shooters, 'balanced'), 0);
    assert.ok(paceBonus(shooters, 'fast') < 0 && paceBonus(shooters, 'slow') > 0);
    assert.deepEqual(bestTactic(shooters), { offense: 'threes', pace: 'slow' });
    assert.ok(tacticBonus(shooters, { offense: 'threes', pace: 'slow' }) <= 4, 'total bonus is capped');
    assert.equal(fitLevel(2), 'great');
    assert.equal(fitLevel(-2), 'bad');
  });

  it('the best tactic beats a bad one over many seasons', () => {
    const { coaches, players } = finishedAuction(2, 0, 21);
    const [a] = coaches;
    const profile = teamProfileOf(a, players);
    const titlesWith = (tactic: Tactic) => {
      let titles = 0;
      for (let seed = 0; seed < 150; seed++) {
        const t = simulateTournament({
          coaches,
          players,
          settings: { format: 'seasonOnly', playoffTeams: 4, seriesLength: 1 },
          seed,
          tactics: { [a.id]: tactic },
        });
        if (t.championId === a.id) titles += 1;
      }
      return titles;
    };
    const good = titlesWith(bestOf(profile));
    const bad = titlesWith(worstOf(profile));
    assert.ok(good > bad, `good ${good} vs bad ${bad}`);
  });

  it('fast games score more than slow games', () => {
    const { coaches, players } = finishedAuction(2);
    const [a, b] = coaches;
    const ratings = { [a.id]: 85, [b.id]: 85 };
    const rng = createRng(4);
    const average = (pace: 'fast' | 'slow') => {
      let total = 0;
      for (let i = 0; i < 300; i++) {
        const game = simulateGame(a, b, { players, ratings, paces: { [a.id]: pace, [b.id]: pace } }, rng);
        total += game.homeScore + game.awayScore;
      }
      return total / 300;
    };
    assert.ok(average('fast') - average('slow') > 30);
  });
});
