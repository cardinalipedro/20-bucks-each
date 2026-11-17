import { createRng, shuffle, type Rng } from '@/domain/shared/rng';
import type { Coach, Player } from '@/domain/auction/types';
import { simulateGame } from './game';
import { bestTactic, DEFAULT_TACTIC, tacticBonus, teamProfile, type Tactic } from './tactics';
import { teamRating } from './strength';
import type {
  GameResult,
  PlayerSeasonStats,
  PlayoffRound,
  ScheduledRound,
  SeasonRound,
  Seed,
  Series,
  Standing,
  Tournament,
  TournamentSettings,
  TournamentStep,
  TournamentView,
} from './types';

/** Up to this many teams the regular season is played twice (home and away). */
const DOUBLE_ROUND_ROBIN_MAX_TEAMS = 6;

/** Higher seed hosts games 1, 2, 5 and 7 of a series (NBA 2-2-1-1-1). */
const HIGH_SEED_HOME_GAMES = [1, 2, 5, 7];

/** The teams as they are right now: rosters (lineups can change) and tactics. */
export interface Teams {
  coaches: Coach[];
  players: Record<string, Player>;
  /** Chosen tactics per coach. Missing: bots use their best fit, humans keep their last one. */
  tactics?: Record<string, Tactic>;
}

interface StartInput {
  coaches: Coach[];
  players: Record<string, Player>;
  settings: TournamentSettings;
  seed: number;
  tactics?: Record<string, Tactic>;
}

/** Sets up the competition (schedule, or the bracket without a season). Nothing is played yet. */
export function startTournament({ coaches, players, settings, seed, tactics = {} }: StartInput): Tournament {
  const rng = createRng(seed);
  const ids = coaches.map((coach) => coach.id);
  const hasSeason = settings.format !== 'playoffsOnly';
  const lineup = rate({ coaches, players, tactics }, {});

  const tournament: Tournament = {
    settings,
    coachIds: ids,
    schedule: hasSeason ? buildSchedule(ids, rng) : [],
    ...lineup,
    seasonRounds: [],
    standings: hasSeason ? standingsAfter(ids, []) : seedingByRating(ids, lineup.ratings),
    playoffRounds: [],
    steps: [],
    finished: false,
    championId: null,
    mvp: null,
    finalsMvp: null,
    rngState: rng.seed,
  };
  if (!hasSeason) tournament.playoffRounds = [firstPlayoffRound(tournament, ids.length)];
  return tournament;
}

/**
 * Plays the next step with the teams as they are now: a whole season round,
 * or the next game of every playoff series still open. Pure: returns a new state.
 */
export function playNextStep(tournament: Tournament, teams: Teams): Tournament {
  if (tournament.finished) return tournament;
  const rng = createRng(tournament.rngState);
  const lineup = rate(teams, tournament.tactics);
  const byId = Object.fromEntries(teams.coaches.map((coach) => [coach.id, coach]));
  const paces = Object.fromEntries(teams.coaches.map((coach) => [coach.id, lineup.tactics[coach.id].pace]));
  const offenses = Object.fromEntries(teams.coaches.map((coach) => [coach.id, lineup.tactics[coach.id].offense]));
  const play = (homeId: string, awayId: string) =>
    simulateGame(byId[homeId], byId[awayId], { players: teams.players, ratings: lineup.ratings, paces, offenses }, rng);

  const next: Tournament = { ...tournament, ...lineup };
  if (next.seasonRounds.length < next.schedule.length) playSeasonRound(next, play);
  else playPlayoffGame(next, play);

  next.rngState = rng.seed;
  if (next.finished) awardPrizes(next);
  return next;
}

/** Plays everything that is left with the same teams (solo "simulate all", tests). */
export function playToEnd(tournament: Tournament, teams: Teams): Tournament {
  let current = tournament;
  while (!current.finished) current = playNextStep(current, teams);
  return current;
}

/** Sets up and plays a whole competition at once. */
export function simulateTournament(input: StartInput): Tournament {
  return playToEnd(startTournament(input), input);
}

