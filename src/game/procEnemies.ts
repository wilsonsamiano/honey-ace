import { chance, mulberry32, pick, randInt, randRange, type Rng } from "./rng";
import type { Difficulty } from "./store";

export type FodderBody = "bird" | "wasp" | "frog" | "pig" | "cat";
export type BossBody = "boss-owl" | "boss-queen" | "boss-whale" | "boss-peach" | "boss-mecha";
export type Body = FodderBody | BossBody;
export type Pattern = "sine" | "dive" | "hold" | "zigzag" | "spiral" | "strafe";
export type Fire = "none" | "down" | "aimed" | "spread" | "burst";

export type SpawnSpec = {
  x: number;
  delay: number;
  body: Body;
  pattern: Pattern;
  fire: Fire;
  tint: number;
  size: number;
  hp: number;
  vy: number;
  amp: number;
  shootPeriod: number;
  worth: number;
};

export type StagePlan = {
  waves: SpawnSpec[][];
  motif: string;
};

export const BOSS_CAST: { body: BossBody; title: string }[] = [
  { body: "boss-owl", title: "Owl Baron" },
  { body: "boss-queen", title: "Queen Buzz" },
  { body: "boss-whale", title: "Sky Whale" },
  { body: "boss-peach", title: "Peach Keep" },
  { body: "boss-mecha", title: "Solar Mecha" },
];

const UNLOCKS: { min: number; body: FodderBody; label: string }[] = [
  { min: 1, body: "bird", label: "Songbirds" },
  { min: 2, body: "wasp", label: "Wasps" },
  { min: 10, body: "frog", label: "Frog planes" },
  { min: 20, body: "pig", label: "Pig balloons" },
  { min: 30, body: "cat", label: "Cat fish" },
];

const TINTS = [0xffffff, 0xffd6e8, 0xd6f3ff, 0xfff1b8] as const;
const PATTERNS: Pattern[] = ["sine", "dive", "zigzag", "spiral", "strafe"];

export function isBossBody(body: Body): body is BossBody {
  return body.startsWith("boss-");
}

export function roster(level: number): FodderBody[] {
  return UNLOCKS.filter((u) => level >= u.min).map((u) => u.body);
}

export function newestMinion(level: number): FodderBody {
  const list = roster(level);
  return list[list.length - 1] ?? "bird";
}

export function bossForLevel(level: number) {
  const n = Math.floor(level / 10);
  if (n <= 0) return null;
  return BOSS_CAST[(n - 1) % BOSS_CAST.length];
}

const RANK = {
  easy: { hp: 0.62, fire: 0.55, period: 0.28, vy: 0.82, elite: 0.65 },
  normal: { hp: 1, fire: 1, period: 0, vy: 1, elite: 1 },
  hard: { hp: 1.4, fire: 1.35, period: -0.14, vy: 1.2, elite: 1.35 },
} as const;

function genome(rng: Rng, level: number, role: "fodder" | "elite" | "boss", forced?: Body, rank: Difficulty = "normal"): SpawnSpec {
  const unlocked = roster(level);
  const fresh = newestMinion(level);
  let body: Body;
  if (forced) body = forced;
  else if (role === "boss") body = bossForLevel(level)?.body ?? "boss-owl";
  else if (role === "elite") body = chance(rng, 0.55) ? fresh : pick(rng, unlocked);
  else body = chance(rng, 0.4) ? fresh : pick(rng, unlocked);

  const r = RANK[rank];
  const pattern: Pattern = isBossBody(body) ? "hold" : pick(rng, PATTERNS);
  let fire: Fire = "none";
  if (isBossBody(body)) fire = pick(rng, ["spread", "burst", "aimed"] as const);
  else if (role === "elite") fire = pick(rng, ["aimed", "down", "burst", "spread"] as const);
  else if (chance(rng, Math.min(0.85, (0.22 + level * 0.05) * r.fire))) {
    fire = level >= 6 && chance(rng, 0.35) ? "spread" : pick(rng, ["down", "aimed", "down"]);
  }

  const unique = body !== "bird" && body !== "wasp";
  const size = isBossBody(body) ? 118 : role === "elite" ? randInt(rng, 48, 62) : randInt(rng, 40, 52);
  const soak = Math.max(1, Math.round((1 + Math.floor(level * 0.9)) * r.hp));
  const hp = isBossBody(body)
    ? Math.round((96 + level * 18 + randInt(rng, 0, 16)) * r.hp)
    : role === "elite"
      ? soak * 2 + 2 + randInt(rng, 0, 2)
      : soak + (chance(rng, 0.35) ? 1 : 0);
  const vy = isBossBody(body)
    ? 34 * r.vy
    : role === "elite"
      ? (randRange(rng, 72, 108) + Math.min(level, 16) * 4) * r.vy
      : (randRange(rng, 58, 90) + Math.min(level, 18) * 5) * r.vy;

  return {
    x: 180,
    delay: 160,
    body,
    pattern,
    fire,
    tint: unique ? 0xffffff : pick(rng, TINTS),
    size,
    hp,
    vy,
    amp: randRange(rng, 48, 92) + level * 2.2,
    shootPeriod: Math.max(0.28, (isBossBody(body) ? 0.82 : role === "elite" ? 1.15 : 1.7) - level * 0.035 + r.period),
    worth: isBossBody(body) ? 4000 + level * 120 : role === "elite" ? 180 + hp * 22 : 70 + hp * 22,
  };
}

