export function xmur3(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;

export function randRange(rng: Rng, a: number, b: number) {
  return a + rng() * (b - a);
}

export function randInt(rng: Rng, a: number, b: number) {
  return Math.floor(randRange(rng, a, b + 1));
}

export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)] as T;
}

export function chance(rng: Rng, p: number) {
  return rng() < p;
}

export function seedLabel(seed: number) {
  return seed.toString(16).toUpperCase().padStart(8, "0").slice(0, 6);
}

export function freshRunSeed() {
  const n = (Date.now() ^ Math.imul(performance.now() | 0, 0x85ebca6b)) >>> 0;
  return n || 1;
}
