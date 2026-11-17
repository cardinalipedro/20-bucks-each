import { createRng, shuffle, type Rng } from '@/domain/shared/rng';
import type { Coach, Player } from '@/domain/auction/types';
import { simulateGame } from './game';
import { bestTactic, DEFAULT_TACTIC, tacticBonus, teamProfile, type Tactic } from './tactics';
import { teamRating } from './strength';
import type {
  GameResult,
  PlayerSeasonStats,
  PlayoffRound,
  SeasonRound,
  Seed,
  Series,
  Standing,
  Tournament,
  TournamentSettings,
} from './types';

/** Up to this many teams the regular season is played twice (home and away). */
const DOUBLE_ROUND_ROBIN_MAX_TEAMS = 6;

interface SimulateInput {
  coaches: Coach[];
  players: Record<string, Player>;
  settings: TournamentSettings;
  seed: number;
  /** Chosen tactics per coach. Missing: bots use their best fit, humans the default. */
  tactics?: Record<string, Tactic>;
}

/** Simulates the whole competition up front; the UI then reveals it step by step. */
export function simulateTournament({ coaches, players, settings, seed, tactics = {} }: SimulateInput): Tournament {
  const rng = createRng(seed);
  const chosen: Record<string, Tactic> = Object.fromEntries(
    coaches.map((coach) => [
      coach.id,
      tactics[coach.id] ?? (coach.isBot ? bestTactic(teamProfile(coach, players)) : DEFAULT_TACTIC),
    ]),
  );
  const baseRatings = Object.fromEntries(coaches.map((coach) => [coach.id, teamRating(coach, players)]));
  const ratings = Object.fromEntries(
    coaches.map((coach) => [
      coach.id,
      Math.round((baseRatings[coach.id] + tacticBonus(teamProfile(coach, players), chosen[coach.id])) * 10) / 10,
    ]),
  );
  const paces = Object.fromEntries(coaches.map((coach) => [coach.id, chosen[coach.id].pace]));
  const offenses = Object.fromEntries(coaches.map((coach) => [coach.id, chosen[coach.id].offense]));
  const byId = Object.fromEntries(coaches.map((coach) => [coach.id, coach]));
  const play = (homeId: string, awayId: string) =>
    simulateGame(byId[homeId], byId[awayId], { players, ratings, paces, offenses }, rng);

  const hasSeason = settings.format !== 'playoffsOnly';
  const hasPlayoffs = settings.format !== 'seasonOnly';

  const seasonRounds = hasSeason ? playSeason(coaches.map((c) => c.id), play, rng) : [];
  const finalStandings = hasSeason
    ? standingsAfter(coaches.map((c) => c.id), seasonRounds)
    : [...coaches]
        .sort((a, b) => ratings[b.id] - ratings[a.id])
        .map((coach) => ({ coachId: coach.id, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 }));

  let playoffRounds: PlayoffRound[] = [];
  let championId = finalStandings[0].coachId;

  if (hasPlayoffs) {
    const qualifiers = hasSeason ? Math.min(settings.playoffTeams, coaches.length) : coaches.length;
    const seeds = finalStandings.slice(0, qualifiers).map((standing, index) => ({ coachId: standing.coachId, seed: index + 1 }));
    playoffRounds = playPlayoffs(seeds, settings.seriesLength, play);
    championId = playoffRounds.at(-1)!.series[0].winnerId;
  }

  const allGames = [
    ...seasonRounds.flatMap((round) => round.games),
    ...playoffRounds.flatMap((round) => round.series.flatMap((series) => series.games)),
  ];
  const mvpGames = hasSeason ? seasonRounds.flatMap((round) => round.games) : allGames;

  return {
    settings,
    ratings,
    baseRatings,
    tactics: chosen,
    seasonRounds,
    finalStandings,
    playoffRounds,
    championId,
    mvp: pickMvp(mvpGames),
    finalsMvp: playoffRounds.length > 0 ? pickFinalsMvp(playoffRounds.at(-1)!, championId) : null,
  };
}

// ---------------------------------------------------------------------------
// Regular season
// ---------------------------------------------------------------------------

