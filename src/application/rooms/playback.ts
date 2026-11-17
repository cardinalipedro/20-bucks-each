import type { Tournament } from '@/domain/simulation/types';

/** Live games reveal one period (quarter or overtime) this often. */
export const PERIOD_REVEAL_MS = 800;

/** Slack for network latency, so slow connections still see the end of the game. */
const PLAYBACK_MARGIN_MS = 1_000;

/**
 * How long the screen of a step keeps playing before everyone has seen it all:
 * the longest live game of that round. Step 0 (auction results) and the awards
 * have nothing to play.
 */
export function stepPlaybackMs(tournament: Tournament, step: number): number {
  const seasonCount = tournament.seasonRounds.length;
  const playoffCount = tournament.playoffRounds.length;

  let periods: number[] = [];
  if (step >= 1 && step <= seasonCount) {
    periods = tournament.seasonRounds[step - 1].games.map((game) => game.periods.length);
  } else if (step > seasonCount && step <= seasonCount + playoffCount) {
    // In the playoffs each coach watches the last game of their series live.
    periods = tournament.playoffRounds[step - seasonCount - 1].series
      .map((series) => series.games.at(-1)?.periods.length ?? 0);
  }

  const longest = Math.max(0, ...periods);
  return longest === 0 ? 0 : longest * PERIOD_REVEAL_MS + PLAYBACK_MARGIN_MS;
}
