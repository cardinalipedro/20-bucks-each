import { POSITIONS, type Player, type Position, type SlotKind } from './types';

/**
 * A player can line up at their own positions or one step away on the
 * PG–SG–SF–PF–C scale (e.g. a SG can also play PG or SF), with a penalty.
 */
export function adjacentPositions(position: Position): Position[] {
  const index = POSITIONS.indexOf(position);
  return [POSITIONS[index - 1], POSITIONS[index + 1]].filter((p): p is Position => p !== undefined);
}

export function isNaturalPosition(player: Player, kind: SlotKind): boolean {
  return kind !== 'BENCH' && player.positions.includes(kind);
}

/** Starter positions this player is allowed to take: natural ones first, then neighbors. */
export function playablePositions(player: Player): Position[] {
  const neighbors = player.positions.flatMap(adjacentPositions);
  return [...new Set([...player.positions, ...neighbors])];
}

export function canPlaySlot(player: Player, kind: SlotKind): boolean {
  return kind === 'BENCH' || playablePositions(player).includes(kind);
}