/** Whether this coach still has a game to play (and so a tactic to choose). */
export function hasNextGame(tournament: TournamentView, coachId: string): boolean {
  if (tournament.finished) return false;
  if (tournament.seasonRounds.length < tournament.schedule.length) return true;
  const round = tournament.playoffRounds.at(-1);
  return !!round?.series.some(
    (series) => series.low && series.winnerId === null && [series.high.coachId, series.low.coachId].includes(coachId),
  );
}

/** Games played in a given step. */
export function stepGames(tournament: TournamentView, step: TournamentStep): GameResult[] {
  if (step.kind === 'season') return tournament.seasonRounds[step.round]?.games ?? [];
  return (tournament.playoffRounds[step.round]?.series ?? []).flatMap((series) => series.games[step.game - 1] ?? []);
}

/**
 * The competition as it was before its last step: lets the screen hold back
 * results until your own game has been shown live.
 */
export function beforeLastStep(tournament: TournamentView): TournamentView {
  const last = tournament.steps.at(-1);
  if (!last) return tournament;
  const base = { ...tournament, steps: tournament.steps.slice(0, -1), finished: false, championId: null, mvp: null, finalsMvp: null };

  if (last.kind === 'season') {
    const seasonRounds = tournament.seasonRounds.slice(0, -1);
    return { ...base, seasonRounds, standings: standingsAfter(tournament.coachIds, seasonRounds), playoffRounds: [] };
  }

  const playoffRounds = tournament.playoffRounds.slice(0, last.round + 1).map((round, index) =>
    index < last.round ? round : { series: round.series.map((series) => rewindSeries(series, last.game - 1)) },
  );
  return { ...base, playoffRounds };
}

// ---------------------------------------------------------------------------
// Ratings
// ---------------------------------------------------------------------------

function rate(teams: Teams, previous: Record<string, Tactic>) {
  const { coaches, players, tactics = {} } = teams;
  const chosen: Record<string, Tactic> = Object.fromEntries(
    coaches.map((coach) => [
      coach.id,
      tactics[coach.id] ??
        (coach.isBot ? bestTactic(teamProfile(coach, players)) : previous[coach.id] ?? DEFAULT_TACTIC),
    ]),
  );
  const baseRatings = Object.fromEntries(coaches.map((coach) => [coach.id, teamRating(coach, players)]));
  const ratings = Object.fromEntries(
    coaches.map((coach) => [
      coach.id,
      Math.round((baseRatings[coach.id] + tacticBonus(teamProfile(coach, players), chosen[coach.id])) * 10) / 10,
    ]),
  );
  return { tactics: chosen, baseRatings, ratings };
}

