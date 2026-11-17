import type { Rng } from '@/domain/shared/rng';

/** Share of the result decided by team strength. The rest is luck (a coin flip). */
export const SKILL_WEIGHT = 0.65;

/** Rating points that make the stronger team a ~73% favorite on strength alone. */
const STRENGTH_SCALE = 3;

/**
 * Chance that team A beats team B.
 * 65% comes from the rating gap (logistic curve), 35% is a pure 50/50.
 */
export function winProbability(ratingA: number, ratingB: number): number {
  const fromStrength = 1 / (1 + Math.exp(-(ratingA - ratingB) / STRENGTH_SCALE));
  return SKILL_WEIGHT * fromStrength + (1 - SKILL_WEIGHT) * 0.5;
}

/** Standard normal sample (Box–Muller). */
export function normal(rng: Rng): number {
  const u = Math.max(rng.next(), 1e-12);
  const v = rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Inverse of the standard normal CDF (Acklam's approximation, error < 1e-8).
 * Used to turn a win probability into an expected point margin.
 */
export function inverseNormalCdf(p: number): number {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const low = 0.02425;

  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - low) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}
