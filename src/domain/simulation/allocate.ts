/** Splits an integer total by weights, keeping the exact sum (largest remainder). */
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return weights.map((_, index) => (index === 0 ? total : 0));
  const raw = weights.map((w) => (w / sum) * total);
  const result = raw.map(Math.floor);
  let remainder = total - result.reduce((a, b) => a + b, 0);
  const order = raw.map((value, index) => ({ index, fraction: value - Math.floor(value) })).sort((a, b) => b.fraction - a.fraction);
  for (const { index } of order) {
    if (remainder <= 0) break;
    result[index] += 1;
    remainder -= 1;
  }
  return result;
}
