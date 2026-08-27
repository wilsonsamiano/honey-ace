import { create } from "zustand";
import { freshRunSeed, seedLabel } from "./rng";
import type { Season, Weather } from "./climate";

export type UpgradeId = "firepower" | "missiles" | "shields" | "speed" | "twin";
export type Phase = "menu" | "playing" | "paused" | "upgrade" | "gameover" | "victory";
export type Difficulty = "easy" | "normal" | "hard";

export type Stats = {
  firepower: number;
  missiles: number;
  shields: number;
  speed: number;
};

export const CAPS: Record<Exclude<UpgradeId, "twin">, number> = {
  firepower: 8,
  missiles: 6,
  shields: 8,
  speed: 6,
};

export const UPGRADES: {
  id: UpgradeId;
  title: string;
  blurb: string;
}[] = [
  { id: "firepower", title: "Firepower", blurb: "A hotter, tighter sting." },
  { id: "missiles", title: "Missiles", blurb: "Bee rockets that chase foes." },
  { id: "shields", title: "Shields", blurb: "Thicker hull and a repair." },
  { id: "speed", title: "Speed", blurb: "Zip the sky. Shots fly sooner." },
  { id: "twin", title: "Twin Bee", blurb: "A pink bee on your right. Second finger can fly it." },
];

export const TWIN_MAX = 1;

export function nextBlurb(id: UpgradeId, stats: Stats, twins: number): string {
  if (id === "twin") return twins ? "Already flying with you." : "Parks on your right. A second finger flies it.";
  const lv = stats[id];
  if (id === "firepower") {
    if (lv < 2) return "Quicker honey shots.";
    if (lv < 3) return "Tiny side shots join the stream.";
    if (lv < 6) return "The stream runs hotter.";
    return "A double core of bee-shot.";
  }
  if (id === "missiles") {
    if (lv < 1) return "Unlock a chasing rocket.";
    if (lv < 3) return "Rockets come more often.";
    if (lv < 5) return "A second rocket joins.";
    return "A small swarm of bees.";
  }
  if (id === "shields") return "Plus one hull and a little repair.";
  if (lv < 3) return "Faster keys, faster shots.";
  return "Even zipper. Missiles snap to targets.";
}

export function scoreMult(id: Difficulty) {
  if (id === "easy") return 0.5;
  if (id === "hard") return 2;
  return 1;
}

export function atCap(id: UpgradeId, stats: Stats, twins: number) {
  if (id === "twin") return twins >= TWIN_MAX;
  return stats[id] >= CAPS[id];
}

export const DIFFICULTIES: {
  id: Difficulty;
  title: string;
  blurb: string;
}[] = [
  { id: "easy", title: "Easy", blurb: "Kids' cabinet. Extra hull. Half score." },
  { id: "normal", title: "Normal", blurb: "The neighborhood arcade." },
  { id: "hard", title: "Hard", blurb: "Busy skies. Double score." },
];

const BEST_KEY = "honey-ace-best";
const DIFF_KEY = "honey-ace-rank";

function readBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY) || 0) || 0;
  } catch {
    return 0;
  }
}

function writeBest(n: number) {
  try {
    localStorage.setItem(BEST_KEY, String(n));
  } catch {
    /* ignore */
  }
}

function readDifficulty(): Difficulty {
  try {
    const v = localStorage.getItem(DIFF_KEY);
    if (v === "easy" || v === "normal" || v === "hard") return v;
  } catch {
    /* ignore */
  }
  return "normal";
}

function writeDifficulty(id: Difficulty) {
  try {
    localStorage.setItem(DIFF_KEY, id);
  } catch {
    /* ignore */
  }
}

type GameStore = {
  phase: Phase;
  level: number;
  score: number;
  best: number;
  hp: number;
  maxHp: number;
  spareHearts: number;
  stats: Stats;
  runSeed: number;
  seedCode: string;
  motif: string;
  twins: number;
  difficulty: Difficulty;
  bossName: string;
  bossHp: number;
  bossMax: number;
  season: Season;
  weather: Weather;
  climate: string;
  startRun: () => void;
  applyUpgrade: (id: UpgradeId) => void;
  setHud: (patch: Partial<Pick<GameStore, "hp" | "score" | "level" | "motif" | "season" | "weather" | "climate">>) => void;
  setPhase: (phase: Phase) => void;
  bumpScore: (n: number) => void;
  hitPlayer: () => boolean;
  heal: (n: number) => void;
  bankHearts: (n: number) => void;
  applySpareHearts: () => void;
  loseTwin: () => void;
  setDifficulty: (id: Difficulty) => void;
  setBoss: (name: string, hp: number, max: number) => void;
  clearBoss: () => void;
  togglePause: () => void;
  resume: () => void;
  quitToMenu: () => void;
};

function baseHp(difficulty: Difficulty) {
  if (difficulty === "easy") return 5;
  if (difficulty === "hard") return 3;
  return 3;
}

