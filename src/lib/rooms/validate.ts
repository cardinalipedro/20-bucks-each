import type { TournamentSettings } from '../sim/types';
import { MAX_COACHES, MAX_NAME_LENGTH, MIN_COACHES, type RoomSettings } from './types';

/** Data from clients is untrusted: everything is checked before use. */

export function cleanName(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const name = input.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
  return name.length > 0 ? name : null;
}

export function cleanToken(input: unknown): string | null {
  return typeof input === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(input) ? input : null;
}

export function cleanCode(input: unknown): string | null {
  return typeof input === 'string' && /^[A-Z0-9]{4,8}$/.test(input.toUpperCase()) ? input.toUpperCase() : null;
}

function oneOf<T>(value: unknown, options: readonly T[]): T | null {
  return options.includes(value as T) ? (value as T) : null;
}

export function cleanSettings(input: unknown): RoomSettings | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  const tournamentRaw = (raw.tournament ?? {}) as Record<string, unknown>;

  const maxCoaches = Number(raw.maxCoaches);
  if (!Number.isInteger(maxCoaches) || maxCoaches < MIN_COACHES || maxCoaches > MAX_COACHES) return null;

  const visibility = oneOf(raw.visibility, ['public', 'private'] as const);
  const benchSize = oneOf(raw.benchSize, [0, 2] as const);
  const bidSeconds = oneOf(raw.bidSeconds, [10, 15, 20] as const);
  const format = oneOf(tournamentRaw.format, ['seasonAndPlayoffs', 'seasonOnly', 'playoffsOnly'] as const);
  const playoffTeams = oneOf(tournamentRaw.playoffTeams, [4, 8] as const);
  const seriesLength = oneOf(tournamentRaw.seriesLength, [1, 3, 7] as const);
  if (
    visibility === null ||
    benchSize === null ||
    bidSeconds === null ||
    format === null ||
    playoffTeams === null ||
    seriesLength === null ||
    typeof raw.fillWithBots !== 'boolean'
  ) {
    return null;
  }

  const tournament: TournamentSettings = { format, playoffTeams, seriesLength };
  return { visibility, maxCoaches, fillWithBots: raw.fillWithBots, benchSize, bidSeconds, tournament };
}
