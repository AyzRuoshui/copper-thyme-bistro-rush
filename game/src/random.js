/**
 * Deterministic seeded PRNG (Mulberry32) so kitchen shifts and tests are reproducible.
 */
export function createSeededRng(seed = 20261125) {
  let state = seed >>> 0;
  return function nextRandom() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Pick one element uniformly from a non-empty array using `rng`.
 */
export function pickFrom(items, rng) {
  return items[Math.floor(rng() * items.length)];
}
