import type { GameEvent, GameResult } from './types';

/** A player scoring at least this much in one period is called out. */
const HOT_PERIOD_POINTS = 11;
/** A team winning a period by this much is called out. */
const BIG_PERIOD_MARGIN = 10;
const CLOSE_FINISH_MARGIN = 4;
const BLOWOUT_MARGIN = 20;

/**
 * Turns a finished game into a short list of highlights, in order. Each
 * highlight carries the period it belongs to, so the live view can reveal
 * them as the game is played.
 */
export function gameEvents(game: Omit<GameResult, 'events'>): GameEvent[] {
  const events: GameEvent[] = [];
  const teams = [game.homeId, game.awayId] as const;
  let home = 0;
  let away = 0;
  let leader: string | null = null;
  let leaderAfterThird: string | null = null;
  let deficitAfterThird = 0;

  game.periods.forEach(([homePoints, awayPoints], index) => {
    const period = index + 1;
    home += homePoints;
    away += awayPoints;

    if (period === 5) events.push({ kind: 'overtime', period, score: [home - homePoints, away - awayPoints] });

    // Best scorer of the period, if he had a big one.
    let hot: { coachId: string; playerId: string; points: number } | null = null;
    for (const coachId of teams) {
      for (const line of game.box[coachId]) {
        const points = line.periodPoints[index] ?? 0;
        if (points >= HOT_PERIOD_POINTS && (!hot || points > hot.points)) hot = { coachId, playerId: line.playerId, points };
      }
    }
    if (hot) events.push({ kind: 'hotPeriod', period, ...hot });

    const periodMargin = homePoints - awayPoints;
    if (Math.abs(periodMargin) >= BIG_PERIOD_MARGIN) {
      events.push({ kind: 'bigPeriod', period, coachId: periodMargin > 0 ? game.homeId : game.awayId, margin: Math.abs(periodMargin) });
    }

    const nowLeading = home === away ? null : home > away ? game.homeId : game.awayId;
    if (nowLeading && leader && nowLeading !== leader) {
      events.push({ kind: 'leadChange', period, coachId: nowLeading, score: [home, away] });
    }
    if (nowLeading) leader = nowLeading;
    if (period === 3) {
      leaderAfterThird = nowLeading;
      deficitAfterThird = Math.abs(home - away);
    }
  });

  const last = game.periods.length;
  const margin = Math.abs(game.homeScore - game.awayScore);
  if (leaderAfterThird && leaderAfterThird !== game.winnerId) {
    events.push({ kind: 'comeback', period: last, coachId: game.winnerId, deficit: deficitAfterThird });
  }
  if (last === 4 && margin <= CLOSE_FINISH_MARGIN) {
    events.push({ kind: 'closeFinish', period: last, coachId: game.winnerId, margin });
  }
  if (margin >= BLOWOUT_MARGIN) events.push({ kind: 'blowout', period: last, coachId: game.winnerId, margin });

  const best = teams
    .flatMap((coachId) => game.box[coachId].map((line) => ({ coachId, line })))
    .sort((a, b) => b.line.points - a.line.points)[0];
  if (best) {
    events.push({
      kind: 'gameHigh',
      period: last,
      coachId: best.coachId,
      playerId: best.line.playerId,
      points: best.line.points,
      rebounds: best.line.rebounds,
      assists: best.line.assists,
    });
  }
  return events;
}
