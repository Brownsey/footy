/**
 * Small, fast, deterministic randomness for the Monte-Carlo models.
 *
 * A fixed seed makes every simulation reproducible — identical inputs yield
 * identical forecasts run to run, matching the determinism the rest of the app
 * relies on.
 */

/** mulberry32 — a compact 32-bit PRNG returning a float in `[0, 1)`. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Draw a Poisson sample with mean `lambda` (Knuth's method). */
export function samplePoisson(lambda: number, random: () => number): number {
  const limit = Math.exp(-lambda);
  let count = 0;
  let product = 1;
  do {
    count += 1;
    product *= random();
  } while (product > limit);
  return count - 1;
}