type Formation = "rain" | "chevron" | "wall" | "pincer" | "helix";

function place(formation: Formation, count: number, rng: Rng, width: number): { x: number; delay: number }[] {
  const slots: { x: number; delay: number }[] = [];
  const pad = 40;
  const span = Math.max(120, width - pad * 2);
  const midX = width / 2;
  const gap = Math.max(90, 230 - count * 6);
  if (formation === "wall") {
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      slots.push({ x: pad + t * span, delay: i === 0 ? 80 : 40 });
    }
  } else if (formation === "chevron") {
    for (let i = 0; i < count; i++) {
      const mid = (count - 1) / 2;
      const d = Math.abs(i - mid);
      slots.push({ x: midX + (i - mid) * 28, delay: 70 + d * 55 });
    }
  } else if (formation === "pincer") {
    for (let i = 0; i < count; i++) {
      const left = i % 2 === 0;
      slots.push({
        x: left ? pad + randRange(rng, 0, 36) : width - pad - randRange(rng, 0, 36),
        delay: 90 + Math.floor(i / 2) * 70,
      });
    }
  } else if (formation === "helix") {
    for (let i = 0; i < count; i++) {
      const t = i / Math.max(1, count - 1);
      slots.push({ x: midX + Math.sin(t * Math.PI * 3) * (span * 0.42), delay: 95 });
    }
  } else {
    for (let i = 0; i < count; i++) {
      slots.push({
        x: pad + ((i * 53 + randInt(rng, 0, 40)) % span),
        delay: randInt(rng, gap - 30, gap + 20),
      });
    }
  }
  return slots;
}

export function generateStage(runSeed: number, level: number, width = 360, rank: Difficulty = "normal"): StagePlan {
  const rng = mulberry32(runSeed ^ Math.imul(level + 1, 0x9e3779b9));
  const r = RANK[rank];
  const fresh = UNLOCKS.filter((u) => u.min <= level).at(-1);
  const boss = bossForLevel(level);
  const motif = level % 10 === 0 && boss ? `Boss · ${boss.title}` : fresh?.label ?? "Sky parade";
  const waveCount = Math.min(3 + Math.floor(level / 2), 8);
  const waves: SpawnSpec[][] = [];
  const forms: Formation[] = ["rain", "chevron", "wall", "pincer", "helix"];

  for (let w = 0; w < waveCount; w++) {
    const form = pick(rng, forms);
    const count = Math.min(4 + Math.floor(level * 0.55) + Math.floor(w / 2), 14);
    const eliteBias = Math.min(0.62, (0.1 + level * 0.028 + w * 0.03) * r.elite);
    const slots = place(form, count, rng, width);
    const wave: SpawnSpec[] = slots.map((slot, i) => {
      const role = chance(rng, eliteBias) ? "elite" : "fodder";
      const g = genome(rng, level, role, undefined, rank);
      g.x = slot.x;
      g.delay = slot.delay;
      if (i === 0) g.delay = Math.max(g.delay, 120);
      return g;
    });
    waves.push(wave);
  }

  if (level % 10 === 0 && boss) {
    const head = genome(rng, level, "boss", boss.body, rank);
    head.x = width / 2;
    head.delay = 320;
    const escorts: SpawnSpec[] = [head];
    const n = 2 + Math.min(3, Math.floor(level / 10));
    const minion = newestMinion(level);
    const inner = Math.max(80, width - 100);
    for (let i = 0; i < n; i++) {
      const e = genome(rng, level, "elite", minion, rank);
      e.x = 50 + i * (inner / Math.max(1, n - 1));
      e.delay = 90;
      e.pattern = pick(rng, ["sine", "strafe", "zigzag"]);
      escorts.push(e);
    }
    waves.push(escorts);
  }

  return { waves, motif };
}

export const ALL_BODIES: Body[] = [
  "bird",
  "wasp",
  "frog",
  "pig",
  "cat",
  "boss-owl",
  "boss-queen",
  "boss-whale",
  "boss-peach",
  "boss-mecha",
];
