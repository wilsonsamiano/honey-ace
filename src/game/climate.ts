import { mulberry32, pick } from "./rng";

export type Season = "spring" | "summer" | "autumn" | "winter";
export type Weather =
  | "clear"
  | "breeze"
  | "blossom"
  | "rain"
  | "storm"
  | "heat"
  | "leaves"
  | "fog"
  | "snow"
  | "blizzard";
export type Terrain = "meadow" | "orchard" | "coast" | "woods" | "canyon" | "town" | "dunes" | "peaks";

export type Climate = {
  season: Season;
  weather: Weather;
  terrain: Terrain;
  seasonTitle: string;
  weatherTitle: string;
  terrainTitle: string;
  label: string;
  skyTop: number;
  skyBot: number;
  hills: number;
  cloud: number;
  spark: number;
  fog: number;
  fogTint: number;
  wind: number;
  flake: "none" | "rain" | "snow" | "petal" | "leaf" | "pollen";
  flakeTint: number;
  flakeFreq: number;
  flakeVy: number;
  flakeVx: number;
  flakeLife: number;
  flakeMax: number;
  flakeScale: number;
  cloudVy: number;
  lightning: boolean;
  landKey: string;
  midKey: string;
  propKey: string;
  landH: number;
  midH: number;
  landTint: number;
  midTint: number;
  propTint: number;
};

const SEASONS: Season[] = ["spring", "summer", "autumn", "winter"];

const SEASON_TITLE: Record<Season, string> = {
  spring: "Spring",
  summer: "Summer",
  autumn: "Autumn",
  winter: "Winter",
};

const WEATHER_TITLE: Record<Weather, string> = {
  clear: "Clear",
  breeze: "Breeze",
  blossom: "Petals",
  rain: "Rain",
  storm: "Storm",
  heat: "Haze",
  leaves: "Leaves",
  fog: "Mist",
  snow: "Snow",
  blizzard: "Blizzard",
};

const TERRAIN_TITLE: Record<Terrain, string> = {
  meadow: "Meadow",
  orchard: "Orchard",
  coast: "Coast",
  woods: "Woods",
  canyon: "Canyon",
  town: "Town",
  dunes: "Dunes",
  peaks: "Peaks",
};

const TERRAIN_ORDER: Terrain[] = ["meadow", "orchard", "coast", "woods", "canyon", "town", "dunes", "peaks"];

const BY_SEASON: Record<Season, Weather[]> = {
  spring: ["clear", "breeze", "blossom", "rain"],
  summer: ["clear", "heat", "breeze", "storm"],
  autumn: ["clear", "leaves", "fog", "rain"],
  winter: ["clear", "snow", "fog", "blizzard"],
};

const BOSS_WEATHER: Record<Season, Weather> = {
  spring: "storm",
  summer: "storm",
  autumn: "fog",
  winter: "blizzard",
};

const BOSS_TERRAIN: Record<Season, Terrain> = {
  spring: "orchard",
  summer: "canyon",
  autumn: "woods",
  winter: "peaks",
};

type LandSpec = {
  landKey: string;
  midKey: string;
  propKey: string;
  landH: number;
  midH: number;
  landTint: number;
  midTint: number;
  propTint: number;
  skyBot: number;
};

