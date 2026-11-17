import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PLAYERS } from '@/infrastructure/data/players';
import { createAuction, tick } from '@/domain/auction/engine';
import { createRng } from '@/domain/shared/rng';
import type { AuctionState } from '@/domain/auction/types';
import { allocate, simulateGame } from './game';
import { winProbability } from './probability';
import {
  beforeLastStep,
  bracketOrder,
  hasNextGame,
  playNextStep,
  roundRobin,
  simulateTournament,
  startTournament,
  stepGames,
  topPerformers,
} from './tournament';
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

describe('box score and highlights', () => {
  it('keeps every stat line internally consistent', () => {
    const { coaches, players } = finishedAuction(2, 2);
    const [a, b] = coaches;
    const ratings = { [a.id]: 86, [b.id]: 86 };
    const rng = createRng(31);
    for (let i = 0; i < 400; i++) {
      const game = simulateGame(a, b, { players, ratings, offenses: { [a.id]: 'threes', [b.id]: 'paint' } }, rng);
      game.periods.forEach(([homePoints], period) => {
        assert.equal(game.box[a.id].reduce((sum, line) => sum + line.periodPoints[period], 0), homePoints);
      });
      for (const line of [...game.box[a.id], ...game.box[b.id]]) {
        const twos = line.fieldGoalsMade - line.threesMade;
        assert.equal(2 * twos + 3 * line.threesMade + line.freeThrowsMade, line.points, 'shots add up to points');
        assert.equal(line.periodPoints.reduce((sum, p) => sum + p, 0), line.points);
        assert.ok(line.periodPoints.every((p) => p >= 0));
        assert.ok(twos >= 0 && line.threesMade >= 0 && line.freeThrowsMade >= 0);
        assert.ok(line.fieldGoalsAttempted >= line.fieldGoalsMade);
        assert.ok(line.threesAttempted >= line.threesMade);
        assert.ok(line.freeThrowsAttempted >= line.freeThrowsMade);
      }
      for (const event of game.events) {
        assert.ok(event.period >= 1 && event.period <= game.periods.length);
      }
      assert.equal(game.events.at(-1)?.kind, 'gameHigh');
    }
  });

  it('a three-point offense takes and makes more threes', () => {
    const { coaches, players } = finishedAuction(2);
    const [a, b] = coaches;
    const ratings = { [a.id]: 85, [b.id]: 85 };
    const rng = createRng(8);
    const threes = (offense: 'threes' | 'paint') => {
      let made = 0;
      for (let i = 0; i < 200; i++) {
        const game = simulateGame(a, b, { players, ratings, offenses: { [a.id]: offense } }, rng);
        made += game.box[a.id].reduce((sum, line) => sum + line.threesMade, 0);
      }
      return made / 200;
    };
    assert.ok(threes('threes') - threes('paint') > 3);
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
        assert.ok(tournament.finished && ids.has(tournament.championId!));
        assert.ok(tournament.mvp);
        if (format === 'seasonOnly') assert.equal(tournament.finalsMvp, null);
        else assert.equal(tournament.finalsMvp?.coachId, tournament.championId, 'finals MVP plays for the champion');

        // Series leaders come only from the two teams of the series, best first.
        for (const series of tournament.playoffRounds.flatMap((round) => round.series)) {
          const leaders = topPerformers(series.games, 3);
          const teams = [series.high.coachId, series.low?.coachId];
          assert.ok(leaders.every((line) => teams.includes(line.coachId)));
          assert.ok(leaders.length <= 3);
          if (series.games.length > 0) assert.equal(leaders[0].games, series.games.length);
        }

        if (format === 'playoffsOnly') assert.equal(tournament.seasonRounds.length, 0);
        else {
          const gamesPerTeam = coachCount <= 6 ? 2 * (coachCount - 1) : coachCount - 1;
          for (const standing of tournament.standings) {
            assert.equal(standing.wins + standing.losses, gamesPerTeam);
          }
        }

        if (format === 'seasonOnly') {
          assert.equal(tournament.playoffRounds.length, 0);
          assert.equal(tournament.championId, tournament.standings[0].coachId);
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

  it('is played one step at a time: season rounds, then one playoff game per step', () => {
    const { coaches, players } = finishedAuction(4, 0, 9);
    const settings = { format: 'seasonAndPlayoffs' as const, playoffTeams: 4 as const, seriesLength: 7 as const };
    let t = startTournament({ coaches, players, settings, seed: 3 });
    assert.equal(t.steps.length, 0);
    assert.equal(t.schedule.length, 6, 'four teams play home and away');
    assert.ok(coaches.every((coach) => hasNextGame(t, coach.id)));

    for (let round = 0; round < 6; round++) t = playNextStep(t, { coaches, players });
    assert.deepEqual(t.steps.at(-1), { kind: 'season', round: 5 });
    assert.equal(t.playoffRounds.length, 1, 'the bracket is known as soon as the season ends');
    assert.ok(t.playoffRounds[0].series.every((series) => series.games.length === 0));

    t = playNextStep(t, { coaches, players });
    assert.deepEqual(t.steps.at(-1), { kind: 'playoffs', round: 0, game: 1 });
    assert.ok(t.playoffRounds[0].series.every((series) => series.games.length === 1), 'game 1 of every series');
    assert.equal(stepGames(t, t.steps.at(-1)!).length, 2);

    // The screen can hold back the last game until it has been shown live.
    const before = beforeLastStep(t);
    assert.ok(before.playoffRounds[0].series.every((series) => series.games.length === 0));

    // A tactic changed between games is used from the next game on.
    const human = coaches[0];
    t = playNextStep(t, { coaches, players, tactics: { [human.id]: { offense: 'paint', pace: 'slow' } } });
    assert.deepEqual(t.tactics[human.id], { offense: 'paint', pace: 'slow' });

    while (!t.finished) t = playNextStep(t, { coaches, players });
    const final = t.playoffRounds.at(-1)!.series[0];
    assert.equal(t.championId, final.winnerId);
    assert.ok(t.mvp && t.finalsMvp);
    assert.equal(t.playoffRounds.length, 2);
    assert.ok(coaches.every((coach) => !hasNextGame(t, coach.id)));
    const playoffSteps = t.steps.filter((step) => step.kind === 'playoffs').length;
    const longestSeries = (round: number) => Math.max(...t.playoffRounds[round].series.map((s) => s.games.length));
    assert.equal(playoffSteps, longestSeries(0) + longestSeries(1));
    assert.equal(playNextStep(t, { coaches, players }), t, 'nothing left to play');
  });

  it('keeps no secrets in the public view but the random state', () => {
    const { coaches, players } = finishedAuction(3);
    const t = startTournament({ coaches, players, settings: { format: 'playoffsOnly', playoffTeams: 4, seriesLength: 1 }, seed: 1 });
    assert.equal(t.playoffRounds.length, 1, 'without a season the bracket exists from the start');
    assert.equal(typeof t.rngState, 'number');
  });

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
