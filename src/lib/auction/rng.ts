/**
 * Small seeded PRNG (mulberry32). Keeping the seed inside the game state
 * makes every engine function pure and the game reproducible in tests.
 */
export interface Rng {
  next(): number;
  between(min: number, max: number): number;
  readonly seed: number;
}

export function createRng(seed: number): Rng {
  let state = seed | 0;
  return {
    next() {
      state = (state + 0x6d2b79f5) | 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    between(min: number, max: number) {
      return min + this.next() * (max - min);
    },
    get seed() {
      return state;
    },
  };
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