const LAND: Record<Terrain, LandSpec> = {
  meadow: {
    landKey: "land-meadow",
    midKey: "mid-flowers",
    propKey: "prop-tree",
    landH: 96,
    midH: 70,
    landTint: 0xffffff,
    midTint: 0xffffff,
    propTint: 0xb6f0c4,
    skyBot: 0xd8f5b8,
  },
  orchard: {
    landKey: "land-orchard",
    midKey: "mid-trees",
    propKey: "prop-bloom",
    landH: 100,
    midH: 110,
    landTint: 0xffffff,
    midTint: 0xffffff,
    propTint: 0xffc4e0,
    skyBot: 0xf7c6de,
  },
  coast: {
    landKey: "land-coast",
    midKey: "mid-waves",
    propKey: "prop-sail",
    landH: 88,
    midH: 56,
    landTint: 0xffffff,
    midTint: 0xffffff,
    propTint: 0xfff6e8,
    skyBot: 0x7ec8e8,
  },
  woods: {
    landKey: "land-woods",
    midKey: "mid-pines",
    propKey: "prop-pine",
    landH: 110,
    midH: 140,
    landTint: 0xffffff,
    midTint: 0xffffff,
    propTint: 0x3d9a5a,
    skyBot: 0x8fbf90,
  },
  canyon: {
    landKey: "land-canyon",
    midKey: "mid-mesas",
    propKey: "prop-mesa",
    landH: 120,
    midH: 150,
    landTint: 0xffffff,
    midTint: 0xffffff,
    propTint: 0xe08a3c,
    skyBot: 0xf0a060,
  },
  town: {
    landKey: "land-town",
    midKey: "mid-roofs",
    propKey: "prop-house",
    landH: 100,
    midH: 92,
    landTint: 0xffffff,
    midTint: 0xffffff,
    propTint: 0xe24b5a,
    skyBot: 0xe8d0a8,
  },
  dunes: {
    landKey: "land-dunes",
    midKey: "mid-dunes",
    propKey: "prop-cactus",
    landH: 92,
    midH: 80,
    landTint: 0xffffff,
    midTint: 0xffffff,
    propTint: 0x3d9a5a,
    skyBot: 0xf5d08a,
  },
  peaks: {
    landKey: "land-peaks",
    midKey: "mid-peaks",
    propKey: "prop-peak",
    landH: 130,
    midH: 170,
    landTint: 0xffffff,
    midTint: 0xffffff,
    propTint: 0xeef6ff,
    skyBot: 0xc8d8f0,
  },
};

const SEASON_LAND: Record<Season, number> = {
  spring: 0xfff0f6,
  summer: 0xffffff,
  autumn: 0xffd0a0,
  winter: 0xe4f0ff,
};

export function seasonFor(level: number): Season {
  return SEASONS[Math.floor((Math.max(1, level) - 1) / 4) % 4]!;
}

export function terrainFor(level: number): Terrain {
  const season = seasonFor(level);
  if (level % 10 === 0) return BOSS_TERRAIN[season];
  const block = Math.floor((Math.max(1, level) - 1) / 2);
  return TERRAIN_ORDER[block % TERRAIN_ORDER.length]!;
}

export function climateFor(level: number, seed: number): Climate {
  const season = seasonFor(level);
  const weatherBlock = Math.floor((Math.max(1, level) - 1) / 3);
  const rng = mulberry32((seed ^ (weatherBlock * 7919) ^ season.charCodeAt(0)) >>> 0);
  const weather = level % 10 === 0 ? BOSS_WEATHER[season] : pick(rng, BY_SEASON[season]);
  const terrain = terrainFor(level);
  return pack(season, weather, terrain);
}

