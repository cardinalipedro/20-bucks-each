import { stepGames } from '@/domain/simulation/tournament';
import type { TournamentView } from '@/domain/simulation/types';

/** Live games reveal one period (quarter or overtime) this often. */
export const PERIOD_REVEAL_MS = 800;

/** Slack for network latency, so slow connections still see the end of the game. */
const PLAYBACK_MARGIN_MS = 1_000;

/**
 * How long the screen keeps playing the last step before everyone has seen it
 * all: the longest live game of that step. Nothing to play before the first step.
 */
export function lastStepPlaybackMs(tournament: TournamentView): number {
  const step = tournament.steps.at(-1);
  if (!step) return 0;
  const longest = Math.max(0, ...stepGames(tournament, step).map((game) => game.periods.length));
  return longest === 0 ? 0 : longest * PERIOD_REVEAL_MS + PLAYBACK_MARGIN_MS;
}