function seedingByRating(ids: string[], ratings: Record<string, number>): Standing[] {
  return [...ids]
    .sort((a, b) => ratings[b] - ratings[a])
    .map((coachId) => ({ coachId, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 }));
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

function buildSchedule(ids: string[], rng: Rng): ScheduledRound[] {
  const firstLeg = roundRobin(shuffle(ids, rng));
  const rounds =
    ids.length <= DOUBLE_ROUND_ROBIN_MAX_TEAMS
      ? [...firstLeg, ...firstLeg.map((round) => round.map(([home, away]) => [away, home] as [string, string]))]
      : firstLeg;
  return rounds.map((pairs) => {
    const playing = new Set(pairs.flat());
    return { pairs, byeId: ids.find((id) => !playing.has(id)) ?? null };
  });
}

function playSeasonRound(tournament: Tournament, play: (home: string, away: string) => GameResult) {
  const index = tournament.seasonRounds.length;
  const scheduled = tournament.schedule[index];
  const round: SeasonRound = { games: scheduled.pairs.map(([home, away]) => play(home, away)), byeId: scheduled.byeId };
  tournament.seasonRounds = [...tournament.seasonRounds, round];
  tournament.standings = standingsAfter(tournament.coachIds, tournament.seasonRounds);
  tournament.steps = [...tournament.steps, { kind: 'season', round: index }];

  if (tournament.seasonRounds.length < tournament.schedule.length) return;
  // Season over: set up the bracket, or crown the leader.
  if (tournament.settings.format === 'seasonOnly') {
    tournament.finished = true;
    tournament.championId = tournament.standings[0].coachId;
  } else {
    const qualifiers = Math.min(tournament.settings.playoffTeams, tournament.coachIds.length);
    tournament.playoffRounds = [firstPlayoffRound(tournament, qualifiers)];
  }
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

function firstPlayoffRound(tournament: TournamentView, qualifiers: number): PlayoffRound {
  const seeds = tournament.standings.slice(0, qualifiers).map((standing, index) => ({ coachId: standing.coachId, seed: index + 1 }));
  const size = Math.pow(2, Math.ceil(Math.log2(Math.max(2, seeds.length))));
  const bySeed = new Map(seeds.map((seed) => [seed.seed, seed]));
  return pairUp(bracketOrder(size).map((seed) => bySeed.get(seed) ?? null));
}

/** Pairs neighbours of the bracket; a missing opponent is a bye (decided at once). */
function pairUp(entrants: Array<Seed | null>): PlayoffRound {
  const series: Series[] = [];
  for (let i = 0; i < entrants.length; i += 2) {
    const [a, b] = [entrants[i], entrants[i + 1]];
    if (!a && !b) continue;
    const high = !b || (a && a.seed < b.seed) ? a! : b;
    const low = high === a ? b : a;
    series.push({ high, low, games: [], highWins: 0, lowWins: 0, winnerId: low ? null : high.coachId });
  }
  return { series };
}

function playPlayoffGame(tournament: Tournament, play: (home: string, away: string) => GameResult) {
  const roundIndex = tournament.playoffRounds.length - 1;
  const round = tournament.playoffRounds[roundIndex];
  const needed = Math.ceil(tournament.settings.seriesLength / 2);
  const open = round.series.filter((series) => series.winnerId === null);
  const gameNumber = (open[0]?.games.length ?? 0) + 1;

  const series = round.series.map((current) => {
    if (current.winnerId !== null || !current.low) return current;
    const highHosts = HIGH_SEED_HOME_GAMES.includes(current.games.length + 1);
    const game = highHosts ? play(current.high.coachId, current.low.coachId) : play(current.low.coachId, current.high.coachId);
    const highWins = current.highWins + (game.winnerId === current.high.coachId ? 1 : 0);
    const lowWins = current.lowWins + (game.winnerId === current.low.coachId ? 1 : 0);
    const winnerId = highWins >= needed ? current.high.coachId : lowWins >= needed ? current.low.coachId : null;
    return { ...current, games: [...current.games, game], highWins, lowWins, winnerId };
  });

  const rounds = [...tournament.playoffRounds];
  rounds[roundIndex] = { series };
  tournament.steps = [...tournament.steps, { kind: 'playoffs', round: roundIndex, game: gameNumber }];

  if (series.some((s) => s.winnerId === null)) {
    tournament.playoffRounds = rounds;
    return;
  }
  if (series.length === 1) {
    tournament.playoffRounds = rounds;
    tournament.finished = true;
    tournament.championId = series[0].winnerId;
    return;
  }
  // Round over: the winners meet in the next one, keeping their seeds.
  const winners = series.map((s) => (s.winnerId === s.high.coachId ? s.high : s.low!));
  tournament.playoffRounds = [...rounds, pairUp(winners)];
}

function rewindSeries(series: Series, games: number): Series {
  if (!series.low || series.games.length <= games) return series;
  const kept = series.games.slice(0, games);
  const highWins = kept.filter((game) => game.winnerId === series.high.coachId).length;
  return { ...series, games: kept, highWins, lowWins: kept.length - highWins, winnerId: null };
}

function awardPrizes(tournament: Tournament) {
  const seasonGames = tournament.seasonRounds.flatMap((round) => round.games);
  const playoffGames = tournament.playoffRounds.flatMap((round) => round.series.flatMap((series) => series.games));
  tournament.mvp = pickMvp(seasonGames.length > 0 ? seasonGames : playoffGames);
  const finals = tournament.playoffRounds.at(-1);
  tournament.finalsMvp = finals && tournament.championId ? pickFinalsMvp(finals, tournament.championId) : null;
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

/** Who performed best over some games (a series, a season), best first. */
export function topPerformers(games: GameResult[], limit: number): PlayerSeasonStats[] {
  return playerStats(games)
    .sort((a, b) => impact(b) - impact(a))
    .slice(0, limit);
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