export function flakeTexture(flake: Climate["flake"]) {
  if (flake === "rain") return "wx-rain";
  if (flake === "petal") return "wx-petal";
  if (flake === "leaf") return "wx-leaf";
  if (flake === "pollen") return "pollen";
  return "wx-snow";
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function mixColor(a: number, b: number, t: number) {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}

export function easeClimate(t: number) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

export function mixClimate(from: Climate, to: Climate, t: number): Climate {
  const u = easeClimate(t);
  const late = u >= 0.55;
  const flakeFade = u < 0.45 ? 1 - u / 0.45 : u > 0.55 ? (u - 0.55) / 0.45 : 0;
  const flakeSrc = late ? to : from;
  return {
    ...flakeSrc,
    season: late ? to.season : from.season,
    weather: late ? to.weather : from.weather,
    terrain: late ? to.terrain : from.terrain,
    seasonTitle: late ? to.seasonTitle : from.seasonTitle,
    weatherTitle: late ? to.weatherTitle : from.weatherTitle,
    terrainTitle: late ? to.terrainTitle : from.terrainTitle,
    label: late ? to.label : from.label,
    skyTop: mixColor(from.skyTop, to.skyTop, u),
    skyBot: mixColor(from.skyBot, to.skyBot, u),
    hills: mixColor(from.hills, to.hills, u),
    cloud: mixColor(from.cloud, to.cloud, u),
    spark: mixColor(from.spark, to.spark, u),
    fog: lerp(from.fog, to.fog, u),
    fogTint: mixColor(from.fogTint, to.fogTint, u),
    wind: lerp(from.wind, to.wind, u),
    flake: flakeSrc.flake,
    flakeTint: mixColor(from.flakeTint, to.flakeTint, u),
    flakeFreq: flakeSrc.flakeFreq * flakeFade,
    flakeVy: lerp(from.flakeVy, to.flakeVy, u),
    flakeVx: lerp(from.flakeVx, to.flakeVx, u),
    flakeLife: lerp(from.flakeLife, to.flakeLife, u),
    flakeMax: Math.round(lerp(from.flakeMax, to.flakeMax, u)),
    flakeScale: lerp(from.flakeScale, to.flakeScale, u),
    cloudVy: lerp(from.cloudVy, to.cloudVy, u),
    lightning: u > 0.62 ? to.lightning : false,
    landKey: late ? to.landKey : from.landKey,
    midKey: late ? to.midKey : from.midKey,
    propKey: late ? to.propKey : from.propKey,
    landH: lerp(from.landH, to.landH, u),
    midH: lerp(from.midH, to.midH, u),
    landTint: mixColor(from.landTint, to.landTint, u),
    midTint: mixColor(from.midTint, to.midTint, u),
    propTint: mixColor(from.propTint, to.propTint, u),
  };
}

function pack(season: Season, weather: Weather, terrain: Terrain): Climate {
  const base = BASE[season];
  const wx = WX[weather];
  const land = LAND[terrain];
  const seasonTint = SEASON_LAND[season];
  return {
    season,
    weather,
    terrain,
    seasonTitle: SEASON_TITLE[season],
    weatherTitle: WEATHER_TITLE[weather],
    terrainTitle: TERRAIN_TITLE[terrain],
    label: `${SEASON_TITLE[season]} · ${TERRAIN_TITLE[terrain]} · ${WEATHER_TITLE[weather]}`,
    skyTop: wx.skyTop ?? base.skyTop,
    skyBot: wx.skyBot ?? land.skyBot ?? base.skyBot,
    hills: wx.hills ?? seasonTint,
    cloud: wx.cloud ?? base.cloud,
    spark: wx.spark ?? base.spark,
    fog: wx.fog ?? 0,
    fogTint: wx.fogTint ?? 0xf4fbff,
    wind: wx.wind ?? base.wind,
    flake: wx.flake ?? "none",
    flakeTint: wx.flakeTint ?? 0xffffff,
    flakeFreq: wx.flakeFreq ?? 0,
    flakeVy: wx.flakeVy ?? 90,
    flakeVx: wx.flakeVx ?? 0,
    flakeLife: wx.flakeLife ?? 2200,
    flakeMax: wx.flakeMax ?? 28,
    flakeScale: wx.flakeScale ?? 0.8,
    cloudVy: wx.cloudVy ?? 22,
    lightning: weather === "storm",
    landKey: land.landKey,
    midKey: land.midKey,
    propKey: land.propKey,
    landH: land.landH,
    midH: land.midH,
    landTint: land.landTint,
    midTint: land.midTint,
    propTint: land.propTint,
  };
}

type PartialWx = Partial<Climate>;

const BASE: Record<Season, Pick<Climate, "skyTop" | "skyBot" | "hills" | "cloud" | "spark" | "wind">> = {
  spring: { skyTop: 0x8fd7f4, skyBot: 0xf7c6de, hills: 0xb6f0c4, cloud: 0xfff6e8, spark: 0xffc4e0, wind: 18 },
  summer: { skyTop: 0x6ec8f5, skyBot: 0xc8f4a8, hills: 0xffffff, cloud: 0xffffff, spark: 0xfff6e8, wind: 12 },
  autumn: { skyTop: 0xf0b27a, skyBot: 0xf8e0a8, hills: 0xffb060, cloud: 0xffe6c4, spark: 0xffc14d, wind: 28 },
  winter: { skyTop: 0xb9d4ea, skyBot: 0xeef6ff, hills: 0xd7ecff, cloud: 0xf4fbff, spark: 0xffffff, wind: 24 },
};

const WX: Record<Weather, PartialWx> = {
  clear: { flake: "none", fog: 0, flakeFreq: 0 },
  breeze: { flake: "none", wind: 42, cloudVy: 38, fog: 0.04 },
  blossom: {
    flake: "petal",
    flakeTint: 0xffc4e0,
    flakeFreq: 90,
    flakeVy: 46,
    flakeVx: -18,
    flakeLife: 2800,
    flakeMax: 22,
    flakeScale: 0.9,
    spark: 0xffc4e0,
  },
  rain: {
    skyTop: 0x6a92b4,
    skyBot: 0x9eb8c8,
    flake: "rain",
    flakeTint: 0xcfe8ff,
    flakeFreq: 28,
    flakeVy: 280,
    flakeVx: -30,
    flakeLife: 900,
    flakeMax: 48,
    flakeScale: 0.7,
    fog: 0.1,
    cloud: 0xc8d4de,
    cloudVy: 40,
  },
  storm: {
    skyTop: 0x3f5a78,
    skyBot: 0x6d8498,
    flake: "rain",
    flakeTint: 0xb8d4ee,
    flakeFreq: 16,
    flakeVy: 380,
    flakeVx: -70,
    flakeLife: 700,
    flakeMax: 64,
    flakeScale: 0.85,
    fog: 0.16,
    fogTint: 0x4a6078,
    cloud: 0x8aa0b4,
    cloudVy: 55,
    hills: 0x9ec4a0,
  },
  heat: {
    skyTop: 0x5eb6f0,
    skyBot: 0xffe08a,
    flake: "pollen",
    flakeTint: 0xffe08a,
    flakeFreq: 110,
    flakeVy: 22,
    flakeVx: 12,
    flakeLife: 2600,
    flakeMax: 16,
    flakeScale: 0.7,
    fog: 0.08,
    fogTint: 0xffe08a,
  },
  leaves: {
    flake: "leaf",
    flakeTint: 0xe08a3c,
    flakeFreq: 80,
    flakeVy: 52,
    flakeVx: -28,
    flakeLife: 3000,
    flakeMax: 24,
    flakeScale: 1,
    spark: 0xffc14d,
  },
  fog: {
    fog: 0.28,
    fogTint: 0xe8f0f6,
    flake: "none",
    cloud: 0xe8eef4,
    spark: 0xffffff,
    cloudVy: 14,
  },
  snow: {
    flake: "snow",
    flakeTint: 0xffffff,
    flakeFreq: 55,
    flakeVy: 42,
    flakeVx: -12,
    flakeLife: 3200,
    flakeMax: 36,
    flakeScale: 0.85,
    fog: 0.1,
  },
  blizzard: {
    skyTop: 0x8aa8c4,
    skyBot: 0xd5e6f4,
    flake: "snow",
    flakeTint: 0xffffff,
    flakeFreq: 18,
    flakeVy: 140,
    flakeVx: -90,
    flakeLife: 1400,
    flakeMax: 70,
    flakeScale: 0.9,
    fog: 0.22,
    cloudVy: 48,
  },
};
