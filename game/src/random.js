// A small seeded random generator (mulberry32) plus the helpers the
// world uses. Every roll the simulation makes comes from one of these,
// so a fixed seed replays the same waves, the same spawns and the same
// screenshot — the game never reads Math.random for gameplay.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Roll in [min, max). */
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

/** Pick one element of an array. */
export function pick(rng, array) {
  return array[Math.floor(rng() * array.length)];
}

/** A point on a circle of `radius` around `cx, cy`, at a random angle. */
export function ringPoint(rng, cx, cy, radius) {
  const angle = rng() * Math.PI * 2;
  return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
}