export function maxHpFrom(stats: Stats, difficulty: Difficulty = "normal") {
  return baseHp(difficulty) + stats.shields;
}

function fillFromSpare(hp: number, maxHp: number, spare: number) {
  const room = Math.max(0, maxHp - hp);
  const used = Math.min(room, Math.max(0, spare));
  return { hp: hp + used, spare: Math.max(0, spare) - used };
}

export const useGameStore = create<GameStore>((set, get) => ({
  phase: "menu",
  level: 1,
  score: 0,
  best: 0,
  hp: 3,
  maxHp: 3,
  spareHearts: 0,
  stats: { firepower: 1, missiles: 0, shields: 0, speed: 1 },
  runSeed: 1,
  seedCode: "000001",
  motif: "",
  twins: 0,
  difficulty: "normal",
  bossName: "",
  bossHp: 0,
  bossMax: 0,
  season: "spring",
  weather: "clear",
  climate: "Spring · Meadow · Clear",
  startRun: () => {
    const stats: Stats = { firepower: 1, missiles: 0, shields: 0, speed: 1 };
    const runSeed = freshRunSeed();
    const difficulty = get().difficulty;
    const maxHp = maxHpFrom(stats, difficulty);
    set({
      phase: "playing",
      level: 1,
      score: 0,
      hp: maxHp,
      maxHp,
      spareHearts: 0,
      stats,
      best: readBest(),
      runSeed,
      seedCode: seedLabel(runSeed),
      motif: "",
      twins: 0,
      bossName: "",
      bossHp: 0,
      bossMax: 0,
      season: "spring",
      weather: "clear",
      climate: "Spring · Meadow · Clear",
    });
  },
  applyUpgrade: (id) => {
    const keptHp = get().hp;
    const spare = get().spareHearts;
    if (id === "twin") {
      const filled = fillFromSpare(keptHp, get().maxHp, spare);
      set({
        twins: Math.min(TWIN_MAX, get().twins + 1),
        phase: "playing",
        level: get().level + 1,
        hp: filled.hp,
        spareHearts: filled.spare,
      });
      return;
    }
    const cur = get().stats[id];
    const stats = { ...get().stats, [id]: Math.min(CAPS[id], cur + 1) };
    const maxHp = maxHpFrom(stats, get().difficulty);
    const afterUpgrade = id === "shields" ? Math.min(maxHp, keptHp + 2) : Math.min(maxHp, keptHp);
    const filled = fillFromSpare(afterUpgrade, maxHp, spare);
    set({ stats, maxHp, hp: filled.hp, spareHearts: filled.spare, phase: "playing", level: get().level + 1 });
  },
  setHud: (patch) => set(patch),
  setPhase: (phase) => {
    if (phase === "gameover" || phase === "victory") {
      const { score, best } = get();
      if (score > best) {
        writeBest(score);
        set({ phase, best: score });
        return;
      }
    }
    set({ phase });
  },
  bumpScore: (n) => {
    const add = Math.round(n * scoreMult(get().difficulty));
    set({ score: get().score + add });
  },
  hitPlayer: () => {
    const hp = get().hp - 1;
    set({ hp });
    if (hp <= 0) {
      get().setPhase("gameover");
      return true;
    }
    return false;
  },
  heal: (n) => {
    if (n <= 0) return;
    const { hp, maxHp, spareHearts } = get();
    const room = Math.max(0, maxHp - hp);
    const used = Math.min(room, n);
    const extra = n - used;
    set({ hp: hp + used, spareHearts: spareHearts + extra });
  },
  bankHearts: (n) => {
    if (n <= 0) return;
    get().heal(n);
  },
  applySpareHearts: () => {
    const { hp, maxHp, spareHearts } = get();
    const filled = fillFromSpare(hp, maxHp, spareHearts);
    if (filled.hp === hp && filled.spare === spareHearts) return;
    set({ hp: filled.hp, spareHearts: filled.spare });
  },
  loseTwin: () => set({ twins: 0 }),
  setDifficulty: (id) => {
    writeDifficulty(id);
    set({ difficulty: id });
  },
  setBoss: (name, hp, max) => set({ bossName: name, bossHp: hp, bossMax: max }),
  clearBoss: () => set({ bossName: "", bossHp: 0, bossMax: 0 }),
  togglePause: () => {
    const { phase } = get();
    if (phase === "playing") set({ phase: "paused" });
    else if (phase === "paused") set({ phase: "playing" });
  },
  resume: () => {
    if (get().phase === "paused") set({ phase: "playing" });
  },
  quitToMenu: () =>
    set({
      phase: "menu",
      twins: 0,
      spareHearts: 0,
      bossName: "",
      bossHp: 0,
      bossMax: 0,
      motif: "",
    }),
}));

export function hydrateBest() {
  useGameStore.setState({ best: readBest(), difficulty: readDifficulty() });
}
