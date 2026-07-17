// Deterministic pseudo-random generator (Phase 3). A tiny, dependency-free
// mulberry32 PRNG so Brownian motion is REPRODUCIBLE in headless tests (same
// seed -> same trajectory). Not cryptographic; purely for simulation determinism.

/** @param {number} seed 32-bit integer seed */
export function makeRng(seed = 1) {
  let a = seed >>> 0;
  /** @returns {number} uniform in [0,1) */
  const next = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    /** uniform in [-1,1] */
    signed: () => next() * 2 - 1,
    /** approx standard normal via two uniforms (Box-Muller) */
    normal: () => {
      const u1 = Math.max(1e-9, next());
      const u2 = next();
      return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    },
  };
}

export default makeRng;