/** Round-robin schedule (circle method). `null` marks a bye when the count is odd. */
export function roundRobin(ids: string[]): Array<Array<[string, string]>> {
  const teams: Array<string | null> = ids.length % 2 === 0 ? [...ids] : [...ids, null];
  const rounds: Array<Array<[string, string]>> = [];

  for (let round = 0; round < teams.length - 1; round++) {
    const pairs: Array<[string, string]> = [];
    for (let i = 0; i < teams.length / 2; i++) {
      const a = teams[i];
      const b = teams[teams.length - 1 - i];
      if (a && b) pairs.push(round % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    teams.splice(1, 0, teams.pop()!);
  }
  return rounds;
}

function playSeason(ids: string[], play: (home: string, away: string) => GameResult, rng: Rng): SeasonRound[] {
  const order = shuffle(ids, rng);
  const firstLeg = roundRobin(order);
  const schedule =
    ids.length <= DOUBLE_ROUND_ROBIN_MAX_TEAMS
      ? [...firstLeg, ...firstLeg.map((round) => round.map(([home, away]) => [away, home] as [string, string]))]
      : firstLeg;

  return schedule.map((pairs) => {
    const playing = new Set(pairs.flat());
    return {
      games: pairs.map(([home, away]) => play(home, away)),
      byeId: ids.find((id) => !playing.has(id)) ?? null,
    };
  });
}

/** Standings after the given rounds: wins, then point differential, then points scored. */
export function standingsAfter(ids: string[], rounds: SeasonRound[]): Standing[] {
  const table = new Map<string, Standing>(
    ids.map((id) => [id, { coachId: id, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 }]),
  );
  for (const game of rounds.flatMap((round) => round.games)) {
    const home = table.get(game.homeId)!;
    const away = table.get(game.awayId)!;
    home.pointsFor += game.homeScore;
    home.pointsAgainst += game.awayScore;
    away.pointsFor += game.awayScore;
    away.pointsAgainst += game.homeScore;
    if (game.winnerId === game.homeId) {
      home.wins += 1;
      away.losses += 1;
    } else {
      away.wins += 1;
      home.losses += 1;
    }
  }
  const diff = (s: Standing) => s.pointsFor - s.pointsAgainst;
  return [...table.values()].sort((a, b) => b.wins - a.wins || diff(b) - diff(a) || b.pointsFor - a.pointsFor);
}

// ---------------------------------------------------------------------------
// Playoffs
// ---------------------------------------------------------------------------

/** Seed order of a standard bracket, e.g. 8 → [1, 8, 4, 5, 2, 7, 3, 6]. */
export function bracketOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const next = order.length * 2 + 1;
    order = order.flatMap((seed) => [seed, next - seed]);
  }
  return order;
}

function playPlayoffs(
  seeds: Seed[],
  seriesLength: number,
  play: (home: string, away: string) => GameResult,
): PlayoffRound[] {
  const size = Math.pow(2, Math.ceil(Math.log2(Math.max(2, seeds.length))));
  const bySeed = new Map(seeds.map((s) => [s.seed, s]));
  let entrants: Array<Seed | null> = bracketOrder(size).map((seed) => bySeed.get(seed) ?? null);

  const rounds: PlayoffRound[] = [];
  while (entrants.length > 1) {
    const series: Series[] = [];
    for (let i = 0; i < entrants.length; i += 2) {
      const [a, b] = [entrants[i], entrants[i + 1]];
      if (!a && !b) continue;
      const high = !b || (a && a.seed < b.seed) ? a! : b;
      const low = high === a ? b : a;
      series.push(playSeries(high, low, seriesLength, play));
    }
    rounds.push({ series });
    entrants = series.map((s) => (s.winnerId === s.high.coachId ? s.high : s.low!));
  }
  return rounds;
}

function playSeries(
  high: Seed,
  low: Seed | null,
  length: number,
  play: (home: string, away: string) => GameResult,
): Series {
  if (!low) return { high, low: null, games: [], highWins: 0, lowWins: 0, winnerId: high.coachId };

  const needed = Math.ceil(length / 2);
  const games: GameResult[] = [];
  let highWins = 0;
  let lowWins = 0;
  while (highWins < needed && lowWins < needed) {
    // Higher seed hosts games 1, 2, 5, 7 (NBA 2-2-1-1-1).
    const gameNumber = games.length + 1;
    const highHosts = [1, 2, 5, 7].includes(gameNumber);
    const game = highHosts ? play(high.coachId, low.coachId) : play(low.coachId, high.coachId);
    games.push(game);
    if (game.winnerId === high.coachId) highWins += 1;
    else lowWins += 1;
  }
  return { high, low, games, highWins, lowWins, winnerId: highWins > lowWins ? high.coachId : low.coachId };
}

// ---------------------------------------------------------------------------
// Awards
// ---------------------------------------------------------------------------

export function playerStats(games: GameResult[]): PlayerSeasonStats[] {
  const stats = new Map<string, PlayerSeasonStats>();
  for (const game of games) {
    for (const [coachId, lines] of Object.entries(game.box)) {
      for (const line of lines) {
        const current = stats.get(line.playerId) ?? {
          playerId: line.playerId,
          coachId,
          games: 0,
          points: 0,
          rebounds: 0,
          assists: 0,
        };
        current.games += 1;
        current.points += line.points;
        current.rebounds += line.rebounds;
        current.assists += line.assists;
        stats.set(line.playerId, current);
      }
    }
  }
  return [...stats.values()];
}

/** All-around impact per game: points + 1.2 × rebounds + 1.5 × assists. */
function impact(stats: PlayerSeasonStats): number {
  return (stats.points + 1.2 * stats.rebounds + 1.5 * stats.assists) / stats.games;
}

/** MVP: best per-game impact over the given games. */
function pickMvp(games: GameResult[]): PlayerSeasonStats | null {
  return playerStats(games).sort((a, b) => impact(b) - impact(a))[0] ?? null;
}

/** Finals MVP: like the NBA, the best player of the team that won the finals. */
function pickFinalsMvp(finals: PlayoffRound, championId: string): PlayerSeasonStats | null {
  const games = finals.series.flatMap((series) => series.games);
  const champions = playerStats(games).filter((stats) => stats.coachId === championId);
  return champions.sort((a, b) => impact(b) - impact(a))[0] ?? null;
}
