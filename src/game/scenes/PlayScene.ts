import * as Phaser from "phaser";
import { extraAims, input, pointer, pointerSteering, setKeys, twinKeys } from "../input";
import { sfx, startMusic } from "../audio";
import { probe } from "../probe";
import { TWIN_MAX, useGameStore } from "../store";
import { generateStage, isBossBody, ALL_BODIES, BOSS_CAST, type Fire, type Pattern, type SpawnSpec } from "../procEnemies";
import { climateFor, flakeTexture, mixClimate, type Climate } from "../climate";
import { H, W } from "../field";

type Enemy = Phaser.Physics.Arcade.Sprite & {
  kind?: SpawnSpec["body"];
  hp?: number;
  maxHp?: number;
  pattern?: Pattern;
  fire?: Fire;
  t?: number;
  shootAt?: number;
  amp?: number;
  shootPeriod?: number;
  worth?: number;
  baseTint?: number;
  burstLeft?: number;
  intro?: boolean;
  phase?: number;
  flash?: number;
};


function bossParkY() {
  return Math.max(196, Math.round(H * 0.33));
}

function bossCeilY() {
  return Math.max(176, Math.round(H * 0.29));
}

function fitBody(s: Phaser.Physics.Arcade.Sprite, world: number) {
  const body = s.body as Phaser.Physics.Arcade.Body | undefined;
  if (!body) return;
  const fw = s.frame?.width || 128;
  const fh = s.frame?.height || 128;
  const sx = Math.max(0.01, s.displayWidth / fw);
  const sy = Math.max(0.01, s.displayHeight / fh);
  body.setSize(world / sx, world / sy, true);
}

const AIM_LIFT_TOUCH = 59;
const AIM_LIFT_MOUSE = 12;
const KEY_SPEED = 340;

const TWIN_TINTS = [
  0xff8ec8, 0xffc4e0, 0xe1bee7, 0xffab91, 0xf8bbd0, 0xd1c4e9, 0xffccbc, 0xf48fb1, 0xce93d8, 0xffcdd2,
];

type Wing = Phaser.Physics.Arcade.Sprite & {
  hp?: number;
  invuln?: number;
  slot?: number;
};

function slotOffset(i: number) {
  const rank = Math.floor(i / 2);
  const right = i % 2 === 0;
  const gap = Math.max(52, Math.round(W * 0.1));
  return {
    x: (right ? 1 : -1) * (gap + rank * 16),
    y: rank * 22,
  };
}

function liveStats() {
  return useGameStore.getState().stats;
}

function liveFirepower() {
  return liveStats().firepower;
}

function liveSpeed() {
  return liveStats().speed;
}

function keySpeed() {
  return KEY_SPEED * (0.9 + liveSpeed() * 0.1);
}

function shotDelay() {
  return Math.max(0.055, 0.22 - liveFirepower() * 0.018 - liveSpeed() * 0.006);
}

function shotVy() {
  return 500 + liveSpeed() * 26 + liveFirepower() * 6;
}

function missileDelay() {
  const { missiles } = liveStats();
  if (missiles <= 0) return 999;
  return Math.max(0.4, 2.2 - missiles * 0.28);
}

function missileCount() {
  const { missiles } = liveStats();
  if (missiles <= 0) return 0;
  return Math.min(4, 1 + Math.floor((missiles - 1) / 2));
}

function missileSpd() {
  return 300 + liveStats().missiles * 14 + liveSpeed() * 12;
}

export class PlayScene extends Phaser.Scene {
  player!: Phaser.Physics.Arcade.Sprite;
  shieldFx!: Phaser.GameObjects.Sprite;
  wings: Wing[] = [];
  wingFx: Phaser.GameObjects.Sprite[] = [];
  wingGroup!: Phaser.Physics.Arcade.Group;
  shots!: Phaser.Physics.Arcade.Group;
  missiles!: Phaser.Physics.Arcade.Group;
  enemies!: Phaser.Physics.Arcade.Group;
  pellets!: Phaser.Physics.Arcade.Group;
  hearts!: Phaser.Physics.Arcade.Group;
  booms!: Phaser.GameObjects.Group;
  clouds: Phaser.GameObjects.Image[] = [];
  hills!: Phaser.GameObjects.TileSprite;
  hillsNext!: Phaser.GameObjects.TileSprite;
  mid!: Phaser.GameObjects.TileSprite;
  midNext!: Phaser.GameObjects.TileSprite;
  sparkles!: Phaser.GameObjects.TileSprite;
  sky!: Phaser.GameObjects.Graphics;
  muzzle!: Phaser.GameObjects.Image;
  pods: Phaser.GameObjects.Image[] = [];
  trails: Phaser.GameObjects.Image[] = [];
  buzzWings: Phaser.GameObjects.Image[] = [];
  beeShadow!: Phaser.GameObjects.Image;
  twinShadow!: Phaser.GameObjects.Image;
  pollen?: Phaser.GameObjects.Particles.ParticleEmitter;
  twinPollen?: Phaser.GameObjects.Particles.ParticleEmitter;
  weather?: Phaser.GameObjects.Particles.ParticleEmitter;
  fog?: Phaser.GameObjects.Rectangle;
  climate?: Climate;
  climateFrom?: Climate;
  climateTo?: Climate;
  climateBlend = 1;
  wxStamp = 0;
  lightningAt = 0;
  bossHudAt = 0;

  shotCd = 0;
  missileCd = 0;
  invuln = 0;
  waveIndex = 0;
  spawnQueue: SpawnSpec[] = [];
  spawnWait = 0;
  waves: SpawnSpec[][] = [];
  levelBusy = false;
  runActive = false;
  clearing = false;
  ready = false;

  constructor() {
    super("play");
  }

  init() {
    this.shotCd = 0;
    this.missileCd = 0.4;
    this.invuln = 0;
    this.waveIndex = 0;
    this.spawnQueue = [];
    this.spawnWait = 0;
    this.waves = [];
    this.levelBusy = false;
    this.runActive = false;
    this.clearing = false;
    this.ready = false;
    this.clouds = [];
    probe.playing = false;
  }

  preload() {
    const sheet = (key: string, path: string) => {
      this.load.spritesheet(key, path, { frameWidth: 128, frameHeight: 128 });
    };
    sheet("player", "/sprites/player.png");
    sheet("bird", "/sprites/bird.png");
    sheet("wasp", "/sprites/wasp.png");
    sheet("frog", "/sprites/frog.png");
    sheet("pig", "/sprites/pig.png");
    sheet("cat", "/sprites/cat.png");
    sheet("boss-owl", "/sprites/boss-owl.png");
    sheet("boss-queen", "/sprites/boss-queen.png");
    sheet("boss-whale", "/sprites/boss-whale.png");
    sheet("boss-peach", "/sprites/boss-peach.png");
    sheet("boss-mecha", "/sprites/boss-mecha.png");
    sheet("shot", "/sprites/shot.png");
    sheet("missile", "/sprites/missile.png");
    sheet("pellet", "/sprites/pellet.png");
    sheet("boom", "/sprites/boom.png");
    sheet("shield", "/sprites/shield.png");
  }

  create() {
    this.makeBackdrop();
    this.makeAnims();

    this.shots = this.physics.add.group({ maxSize: 240, allowGravity: false });
    this.missiles = this.physics.add.group({ maxSize: 48, allowGravity: false });
    this.enemies = this.physics.add.group({ maxSize: 96, allowGravity: false });
    this.pellets = this.physics.add.group({ maxSize: 200, allowGravity: false });
    this.hearts = this.physics.add.group({ maxSize: 8, allowGravity: false });
    this.booms = this.add.group({ maxSize: 20 });
    this.warm(this.shots, "shot", 80);
    this.warm(this.missiles, "missile", 16);
    this.warm(this.pellets, "pellet", 48);
    this.warm(this.enemies, "bird", 24);

    this.player = this.physics.add.sprite(W / 2, H - 110, "player", 0);
    this.player.setDisplaySize(56, 56);
    this.player.setCollideWorldBounds(true);
    fitBody(this.player, 22);
    this.player.play("player-fly");
    this.player.setDepth(10);

    this.muzzle = this.add.image(this.player.x, this.player.y - 22, "muzzle");
    this.muzzle.setDepth(11);
    this.muzzle.setAlpha(0);
    this.pods = [];
    for (let i = 0; i < 4; i++) {
      const p = this.add.image(this.player.x, this.player.y, "missile", 0);
      p.setDisplaySize(16, 16);
      p.setDepth(9);
      p.setVisible(false);
      this.pods.push(p);
    }
    this.trails = [];
    for (let i = 0; i < 3; i++) {
      const t = this.add.image(this.player.x, this.player.y, "speedline");
      t.setDepth(8);
      t.setAlpha(0);
      this.trails.push(t);
    }

    this.buzzWings = [];
    for (let i = 0; i < 4; i++) {
      const wing = this.add.image(this.player.x, this.player.y, "beewing");
      wing.setDepth(9);
      wing.setAlpha(0);
      this.buzzWings.push(wing);
    }
    this.beeShadow = this.add.image(this.player.x, this.player.y + 28, "beeshadow");
    this.beeShadow.setDepth(7);
    this.beeShadow.setAlpha(0.22);
    this.twinShadow = this.add.image(-40, -40, "beeshadow");
    this.twinShadow.setDepth(7);
    this.twinShadow.setAlpha(0);

    this.pollen = this.add.particles(0, 0, "pollen", {
      follow: this.player,
      followOffset: { x: 0, y: 8 },
      frequency: 110,
      lifespan: 420,
      quantity: 1,
      maxParticles: 14,
      speed: { min: 10, max: 32 },
      angle: { min: 200, max: 340 },
      scale: { start: 0.65, end: 0 },
      alpha: { start: 0.7, end: 0 },
      gravityY: -40,
      emitting: false,
    });
    this.pollen.setDepth(12);
    this.twinPollen = this.add.particles(0, 0, "pollen", {
      frequency: 140,
      lifespan: 400,
      quantity: 1,
      maxParticles: 8,
      speed: { min: 8, max: 24 },
      angle: { min: 200, max: 340 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.55, end: 0 },
      gravityY: -30,
      emitting: false,
      tint: 0xffc4e0,
    });
    this.twinPollen.setDepth(12);

    this.shieldFx = this.add.sprite(this.player.x, this.player.y, "shield", 0);
    this.shieldFx.setDisplaySize(78, 78);
    this.shieldFx.setDepth(9);
    this.shieldFx.play("shield-spin");
    this.shieldFx.setAlpha(0);

    this.wingGroup = this.physics.add.group({ allowGravity: false });
    this.wings = [];
    this.wingFx = [];
    for (let i = 0; i < TWIN_MAX; i++) {
      const w = this.physics.add.sprite(-40, -40, "player", 0) as Wing;
      w.setDisplaySize(48, 48);
      w.setCollideWorldBounds(true);
      fitBody(w, 18);
      w.play("player-fly");
      w.setTint(TWIN_TINTS[i] ?? 0xff8ec8);
      w.setDepth(10);
      w.slot = i;
      w.disableBody(true, true);
      this.wingGroup.add(w);
      this.wings.push(w);
      const fx = this.add.sprite(w.x, w.y, "shield", 0);
      fx.setDisplaySize(62, 62);
      fx.setDepth(9);
      fx.play("shield-spin");
      fx.setAlpha(0);
      this.wingFx.push(fx);
    }

    this.physics.add.overlap(this.shots, this.enemies, (shot, enemy) => {
      this.strike(shot as Phaser.Physics.Arcade.Sprite, enemy as Enemy, 1);
    });
    this.physics.add.overlap(this.missiles, this.enemies, (m, enemy) => {
      this.strike(m as Phaser.Physics.Arcade.Sprite, enemy as Enemy, 3);
    });
    this.physics.add.overlap(this.shots, this.pellets, (_shot, pellet) => {
      this.breakPellet(pellet as Phaser.Physics.Arcade.Sprite);
    });
    this.physics.add.overlap(this.missiles, this.pellets, (_m, pellet) => {
      this.breakPellet(pellet as Phaser.Physics.Arcade.Sprite);
    });
    this.physics.add.overlap(this.player, this.enemies, (_p, enemy) => {
      this.ram(enemy as Enemy);
    });
    this.physics.add.overlap(this.player, this.pellets, (_p, pellet) => {
      this.recycle(pellet as Phaser.Physics.Arcade.Sprite);
      this.hurtPlayer();
    });
    this.physics.add.overlap(this.player, this.hearts, (_p, heart) => {
      this.collectHeart(heart as Phaser.Physics.Arcade.Sprite);
    });
    this.physics.add.overlap(this.wingGroup, this.enemies, (wing, enemy) => {
      this.hurtWing(wing as Wing);
      const foe = enemy as Enemy;
      if (!foe.kind || !isBossBody(foe.kind)) this.killEnemy(foe);
    });
    this.physics.add.overlap(this.wingGroup, this.pellets, (wing, pellet) => {
      if (!(wing as Wing).active) return;
      this.recycle(pellet as Phaser.Physics.Arcade.Sprite);
      this.hurtWing(wing as Wing);
    });
    this.physics.add.overlap(this.wingGroup, this.hearts, (_w, heart) => {
      this.collectHeart(heart as Phaser.Physics.Arcade.Sprite);
    });

    this.physics.world.setBounds(0, 0, W, H);

    this.events.once("shutdown", () => {
      this.clouds = [];
    });

    this.wireProbe();
    this.ready = true;
    if (useGameStore.getState().phase === "playing") this.startRun();
  }

  startRun() {
    if (!this.ready || !this.player) return;
    this.recycleAll();
    this.player.setPosition(W / 2, H - 110);
    this.player.setVelocity(0, 0);
    this.player.setAlpha(1);
    this.player.setVisible(true);
    this.shotCd = 0;
    this.missileCd = 0.5;
    this.invuln = 0.8;
    this.waveIndex = 0;
    this.clearing = false;
    this.runActive = true;
    probe.playing = true;
    this.parkWings();
    startMusic();
    this.loadLevel(1);
  }

  continueRun() {
    this.recycleAll();
    this.player.setPosition(W / 2, H - 110);
    this.player.setVelocity(0, 0);
    this.player.setAlpha(1);
    this.invuln = 0.55;
    this.waveIndex = 0;
    this.clearing = false;
    this.runActive = true;
    probe.playing = true;
    useGameStore.getState().clearBoss();
    this.spawnWings();
    startMusic();
    this.loadLevel(useGameStore.getState().level);
    this.scene.resume();
  }

  loadLevel(n: number) {
    const { runSeed, difficulty } = useGameStore.getState();
    const plan = generateStage(runSeed, n, W, difficulty);
    this.waves = plan.waves;
    this.waveIndex = 0;
    this.queueWave();
    this.levelBusy = true;
    this.applyClimate(n, runSeed);
    useGameStore.getState().setHud({ motif: plan.motif });
  }

  applyClimate(level: number, seed: number) {
    const next = climateFor(level, seed);
    if (this.climateTo && this.climateTo.label === next.label && this.climateBlend >= 1) {
      this.climate = next;
      return;
    }
    this.climateFrom = this.visualClimate();
    this.climateTo = next;
    this.climate = next;
    this.lightningAt = 5 + Math.random() * 6;
    if (this.climateFrom.label === next.label) this.climateBlend = 1;
    else this.climateBlend = 0;
    useGameStore.getState().setHud({
      season: next.season,
      weather: next.weather,
      climate: next.label,
    });
    this.paintClimate(this.visualClimate());
  }

  visualClimate() {
    if (this.climateFrom && this.climateTo && this.climateBlend < 1) {
      return mixClimate(this.climateFrom, this.climateTo, this.climateBlend);
    }
    return this.climateTo ?? this.climate ?? climateFor(1, 1);
  }

  layoutLand(layer: Phaser.GameObjects.TileSprite | undefined, look: Climate, kind: "land" | "mid", alpha: number) {
    if (!layer) return;
    const h = kind === "land" ? look.landH : look.midH;
    const key = kind === "land" ? look.landKey : look.midKey;
    if (layer.texture.key !== key) layer.setTexture(key);
    if (kind === "land") layer.setSize(W, h).setPosition(W / 2, H - h * 0.45);
    else layer.setSize(W, h).setPosition(W / 2, H - look.landH * 0.55 - h * 0.18);
    layer.setTint(kind === "land" ? look.hills : look.midTint);
    layer.setAlpha(alpha);
  }

  paintClimate(c?: Climate) {
    const look = c ?? this.visualClimate();
    const from = this.climateFrom;
    const to = this.climateTo ?? look;
    const u = this.climateBlend;
    if (this.sky) {
      this.sky.clear();
      this.sky.fillGradientStyle(look.skyTop, look.skyTop, look.skyBot, look.skyBot, 1);
      this.sky.fillRect(0, 0, W, H);
    }
    if (from && u < 1) {
      this.layoutLand(this.hills, from, "land", 1 - u);
      this.layoutLand(this.hillsNext, to, "land", u);
      this.layoutLand(this.mid, from, "mid", (1 - u) * 0.95);
      this.layoutLand(this.midNext, to, "mid", u * 0.95);
    } else {
      this.layoutLand(this.hills, look, "land", 1);
      this.layoutLand(this.mid, look, "mid", 0.95);
      this.hillsNext?.setAlpha(0);
      this.midNext?.setAlpha(0);
    }
    this.sparkles?.setTint(look.spark);
    this.sparkles?.setAlpha(look.fog > 0.18 || look.lightning ? 0.18 : 0.48);
    for (const cloud of this.clouds) cloud.setTint(look.cloud);
    this.fog?.setFillStyle(look.fogTint, look.fog);
    this.fog?.setSize(W, H).setPosition(W / 2, H / 2);
    const wx = this.weather;
    if (!wx) return;
    const now = this.time.now;
    if (now - this.wxStamp < 90 && this.climateBlend < 1 && this.climateBlend > 0) return;
    this.wxStamp = now;
    const key = flakeTexture(look.flake);
    if (wx.texture.key !== key) wx.setTexture(key);
    wx.setParticleTint(look.flakeTint);
    wx.setConfig({
      x: { min: 0, max: W },
      y: -12,
      lifespan: look.flakeLife,
      speedY: { min: look.flakeVy * 0.7, max: look.flakeVy * 1.3 },
      speedX: { min: look.flakeVx - 18, max: look.flakeVx + 10 },
      scale: { start: look.flakeScale, end: look.flakeScale * 0.5 },
      rotate: { min: 0, max: look.flake === "rain" ? 8 : 220 },
      frequency: look.flakeFreq || 900,
      maxParticles: Math.min(48, look.flakeMax),
    });
    wx.emitting = look.flake !== "none" && look.flakeFreq > 4;
  }

  queueWave() {
    const wave = this.waves[this.waveIndex];
    this.spawnQueue = wave ? [...wave] : [];
    this.spawnWait = 0.35;
  }

  makeAnims() {
    const loop = (key: string, texture: string) => {
      if (this.anims.exists(key)) return;
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers(texture, { start: 0, end: 3 }),
        frameRate: 8,
        repeat: -1,
      });
    };
    loop("player-fly", "player");
    const fly = this.anims.get("player-fly");
    if (fly) fly.frameRate = 14;
    for (const body of ALL_BODIES) loop(`${body}-fly`, body);
    loop("shot-spin", "shot");
    loop("missile-fly", "missile");
    loop("pellet-spin", "pellet");
    loop("shield-spin", "shield");
    if (!this.anims.exists("boom-pop")) {
      this.anims.create({
        key: "boom-pop",
        frames: this.anims.generateFrameNumbers("boom", { start: 0, end: 3 }),
        frameRate: 14,
        repeat: 0,
      });
    }
  }

  makeLandArt() {
    const bake = (key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void) => {
      const g = this.make.graphics({ x: 0, y: 0 });
      draw(g);
      g.generateTexture(key, w, h);
      g.destroy();
    };

    bake("land-meadow", 360, 96, (g) => {
      g.fillStyle(0x7ed957, 1);
      g.fillEllipse(80, 52, 200, 88);
      g.fillEllipse(230, 58, 240, 96);
      g.fillStyle(0x5bd18a, 1);
      g.fillRect(0, 58, 360, 38);
      g.fillStyle(0xffe08a, 1);
      for (let i = 0; i < 10; i++) g.fillCircle(18 + i * 34, 48 + (i % 3) * 8, 3);
      g.fillStyle(0xffc4e0, 1);
      for (let i = 0; i < 8; i++) g.fillCircle(30 + i * 42, 40 + (i % 2) * 10, 2.4);
    });

    bake("land-orchard", 360, 100, (g) => {
      g.fillStyle(0x6fd36a, 1);
      g.fillEllipse(90, 60, 210, 90);
      g.fillEllipse(250, 64, 220, 92);
      g.fillStyle(0x4cba72, 1);
      g.fillRect(0, 64, 360, 36);
      g.fillStyle(0xffc4e0, 1);
      g.fillCircle(50, 42, 22);
      g.fillCircle(120, 36, 26);
      g.fillCircle(200, 40, 24);
      g.fillCircle(280, 34, 28);
      g.fillCircle(340, 44, 20);
      g.fillStyle(0xfff6e8, 0.8);
      g.fillCircle(112, 30, 8);
      g.fillCircle(272, 28, 8);
    });

    bake("land-coast", 360, 88, (g) => {
      g.fillStyle(0x3db7e8, 1);
      g.fillRect(0, 18, 360, 70);
      g.fillStyle(0x6ed0f0, 1);
      g.fillEllipse(60, 36, 140, 28);
      g.fillEllipse(220, 44, 180, 24);
      g.fillStyle(0xfff6e8, 0.9);
      g.fillEllipse(40, 30, 70, 10);
      g.fillEllipse(200, 38, 90, 10);
      g.fillStyle(0xf0d08a, 1);
      g.fillRect(0, 62, 360, 26);
      g.fillStyle(0xffe6b0, 1);
      g.fillEllipse(90, 64, 160, 18);
    });

    bake("land-woods", 360, 110, (g) => {
      g.fillStyle(0x2f6b45, 1);
      g.fillRect(0, 70, 360, 40);
      g.fillStyle(0x3d9a5a, 1);
      g.fillCircle(40, 58, 34);
      g.fillCircle(110, 48, 42);
      g.fillCircle(190, 54, 38);
      g.fillCircle(270, 44, 46);
      g.fillCircle(340, 58, 32);
      g.fillStyle(0x24603a, 1);
      g.fillCircle(80, 62, 28);
      g.fillCircle(230, 66, 30);
    });

    bake("land-canyon", 360, 120, (g) => {
      g.fillStyle(0xc45c28, 1);
      g.fillRect(0, 70, 360, 50);
      g.fillStyle(0xe08a3c, 1);
      g.fillRoundedRect(20, 28, 70, 92, 8);
      g.fillRoundedRect(120, 12, 90, 108, 10);
      g.fillRoundedRect(240, 36, 80, 84, 8);
      g.fillStyle(0xffc14d, 1);
      g.fillRect(20, 48, 70, 8);
      g.fillRect(120, 40, 90, 8);
      g.fillRect(240, 56, 80, 8);
    });

    bake("land-town", 360, 100, (g) => {
      g.fillStyle(0xd4b896, 1);
      g.fillRect(0, 62, 360, 38);
      const roofs = [0xe24b5a, 0xe0a01a, 0x6ec8f5, 0xe24b5a, 0xffc4e0];
      for (let i = 0; i < 5; i++) {
        const x = 18 + i * 70;
        g.fillStyle(0xfff6e8, 1);
        g.fillRect(x, 38, 52, 40);
        g.fillStyle(roofs[i]!, 1);
        g.fillTriangle(x - 6, 40, x + 26, 12, x + 58, 40);
      }
    });

    bake("land-dunes", 360, 92, (g) => {
      g.fillStyle(0xe8c56a, 1);
      g.fillRect(0, 48, 360, 44);
      g.fillStyle(0xf5d08a, 1);
      g.fillEllipse(70, 52, 180, 70);
      g.fillEllipse(210, 58, 200, 64);
      g.fillEllipse(330, 50, 140, 56);
      g.fillStyle(0xffe08a, 0.7);
      g.fillEllipse(140, 44, 90, 20);
    });

    bake("land-peaks", 360, 130, (g) => {
      g.fillStyle(0x7a90b0, 1);
      g.fillTriangle(0, 130, 90, 18, 180, 130);
      g.fillTriangle(120, 130, 220, 8, 330, 130);
      g.fillTriangle(240, 130, 330, 36, 400, 130);
      g.fillStyle(0xeef6ff, 1);
      g.fillTriangle(70, 40, 90, 18, 110, 40);
      g.fillTriangle(200, 32, 220, 8, 244, 36);
      g.fillTriangle(314, 52, 330, 36, 348, 54);
      g.fillStyle(0xc8d8f0, 1);
      g.fillRect(0, 108, 360, 22);
    });

    bake("mid-flowers", 360, 70, (g) => {
      g.fillStyle(0x5bd18a, 0.0);
      g.fillRect(0, 0, 1, 1);
      for (let i = 0; i < 14; i++) {
        g.fillStyle(i % 2 ? 0xffc4e0 : 0xffe08a, 1);
        g.fillCircle(16 + i * 25, 28 + (i % 3) * 12, 4 + (i % 2));
      }
    });

    bake("mid-trees", 360, 110, (g) => {
      for (let i = 0; i < 6; i++) {
        const x = 28 + i * 58;
        g.fillStyle(0x8a5a32, 1);
        g.fillRect(x + 10, 58, 8, 40);
        g.fillStyle(0xffc4e0, 1);
        g.fillCircle(x + 14, 48, 22);
        g.fillStyle(0x7ed957, 1);
        g.fillCircle(x + 6, 56, 16);
      }
    });

    bake("mid-waves", 360, 56, (g) => {
      g.fillStyle(0x3db7e8, 0.7);
      g.fillEllipse(60, 28, 140, 22);
      g.fillEllipse(200, 34, 160, 18);
      g.fillEllipse(320, 26, 120, 20);
      g.fillStyle(0xfff6e8, 0.85);
      g.fillEllipse(70, 22, 80, 8);
      g.fillEllipse(230, 30, 90, 8);
    });

    bake("mid-pines", 360, 140, (g) => {
      for (let i = 0; i < 7; i++) {
        const x = 16 + i * 50;
        const h = 70 + (i % 3) * 18;
        g.fillStyle(0x8a5a32, 1);
        g.fillRect(x + 14, h - 10, 8, 140 - h);
        g.fillStyle(0x24603a, 1);
        g.fillTriangle(x, h, x + 18, 12 + (i % 2) * 16, x + 36, h);
      }
    });

    bake("mid-mesas", 360, 150, (g) => {
      g.fillStyle(0xc45c28, 1);
      g.fillRect(30, 40, 54, 110);
      g.fillRect(140, 18, 72, 132);
      g.fillRect(260, 50, 60, 100);
      g.fillStyle(0xffc14d, 1);
      g.fillRect(30, 52, 54, 8);
      g.fillRect(140, 36, 72, 8);
    });

    bake("mid-roofs", 360, 92, (g) => {
      for (let i = 0; i < 6; i++) {
        const x = 8 + i * 60;
        g.fillStyle(0xfff6e8, 1);
        g.fillRect(x + 8, 42, 40, 50);
        g.fillStyle(i % 2 ? 0xe24b5a : 0xe0a01a, 1);
        g.fillTriangle(x + 4, 44, x + 28, 14, x + 52, 44);
        g.fillStyle(0x6ec8f5, 1);
        g.fillRect(x + 16, 54, 10, 10);
      }
    });

    bake("mid-dunes", 360, 80, (g) => {
      g.fillStyle(0xe8c56a, 1);
      g.fillEllipse(80, 50, 160, 50);
      g.fillEllipse(240, 56, 180, 44);
      g.fillStyle(0xf8e0a8, 0.8);
      g.fillEllipse(90, 40, 70, 16);
    });

    bake("mid-peaks", 360, 170, (g) => {
      g.fillStyle(0x5a7398, 1);
      g.fillTriangle(10, 170, 80, 20, 160, 170);
      g.fillTriangle(140, 170, 220, 8, 310, 170);
      g.fillStyle(0xeef6ff, 1);
      g.fillTriangle(64, 48, 80, 20, 96, 48);
      g.fillTriangle(202, 40, 220, 8, 240, 42);
    });

    bake("prop-tree", 48, 64, (g) => {
      g.fillStyle(0x8a5a32, 1);
      g.fillRect(20, 34, 8, 26);
      g.fillStyle(0x3d9a5a, 1);
      g.fillCircle(24, 28, 18);
    });
    bake("prop-bloom", 48, 64, (g) => {
      g.fillStyle(0x8a5a32, 1);
      g.fillRect(20, 36, 8, 24);
      g.fillStyle(0xffc4e0, 1);
      g.fillCircle(24, 26, 18);
      g.fillStyle(0xfff6e8, 1);
      g.fillCircle(18, 22, 5);
    });
    bake("prop-sail", 48, 64, (g) => {
      g.fillStyle(0xe24b5a, 1);
      g.fillTriangle(24, 6, 24, 40, 42, 28);
      g.fillStyle(0x8a5a32, 1);
      g.fillRect(22, 8, 3, 40);
      g.fillStyle(0xfff6e8, 1);
      g.fillEllipse(24, 52, 28, 10);
    });
    bake("prop-pine", 48, 72, (g) => {
      g.fillStyle(0x8a5a32, 1);
      g.fillRect(20, 48, 8, 22);
      g.fillStyle(0x24603a, 1);
      g.fillTriangle(6, 54, 24, 8, 42, 54);
    });
    bake("prop-mesa", 56, 48, (g) => {
      g.fillStyle(0xe08a3c, 1);
      g.fillRoundedRect(6, 8, 44, 36, 4);
      g.fillStyle(0xffc14d, 1);
      g.fillRect(6, 16, 44, 5);
    });
    bake("prop-house", 48, 56, (g) => {
      g.fillStyle(0xfff6e8, 1);
      g.fillRect(8, 24, 32, 28);
      g.fillStyle(0xe24b5a, 1);
      g.fillTriangle(4, 26, 24, 6, 44, 26);
      g.fillStyle(0x6ec8f5, 1);
      g.fillRect(18, 34, 10, 10);
    });
    bake("prop-cactus", 40, 64, (g) => {
      g.fillStyle(0x3d9a5a, 1);
      g.fillRoundedRect(16, 8, 10, 50, 5);
      g.fillRoundedRect(6, 22, 14, 8, 4);
      g.fillRoundedRect(22, 30, 14, 8, 4);
    });
    bake("prop-peak", 48, 64, (g) => {
      g.fillStyle(0x7a90b0, 1);
      g.fillTriangle(4, 60, 24, 6, 44, 60);
      g.fillStyle(0xeef6ff, 1);
      g.fillTriangle(16, 22, 24, 6, 32, 22);
    });
  }

  makeBackdrop() {
    this.sky = this.add.graphics();
    this.sky.fillGradientStyle(0x6ec8f5, 0x6ec8f5, 0xc8f4a8, 0xc8f4a8, 1);
    this.sky.fillRect(0, 0, W, H);
    this.sky.setDepth(-20);

    const cg = this.make.graphics({ x: 0, y: 0 });
    cg.fillStyle(0xffffff, 0.92);
    cg.fillEllipse(48, 28, 86, 36);
    cg.fillStyle(0xfff6e8, 0.95);
    cg.fillEllipse(28, 32, 44, 24);
    cg.fillEllipse(70, 32, 50, 26);
    cg.generateTexture("cloud", 96, 56);
    cg.destroy();

    const sg = this.make.graphics({ x: 0, y: 0 });
    sg.fillStyle(0xfff6e8, 0.7);
    for (let i = 0; i < 18; i++) {
      sg.fillCircle(8 + (i * 19) % 120, 6 + (i * 13) % 80, 1.4);
    }
    sg.generateTexture("sparkle", 128, 96);
    sg.destroy();

    const hg = this.make.graphics({ x: 0, y: 0 });
    hg.fillStyle(0x7ed957, 1);
    hg.fillEllipse(90, 50, 200, 90);
    hg.fillEllipse(220, 56, 220, 100);
    hg.fillStyle(0x5bd18a, 1);
    hg.fillRect(0, 56, 360, 40);
    hg.generateTexture("hills", 360, 96);
    hg.destroy();
    this.makeLandArt();

    const ht = this.make.graphics({ x: 0, y: 0 });
    ht.fillStyle(0xff5a7a, 1);
    ht.fillCircle(18, 16, 11);
    ht.fillCircle(30, 16, 11);
    ht.fillTriangle(8, 18, 40, 18, 24, 44);
    ht.fillStyle(0xffd4de, 1);
    ht.fillCircle(14, 13, 3.4);
    ht.generateTexture("heart", 48, 48);
    ht.destroy();

    const mg = this.make.graphics({ x: 0, y: 0 });
    mg.fillStyle(0xffe08a, 1);
    mg.fillCircle(16, 16, 14);
    mg.fillStyle(0xfff6e8, 1);
    mg.fillCircle(16, 12, 6);
    mg.generateTexture("muzzle", 32, 32);
    mg.destroy();

    const lg = this.make.graphics({ x: 0, y: 0 });
    lg.fillStyle(0xfff6e8, 1);
    lg.fillEllipse(6, 16, 8, 28);
    lg.generateTexture("speedline", 12, 32);
    lg.destroy();

    const wg = this.make.graphics({ x: 0, y: 0 });
    wg.fillStyle(0xffffff, 0.92);
    wg.fillEllipse(22, 12, 40, 18);
    wg.generateTexture("beewing", 44, 24);
    wg.destroy();

    const sh = this.make.graphics({ x: 0, y: 0 });
    sh.fillStyle(0x3a2452, 1);
    sh.fillEllipse(20, 8, 36, 12);
    sh.generateTexture("beeshadow", 40, 16);
    sh.destroy();

    const pg = this.make.graphics({ x: 0, y: 0 });
    pg.fillStyle(0xffe08a, 1);
    pg.fillCircle(4, 4, 3);
    pg.fillStyle(0xfff6e8, 1);
    pg.fillCircle(3, 3, 1.2);
    pg.generateTexture("pollen", 8, 8);
    pg.destroy();

    const rain = this.make.graphics({ x: 0, y: 0 });
    rain.fillStyle(0xffffff, 0.9);
    rain.fillRect(1, 0, 2, 10);
    rain.generateTexture("wx-rain", 4, 12);
    rain.destroy();

    const snow = this.make.graphics({ x: 0, y: 0 });
    snow.fillStyle(0xffffff, 1);
    snow.fillCircle(4, 4, 3.2);
    snow.generateTexture("wx-snow", 8, 8);
    snow.destroy();

    const petal = this.make.graphics({ x: 0, y: 0 });
    petal.fillStyle(0xffffff, 1);
    petal.fillEllipse(6, 4, 10, 6);
    petal.generateTexture("wx-petal", 12, 8);
    petal.destroy();

    const leaf = this.make.graphics({ x: 0, y: 0 });
    leaf.fillStyle(0xffffff, 1);
    leaf.fillEllipse(7, 4, 12, 6);
    leaf.fillTriangle(12, 4, 16, 1, 16, 7);
    leaf.generateTexture("wx-leaf", 16, 8);
    leaf.destroy();

    this.fog = this.add.rectangle(W / 2, H / 2, W, H, 0xe8f0f6, 0);
    this.fog.setDepth(18);
    this.weather = this.add.particles(0, 0, "wx-snow", {
      x: { min: 0, max: W },
      y: -12,
      lifespan: 2200,
      speedY: { min: 40, max: 90 },
      speedX: { min: -20, max: 10 },
      scale: { start: 0.7, end: 0.4 },
      rotate: { min: 0, max: 180 },
      quantity: 1,
      frequency: 80,
      maxParticles: 40,
      emitting: false,
    });
    this.weather.setDepth(19);

    this.hills = this.add.tileSprite(W / 2, H - 40, W, 96, "land-meadow").setDepth(-8);
    this.hillsNext = this.add.tileSprite(W / 2, H - 40, W, 96, "land-orchard").setDepth(-8).setAlpha(0);
    this.mid = this.add.tileSprite(W / 2, H - 88, W, 110, "mid-flowers").setDepth(-7);
    this.midNext = this.add.tileSprite(W / 2, H - 88, W, 110, "mid-trees").setDepth(-7).setAlpha(0);
    this.sparkles = this.add.tileSprite(W / 2, H / 2, W, H, "sparkle").setDepth(-12).setAlpha(0.55);

    for (let i = 0; i < (W > 500 ? 10 : 6); i++) {
      const c = this.add.image(40 + i * Math.max(58, W / 10), 40 + (i % 3) * 90, "cloud");
      c.setAlpha(0.85);
      c.setScale(0.7 + (i % 3) * 0.18);
      c.setDepth(-10);
      c.setData("vy", 18 + i * 4);
      (c as Phaser.GameObjects.Image & { vy: number }).vy = 18 + i * 4;
      this.clouds.push(c);
    }
    this.paintClimate(climateFor(1, 1));
  }

  update(_time: number, delta: number) {
    const dt = Math.min(delta / 1000, 0.1);
    this.hills.tilePositionY -= 24 * dt;
    this.hillsNext.tilePositionY -= 24 * dt;
    const wind = this.visualClimate().wind;
    this.mid?.setTilePosition(this.mid.tilePositionX + wind * dt * 0.12, this.mid.tilePositionY - 32 * dt);
    this.midNext?.setTilePosition(this.midNext.tilePositionX + wind * dt * 0.12, this.midNext.tilePositionY - 32 * dt);
    this.sparkles.tilePositionY -= 12 * dt;
    if (this.climateBlend < 1 && this.climateTo) {
      this.climateBlend = Math.min(1, this.climateBlend + dt / 6.5);
      this.paintClimate(this.visualClimate());
      if (this.climateBlend >= 1) {
        this.climateFrom = this.climateTo;
        this.paintClimate(this.climateTo);
      }
    }
    for (const c of this.clouds) {
      const vy = ((c as Phaser.GameObjects.Image & { vy?: number }).vy ?? 22) * (this.visualClimate().cloudVy / 22);
      c.y += vy * dt;
      c.x += this.visualClimate().wind * dt * 0.15;
      if (c.x > W + 50) c.x = -50;
      if (c.x < -50) c.x = W + 50;
      if (c.y > H + 40) {
        c.y = -40;
        c.x = 20 + Math.random() * (W - 40);
      }
    }
    if (this.visualClimate().lightning && this.runActive) {
      this.lightningAt -= dt;
      if (this.lightningAt <= 0) {
        this.lightningAt = 6 + Math.random() * 8;
        this.cameras.main.flash(90, 210, 220, 235, false);
      }
    }

    const phase = useGameStore.getState().phase;
    if (!this.runActive || phase !== "playing") {
      if (this.player?.body) this.player.setVelocity(0, 0);
      this.syncShield();
      this.syncGear();
      return;
    }

    this.movePlayer();
    this.moveWings();
    this.fireWeapons(dt);
    this.spawnTick(dt);
    this.steerEnemies(dt);
    this.steerMissiles();
    this.clashFire();
    this.recycleOffscreen();
    this.syncShield();
    this.syncGear();

    if (this.invuln > 0) {
      this.invuln -= dt;
      this.player.setAlpha(Math.sin(this.time.now / 70) > 0 ? 1 : 0.45);
      if (this.invuln <= 0) this.player.setAlpha(1);
    }
    for (const w of this.wings) {
      if (!w.active || (w.invuln ?? 0) <= 0) continue;
      w.invuln = (w.invuln ?? 0) - dt;
      w.setAlpha(Math.sin(this.time.now / 70) > 0 ? 1 : 0.45);
      if ((w.invuln ?? 0) <= 0) w.setAlpha(1);
    }

    this.maybeClearLevel();

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    probe.x = this.player.x;
    probe.y = this.player.y;
    probe.vx = body.velocity.x;
    probe.vy = body.velocity.y;
    probe.w = W;
    probe.h = H;
  }

  relayout() {
    this.physics.world.setBounds(0, 0, W, H);
    this.cameras.main.setBounds(0, 0, W, H);
    this.cameras.main.setViewport(0, 0, W, H);
    if (this.sky) {
      this.sky.clear();
      this.sky.fillGradientStyle(0x6ec8f5, 0x6ec8f5, 0xc8f4a8, 0xc8f4a8, 1);
      this.sky.fillRect(0, 0, W, H);
    }
    const look = this.visualClimate();
    this.hills?.setSize(W, look.landH).setPosition(W / 2, H - look.landH * 0.45);
    this.hillsNext?.setSize(W, look.landH).setPosition(W / 2, H - look.landH * 0.45);
    this.mid?.setSize(W, look.midH).setPosition(W / 2, H - look.landH * 0.55 - look.midH * 0.18);
    this.midNext?.setSize(W, look.midH).setPosition(W / 2, H - look.landH * 0.55 - look.midH * 0.18);
    this.sparkles?.setSize(W, H).setPosition(W / 2, H / 2);
    this.fog?.setSize(W, H).setPosition(W / 2, H / 2);
    if (this.weather) {
      this.weather.setConfig({ x: { min: 0, max: W } });
    }
    this.paintClimate(this.climate);
    if (this.player?.active) {
      this.player.x = Phaser.Math.Clamp(this.player.x, 18, W - 18);
      this.player.y = Phaser.Math.Clamp(this.player.y, 18, H - 18);
    }
  }

  syncShield() {
    this.paintShield(this.shieldFx, this.player, this.invuln, 1);
    for (let i = 0; i < this.wings.length; i++) {
      this.paintShield(this.wingFx[i]!, this.wings[i]!, this.wings[i]!.invuln ?? 0, 0.82);
    }
  }

  paintShield(fx: Phaser.GameObjects.Sprite, ship: Phaser.Physics.Arcade.Sprite, invuln: number, scale: number) {
    if (!fx || !ship) return;
    const { shields } = useGameStore.getState().stats;
    fx.setPosition(ship.x, ship.y);
    if (!ship.active || !ship.visible) {
      fx.setAlpha(0);
      return;
    }
    fx.setVisible(true);
    const pulse = 0.85 + Math.sin(this.time.now / 180) * 0.08;
    if (shields <= 0) {
      fx.setAlpha(invuln > 0 ? 0.35 : 0.18);
      fx.setDisplaySize(70 * scale, 70 * scale);
    } else {
      fx.setAlpha(Math.min(0.95, 0.45 + shields * 0.08) * pulse);
      const size = (78 + Math.min(shields, 8) * 4) * scale;
      fx.setDisplaySize(size, size);
    }
  }

  syncGear() {
    if (!this.player || !this.muzzle) return;
    const { firepower, missiles, speed } = liveStats();
    const live = this.player.visible && this.player.active && this.runActive;
    this.muzzle.setPosition(this.player.x, this.player.y - 20);
    this.muzzle.setVisible(live && firepower > 1);
    this.muzzle.setAlpha(live ? 0.28 + firepower * 0.07 : 0);
    this.muzzle.setScale(0.55 + firepower * 0.08);
    this.muzzle.setTint(firepower >= 6 ? 0xffc14d : 0xffe08a);

    const podOff: [number, number][] = [
      [-15, 16],
      [15, 16],
      [-20, 8],
      [20, 8],
    ];
    for (let i = 0; i < this.pods.length; i++) {
      const pod = this.pods[i]!;
      const show = live && i < missiles;
      pod.setVisible(show);
      if (!show) continue;
      const [ox, oy] = podOff[i]!;
      pod.setPosition(this.player.x + ox, this.player.y + oy);
      pod.setDisplaySize(14 + Math.min(missiles, 4), 14 + Math.min(missiles, 4));
      pod.setAlpha(0.95);
      pod.setAngle(0);
    }

    const ghosts = live ? Math.min(3, Math.max(0, speed - 1)) : 0;
    for (let i = 0; i < this.trails.length; i++) {
      const tr = this.trails[i]!;
      if (i >= ghosts) {
        tr.setAlpha(0);
        continue;
      }
      tr.setPosition(this.player.x, this.player.y + 18 + i * 11);
      tr.setAlpha(0.22 - i * 0.05);
      tr.setScale(0.7 + speed * 0.08, 0.9 + speed * 0.08);
      tr.setTint(0xfff6e8);
    }

    this.buzzBee(this.player, 0, live);
    const twin = this.wings[0];
    this.buzzBee(twin && twin.active ? twin : null, 2, live && !!twin?.active);

    if (this.pollen) {
      this.pollen.emitting = live;
      this.pollen.frequency = Math.max(36, 90 - liveSpeed() * 8);
    }
    if (this.twinPollen) {
      const t = this.wings[0];
      if (t?.active && live) {
        this.twinPollen.emitting = true;
        this.twinPollen.setPosition(t.x, t.y + 6);
      } else {
        this.twinPollen.emitting = false;
      }
    }
    if (this.player.anims) this.player.anims.timeScale = 0.85 + liveSpeed() * 0.12;
  }

  buzzBee(ship: Phaser.Physics.Arcade.Sprite | null | undefined, wingIndex: number, live: boolean) {
    const left = this.buzzWings[wingIndex];
    const right = this.buzzWings[wingIndex + 1];
    const shadow = wingIndex === 0 ? this.beeShadow : this.twinShadow;
    if (!left || !right || !shadow) return;
    if (!live || !ship?.active || !ship.visible) {
      left.setAlpha(0);
      right.setAlpha(0);
      shadow.setAlpha(0);
      return;
    }
    const t = this.time.now;
    const flap = 0.55 + Math.abs(Math.sin(t / 42)) * 0.7;
    const tilt = Math.sin(t / 42) * 12;
    const hover = Math.sin(t / 160) * 3;
    const size = wingIndex === 0 ? 1 : 0.82;
    left.setPosition(ship.x - 20 * size, ship.y - 4 + hover);
    right.setPosition(ship.x + 20 * size, ship.y - 4 + hover);
    left.setScale(flap * size, 0.75 * size);
    right.setScale(flap * size, 0.75 * size);
    left.setAngle(-16 - tilt);
    right.setAngle(16 + tilt);
    left.setAlpha(0);
    right.setAlpha(0);
    shadow.setPosition(ship.x, ship.y + 24 * size);
    shadow.setScale((0.85 + Math.sin(t / 160) * 0.08) * size, 0.45 * size);
    shadow.setAlpha(0.2);
  }

  movePlayer() {
    const usingKeys = input.left || input.right || input.up || input.down;
    if (!usingKeys && pointerSteering()) {
      const t = this.worldFromPointer(pointer.clientX, pointer.clientY, pointer.kind);
      if (t) {
        this.snapTo(this.player, t.x, t.y);
        return;
      }
    }
    let vx = 0;
    let vy = 0;
    if (input.left) vx -= 1;
    if (input.right) vx += 1;
    if (input.up) vy -= 1;
    if (input.down) vy += 1;
    if (vx !== 0 && vy !== 0) {
      vx *= Math.SQRT1_2;
      vy *= Math.SQRT1_2;
    }
    this.player.setVelocity(vx * keySpeed(), vy * keySpeed());
    this.player.setAngle(vx * 8);
  }

  moveWings() {
    const extras = extraAims();
    let extraI = 0;
    const arrows =
      twinKeys.left || twinKeys.right || twinKeys.up || twinKeys.down;
    let arrowsTaken = false;
    for (const w of this.wings) {
      if (!w.active) continue;
      const aim = extras[extraI];
      if (aim) {
        extraI += 1;
        const t = this.worldFromPointer(aim.clientX, aim.clientY, aim.kind);
        if (t) this.snapTo(w, t.x, t.y);
        continue;
      }
      if (arrows && !arrowsTaken) {
        arrowsTaken = true;
        let vx = 0;
        let vy = 0;
        if (twinKeys.left) vx -= 1;
        if (twinKeys.right) vx += 1;
        if (twinKeys.up) vy -= 1;
        if (twinKeys.down) vy += 1;
        if (vx !== 0 && vy !== 0) {
          vx *= Math.SQRT1_2;
          vy *= Math.SQRT1_2;
        }
        w.setVelocity(vx * keySpeed(), vy * keySpeed());
        w.setAngle(vx * 8);
        continue;
      }
      const off = slotOffset(w.slot ?? 0);
      const tx = Phaser.Math.Clamp(this.player.x + off.x, 22, W - 22);
      const ty = Phaser.Math.Clamp(this.player.y + off.y, 22, H - 22);
      this.snapTo(w, tx, ty);
    }
  }

  worldFromPointer(clientX: number, clientY: number, kind: "mouse" | "touch") {
    const canvas = this.sys.game.canvas;
    const r = canvas.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) return null;
    const lift = kind === "touch" ? AIM_LIFT_TOUCH : AIM_LIFT_MOUSE;
    return {
      x: Phaser.Math.Clamp(((clientX - r.left) / r.width) * W, 18, W - 18),
      y: Phaser.Math.Clamp(((clientY - r.top) / r.height) * H - lift, 18, H - 18),
    };
  }

  snapTo(ship: Phaser.Physics.Arcade.Sprite, x: number, y: number) {
    const dx = x - ship.x;
    ship.setPosition(x, y);
    ship.setVelocity(0, 0);
    ship.setAngle(Phaser.Math.Clamp(dx * 0.35, -14, 14));
  }

  fireWeapons(dt: number) {
    this.shotCd -= dt;
    this.missileCd -= dt;
    if (this.shotCd <= 0) {
      this.shotCd = shotDelay();
      this.volleys(this.player.x, this.player.y);
      for (const w of this.wings) {
        if (w.active) this.volleys(w.x, w.y);
      }
      sfx.shoot();
    }
    const n = missileCount();
    if (n > 0 && this.missileCd <= 0) {
      this.missileCd = missileDelay();
      for (let i = 0; i < n; i++) {
        const spread = n === 1 ? 0 : (i - (n - 1) / 2) * 12;
        this.spawnMissile(this.player.x + spread, this.player.y - 20);
        for (const w of this.wings) {
          if (w.active) this.spawnMissile(w.x + spread, w.y - 18);
        }
      }
      sfx.missile();
    }
  }

  volleys(x: number, y: number) {
    const firepower = liveFirepower();
    const py = y - 22;
    this.spawnShot(x, py, 0);
    if (firepower >= 3) {
      const gap = firepower >= 6 ? 10 : 6;
      const drift = firepower >= 6 ? 18 : 12;
      this.spawnShot(x - gap, py + 3, -drift);
      this.spawnShot(x + gap, py + 3, drift);
    }
    if (firepower >= 6) this.spawnShot(x, py - 8, 0);
  }

  spawnShot(x: number, y: number, vx: number) {
    const s = this.take(this.shots, x, y, "shot") as Phaser.Physics.Arcade.Sprite | null;
    if (!s) return;
    s.setDisplaySize(20 + Math.min(liveFirepower(), 6), 20 + Math.min(liveFirepower(), 6));
    fitBody(s, 30);
    s.setVelocity(vx, -shotVy());
    if (liveFirepower() >= 6) s.setTint(0xffc14d);
    else if (liveFirepower() >= 3) s.setTint(0xffe08a);
    else s.clearTint();
    s.play("shot-spin");
  }

  spawnMissile(x: number, y: number) {
    const s = this.take(this.missiles, x, y, "missile") as Phaser.Physics.Arcade.Sprite | null;
    if (!s) return;
    s.setDisplaySize(28 + liveStats().missiles * 2, 28 + liveStats().missiles * 2);
    fitBody(s, 34);
    s.setVelocity(0, -280);
    s.play("missile-fly");
  }

  spawnTick(dt: number) {
    if (this.spawnQueue.length === 0) return;
    this.spawnWait -= dt;
    if (this.spawnWait > 0) return;
    const next = this.spawnQueue.shift();
    if (!next) return;
    this.spawnEnemy(next);
    this.spawnWait = next.delay / 1000;
  }

  spawnEnemy(spec: SpawnSpec) {
    const e = this.take(this.enemies, spec.x, -36, spec.body) as Enemy | null;
    if (!e) return;
    e.setTexture(spec.body);
    e.kind = spec.body;
    e.hp = spec.hp;
    e.maxHp = spec.hp;
    e.pattern = spec.pattern;
    e.fire = spec.fire;
    e.amp = spec.amp;
    e.shootPeriod = spec.shootPeriod;
    e.worth = spec.worth;
    e.baseTint = spec.tint;
    e.burstLeft = 0;
    e.t = spec.x * 0.02;
    e.shootAt = spec.shootPeriod * 0.4;
    e.intro = isBossBody(spec.body);
    e.phase = 0;
    e.setDisplaySize(spec.size, spec.size);
    fitBody(e, isBossBody(spec.body) ? spec.size * 0.62 : spec.size * 0.7);
    e.setVelocity(0, spec.vy);
    e.setTint(spec.tint);
    e.play(`${spec.body}-fly`);
    if (isBossBody(spec.body)) {
      const title = BOSS_CAST.find((b) => b.body === spec.body)?.title ?? "Boss";
      useGameStore.getState().setBoss(title, spec.hp, spec.hp);
      sfx.warning();
      this.cameras.main.flash(180, 255, 90, 106, false);
    }
  }

  fireFrom(e: Enemy, dt: number) {
    if (e.kind && isBossBody(e.kind)) {
      this.bossFire(e, dt);
      return;
    }
    if (!e.fire || e.fire === "none") return;
    e.shootAt = (e.shootAt ?? 1) - dt;
    if ((e.shootAt ?? 0) > 0) return;
    const period = e.shootPeriod ?? 1.2;
    if (e.fire === "burst") {
      if ((e.burstLeft ?? 0) <= 0) e.burstLeft = 3;
      this.enemyShot(e.x, e.y + 16);
      e.burstLeft = (e.burstLeft ?? 1) - 1;
      e.shootAt = (e.burstLeft ?? 0) > 0 ? 0.12 : period;
      return;
    }
    if (e.fire === "down") this.enemyShot(e.x, e.y + 16);
    else if (e.fire === "aimed") {
      const ang = Math.atan2(this.player.y - e.y, this.player.x - e.x);
      const spd = 190;
      this.enemyShot(e.x, e.y + 12, Math.cos(ang) * spd, Math.sin(ang) * spd);
    } else if (e.fire === "spread") {
      this.enemyShot(e.x, e.y + 16, -70);
      this.enemyShot(e.x, e.y + 16, 0);
      this.enemyShot(e.x, e.y + 16, 70);
    }
    e.shootAt = period;
  }

  steerEnemies(dt: number) {
    const kids = this.enemies.children.entries as Enemy[];
    for (const e of kids) {
      if (!e.active) continue;
      if ((e.flash ?? 0) > 0) {
        e.flash = (e.flash ?? 0) - dt;
        if (e.flash <= 0) {
          e.clearTint();
          if (e.baseTint && e.baseTint !== 0xffffff) e.setTint(e.baseTint);
        }
      }
      e.t = (e.t ?? 0) + dt;
      if (e.kind && isBossBody(e.kind)) {
        this.steerBoss(e, dt);
        this.fireFrom(e, dt);
        continue;
      }
      const body = e.body as Phaser.Physics.Arcade.Body;
      const amp = e.amp ?? 70;
      const t = e.t ?? 0;
      if (e.pattern === "sine") {
        body.setVelocityX(Math.sin(t * 2.2) * amp);
      } else if (e.pattern === "dive") {
        const toward = Math.sign(this.player.x - e.x) || 0;
        body.setVelocityX(Phaser.Math.Linear(body.velocity.x, toward * amp, 0.05));
      } else if (e.pattern === "hold") {
        if (e.y > 118) body.setVelocityY(0);
        body.setVelocityX(Math.sin(t * 1.1) * amp);
      } else if (e.pattern === "zigzag") {
        body.setVelocityX(Math.sign(Math.sin(t * 4.2) || 1) * amp);
      } else if (e.pattern === "spiral") {
        body.setVelocityX(Math.cos(t * 3) * amp);
        body.setVelocityY(56 + Math.sin(t * 3) * 28);
      } else if (e.pattern === "strafe") {
        if (e.y > 90 && e.y < 280) body.setVelocityY(22);
        const dir = Math.sin(t * 1.6) >= 0 ? 1 : -1;
        body.setVelocityX(dir * amp);
      }
      this.fireFrom(e, dt);
    }
  }

  bossPhase(e: Enemy) {
    const max = e.maxHp || e.hp || 1;
    const ratio = (e.hp ?? 0) / max;
    if (ratio > 0.6) return 0;
    if (ratio > 0.3) return 1;
    return 2;
  }

  bossFire(e: Enemy, dt: number) {
    if (e.intro) return;
    e.shootAt = (e.shootAt ?? 1) - dt;
    if ((e.shootAt ?? 0) > 0) return;
    const phase = this.bossPhase(e);
    e.phase = phase;
    const kind = e.kind;
    const period = Math.max(0.28, (e.shootPeriod ?? 0.8) * (phase === 2 ? 0.62 : phase === 1 ? 0.8 : 1));
    if (kind === "boss-owl") {
      if (phase === 0) this.fanShot(e, 3, 55);
      else if (phase === 1) {
        this.aimedShot(e, 210);
        this.fanShot(e, 3, 40);
      } else {
        this.ringShot(e, 8, 150);
      }
    } else if (kind === "boss-queen") {
      if (phase === 0) this.rainShot(e);
      else if (phase === 1) this.fanShot(e, 5, 70);
      else {
        this.rainShot(e);
        this.aimedShot(e, 200);
      }
    } else if (kind === "boss-whale") {
      if (phase === 0) {
        this.enemyShot(e.x - 36, e.y + 20, -30, 150);
        this.enemyShot(e.x + 36, e.y + 20, 30, 150);
      } else if (phase === 1) {
        this.fanShot(e, 5, 50);
      } else {
        this.ringShot(e, 10, 130);
      }
    } else if (kind === "boss-peach") {
      if (phase === 0) this.ringShot(e, 6, 120);
      else if (phase === 1) this.fanShot(e, 5, 80);
      else {
        this.ringShot(e, 8, 160);
        this.aimedShot(e, 230);
      }
    } else {
      if (phase === 0) this.fanShot(e, 3, 80);
      else if (phase === 1) {
        this.burstShot(e, 4);
      } else {
        this.ringShot(e, 8, 170);
        this.aimedShot(e, 240);
      }
    }
    e.shootAt = period;
  }

  aimedShot(e: Enemy, spd = 190) {
    const ang = Math.atan2(this.player.y - e.y, this.player.x - e.x);
    this.enemyShot(e.x, e.y + 12, Math.cos(ang) * spd, Math.sin(ang) * spd);
  }

  fanShot(e: Enemy, n: number, spread: number) {
    const mid = (n - 1) / 2;
    for (let i = 0; i < n; i++) this.enemyShot(e.x, e.y + 16, (i - mid) * spread, 165);
  }

  rainShot(e: Enemy) {
    this.enemyShot(e.x - 48, e.y + 8, 0, 150);
    this.enemyShot(e.x, e.y + 12, 0, 170);
    this.enemyShot(e.x + 48, e.y + 8, 0, 150);
  }

  ringShot(e: Enemy, n: number, spd: number) {
    const spin = (e.t ?? 0) * 1.4;
    for (let i = 0; i < n; i++) {
      const ang = spin + (i / n) * Math.PI * 2;
      this.enemyShot(e.x, e.y, Math.cos(ang) * spd, Math.sin(ang) * spd);
    }
  }

  burstShot(e: Enemy, n: number) {
    for (let i = 0; i < n; i++) this.enemyShot(e.x + (i - (n - 1) / 2) * 10, e.y + 14, 0, 180);
  }

  steerBoss(e: Enemy, dt: number) {
    const body = e.body as Phaser.Physics.Arcade.Body;
    const t = e.t ?? 0;
    const phase = this.bossPhase(e);
    if (e.intro) {
      const park = bossParkY();
      body.setVelocityY(86);
      body.setVelocityX(0);
      if (e.y >= park) {
        e.intro = false;
        e.setY(park);
        body.setVelocity(0, 0);
      }
      return;
    }
    const kind = e.kind;
    const park = bossParkY();
    const ceil = bossCeilY();
    if (kind === "boss-owl") {
      body.setVelocityX(Math.sin(t * 1.3) * (90 + phase * 30));
      if (phase < 2) body.setVelocityY(e.y > park ? -20 : 0);
      else {
        const dive = Math.sin(t * 0.9) > 0.2;
        body.setVelocityY(dive && e.y < 280 ? 130 : e.y > park ? -90 : 0);
      }
    } else if (kind === "boss-queen") {
      const dir = Math.sin(t * (1.4 + phase * 0.4)) >= 0 ? 1 : -1;
      body.setVelocityX(dir * (110 + phase * 28));
      body.setVelocityY(e.y > park ? -16 : 10);
    } else if (kind === "boss-whale") {
      body.setVelocityX(Math.sin(t * 0.7) * 55);
      body.setVelocityY(Math.sin(t * 0.5) * 18);
    } else if (kind === "boss-peach") {
      const tx = W / 2 + Math.sin(t * 0.8) * 40;
      body.setVelocityX((tx - e.x) * 2);
      body.setVelocityY(e.y > park ? -12 : 0);
    } else {
      body.setVelocityX(Math.sign(Math.sin(t * (3 + phase)) || 1) * (120 + phase * 20));
      body.setVelocityY(e.y > park + 16 ? -40 : Math.sin(t * 2) * 20);
    }
    e.x = Phaser.Math.Clamp(e.x, 50, W - 50);
    e.y = Phaser.Math.Clamp(e.y, ceil, 320);
  }

  enemyShot(x: number, y: number, vx = 0, vy?: number) {
    const p = this.take(this.pellets, x, y, "pellet") as Phaser.Physics.Arcade.Sprite | null;
    if (!p) return;
    p.setDisplaySize(20, 20);
    fitBody(p, 28);
    const fall = vy ?? (140 + Math.min(useGameStore.getState().level, 16) * 5) * (useGameStore.getState().difficulty === "easy" ? 0.85 : useGameStore.getState().difficulty === "hard" ? 1.2 : 1);
    p.setVelocity(vx, fall);
    p.play("pellet-spin");
    sfx.pellet();
  }

  steerMissiles() {
    if (this.missiles.countActive(true) === 0) return;
    const live = (this.enemies.children.entries as Enemy[]).filter((e) => e.active);
    if (live.length === 0) return;
    const list = this.missiles.children.entries as Phaser.Physics.Arcade.Sprite[];
    for (let i = 0; i < list.length; i++) {
      const m = list[i]!;
      if (!m.active) continue;
      let best: Enemy | null = null;
      let bestD = 1e9;
      for (const e of live) {
        const d = Phaser.Math.Distance.Between(m.x, m.y, e.x, e.y);
        if (d < bestD) {
          bestD = d;
          best = e;
        }
      }
      if (!best) continue;
      const ang = Phaser.Math.Angle.Between(m.x, m.y, best.x, best.y);
      const spd = missileSpd();
      const body = m.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(Math.cos(ang) * spd, Math.sin(ang) * spd);
      m.setRotation(ang + Math.PI / 2);
    }
  }

  strike(shot: Phaser.Physics.Arcade.Sprite, enemy: Enemy, dmg: number) {
    if (enemy.intro) {
      this.recycle(shot);
      return;
    }
    this.recycle(shot);
    enemy.hp = (enemy.hp ?? 1) - dmg;
    if (enemy.kind && isBossBody(enemy.kind)) sfx.bossHit();
    else sfx.hit();
    enemy.setTintFill(0xffffff);
    enemy.flash = 0.05;
    if (enemy.kind && isBossBody(enemy.kind)) {
      const now = this.time.now;
      if (now - this.bossHudAt > 80 || (enemy.hp ?? 0) <= 0) {
        this.bossHudAt = now;
        useGameStore.getState().setBoss(
          useGameStore.getState().bossName,
          Math.max(0, enemy.hp ?? 0),
          enemy.maxHp ?? 1,
        );
      }
    }
    if ((enemy.hp ?? 0) <= 0) this.killEnemy(enemy);
  }

  breakPellet(pellet: Phaser.Physics.Arcade.Sprite) {
    if (!pellet.active) return;
    this.popBoom(pellet.x, pellet.y);
    this.recycle(pellet);
    sfx.pop();
  }

  clashFire() {
    if (this.pellets.countActive(true) === 0) return;
    const hasShots = this.shots.countActive(true) > 0;
    const hasMiss = this.missiles.countActive(true) > 0;
    if (!hasShots && !hasMiss) return;
    const pellets = this.pellets.children.entries as Phaser.Physics.Arcade.Sprite[];
    const shots = hasShots ? (this.shots.children.entries as Phaser.Physics.Arcade.Sprite[]) : [];
    const missiles = hasMiss ? (this.missiles.children.entries as Phaser.Physics.Arcade.Sprite[]) : [];
    for (let i = 0; i < pellets.length; i++) {
      const p = pellets[i]!;
      if (!p.active) continue;
      let hit = false;
      if (hasShots) {
        for (let j = 0; j < shots.length; j++) {
          const s = shots[j]!;
          if (!s.active) continue;
          if (Math.abs(s.x - p.x) < 22 && Math.abs(s.y - p.y) < 26) {
            hit = true;
            break;
          }
        }
      }
      if (!hit && hasMiss) {
        for (let j = 0; j < missiles.length; j++) {
          const m = missiles[j]!;
          if (!m.active) continue;
          if (Math.abs(m.x - p.x) < 26 && Math.abs(m.y - p.y) < 28) {
            hit = true;
            break;
          }
        }
      }
      if (hit) this.breakPellet(p);
    }
  }

  ram(enemy: Enemy) {
    this.hurtPlayer();
    if (!enemy.kind || !isBossBody(enemy.kind)) this.killEnemy(enemy);
  }

  killEnemy(enemy: Enemy) {
    const pts = enemy.worth ?? 100;
    const boss = !!(enemy.kind && isBossBody(enemy.kind));
    useGameStore.getState().bumpScore(pts);
    this.popBoom(enemy.x, enemy.y);
    if (boss) {
      for (let i = 0; i < 5; i++) {
        const ox = Phaser.Math.Between(-28, 28);
        const oy = Phaser.Math.Between(-22, 22);
        this.time.delayedCall(i * 70, () => this.popBoom(enemy.x + ox, enemy.y + oy));
      }
      this.dropHeart(enemy.x - 16, enemy.y);
      this.dropHeart(enemy.x + 16, enemy.y);
      useGameStore.getState().clearBoss();
      this.cameras.main.shake(280, 0.012);
      this.cameras.main.flash(200, 255, 246, 232, false);
    } else if (Math.random() < 0.02) {
      this.dropHeart(enemy.x, enemy.y);
    }
    this.recycle(enemy);
    if (boss) sfx.bossBoom();
    else sfx.boom();
    if (!boss) this.cameras.main.shake(80, 0.004);
  }

  dropHeart(x: number, y: number) {
    const h = this.take(this.hearts, x, y, "heart") as Phaser.Physics.Arcade.Sprite | null;
    if (!h) return;
    h.setDisplaySize(28, 28);
    fitBody(h, 32);
    h.setVelocity(Phaser.Math.Between(-16, 16), 70);
  }

  collectHeart(heart: Phaser.Physics.Arcade.Sprite) {
    if (!heart.active) return;
    this.recycle(heart);
    useGameStore.getState().heal(1);
    useGameStore.getState().bumpScore(50);
    sfx.bell();
  }

  popBoom(x: number, y: number) {
    const spr = this.booms.get(x, y, "boom") as Phaser.GameObjects.Sprite | null;
    if (!spr) {
      const s = this.add.sprite(x, y, "boom");
      s.setDisplaySize(52, 52);
      s.play("boom-pop");
      s.once("animationcomplete", () => s.destroy());
      return;
    }
    spr.setActive(true).setVisible(true).setPosition(x, y).setDisplaySize(52, 52);
    spr.play("boom-pop");
    spr.once("animationcomplete", () => {
      spr.setActive(false).setVisible(false);
    });
  }

  hurtPlayer() {
    if (this.invuln > 0 || !this.runActive) return;
    this.invuln = 1.15 + liveStats().shields * 0.08;
    sfx.hurt();
    this.cameras.main.shake(160, 0.01);
    this.cameras.main.flash(80, 255, 90, 106, false);
    const dead = useGameStore.getState().hitPlayer();
    if (dead) {
      sfx.die();
      this.popBoom(this.player.x, this.player.y);
      this.player.setVisible(false);
      this.player.setVelocity(0, 0);
      this.parkWings();
      this.runActive = false;
      probe.playing = false;
    }
  }

  spawnWings() {
    this.parkWings();
    const n = Math.min(TWIN_MAX, useGameStore.getState().twins);
    for (let i = 0; i < n; i++) {
      const w = this.wings[i];
      if (!w) continue;
      const off = slotOffset(i);
      w.slot = i;
      w.hp = 2;
      w.invuln = 0.8;
      w.enableBody(true, this.player.x + off.x, this.player.y + off.y, true, true);
      w.setVisible(true);
      w.setAlpha(1);
      w.setTint(TWIN_TINTS[i] ?? 0xff8ec8);
      w.setDisplaySize(48, 48);
      fitBody(w, 18);
      w.play("player-fly");
    }
    if (n > 0) sfx.twin();
  }

  parkWings() {
    for (const w of this.wings) {
      w.disableBody(true, true);
      w.setVisible(false);
    }
    for (const fx of this.wingFx) fx.setAlpha(0);
  }

  hurtWing(wing: Wing) {
    if (!wing.active || (wing.invuln ?? 0) > 0 || !this.runActive) return;
    wing.hp = (wing.hp ?? 1) - 1;
    wing.invuln = 0.9;
    sfx.hurt();
    if ((wing.hp ?? 0) > 0) return;
    this.popBoom(wing.x, wing.y);
    wing.disableBody(true, true);
    wing.setVisible(false);
    if (!this.wings.some((w) => w.active)) useGameStore.getState().loseTwin();
  }

  maybeClearLevel() {
    if (this.clearing || !this.levelBusy) return;
    if (this.spawnQueue.length > 0) return;
    const live = (this.enemies.getChildren() as Enemy[]).some((e) => e.active);
    if (live) return;
    if (this.waveIndex + 1 < this.waves.length) {
      this.waveIndex += 1;
      this.queueWave();
      return;
    }
    this.clearing = true;
    this.levelBusy = false;
    this.runActive = false;
    probe.playing = false;
    this.player.setVelocity(0, 0);
    for (const w of this.wings) {
      if (w.active) w.setVelocity(0, 0);
    }
    this.time.delayedCall(420, () => {
      sfx.clear();
      useGameStore.getState().setPhase("upgrade");
      this.scene.pause();
    });
  }

  recycleOffscreen() {
    const check = (g: Phaser.Physics.Arcade.Group, pad = 40) => {
      const list = g.children.entries as Phaser.Physics.Arcade.Sprite[];
      for (let i = 0; i < list.length; i++) {
        const s = list[i]!;
        if (!s.active) continue;
        if ((s as Enemy).kind && isBossBody((s as Enemy).kind!)) continue;
        if (s.y < -pad || s.y > H + pad || s.x < -pad || s.x > W + pad) this.recycle(s);
      }
    };
    check(this.shots);
    check(this.missiles);
    check(this.pellets);
    check(this.hearts);
    check(this.enemies, 80);
  }

  warm(group: Phaser.Physics.Arcade.Group, key: string, n: number) {
    for (let i = 0; i < n; i++) {
      const s = group.create(0, 0, key, undefined, false, false) as Phaser.Physics.Arcade.Sprite | false;
      if (s) this.recycle(s);
    }
  }

  take(group: Phaser.Physics.Arcade.Group, x: number, y: number, key: string) {
    const s = group.get(x, y, key) as Phaser.Physics.Arcade.Sprite | null;
    if (!s) return null;
    s.enableBody(true, x, y, true, true);
    s.setActive(true).setVisible(true);
    s.clearTint();
    s.setRotation(0);
    return s;
  }

  recycle(s: Phaser.Physics.Arcade.Sprite) {
    s.disableBody(true, true);
  }

  recycleAll() {
    for (const g of [this.shots, this.missiles, this.enemies, this.pellets, this.hearts]) {
      g.getChildren().forEach((c) => this.recycle(c as Phaser.Physics.Arcade.Sprite));
    }
  }

  wireProbe() {
    if (typeof window === "undefined") return;
    window.__controlsTest = {
      getX: () => probe.x,
      getY: () => probe.y,
      getSpeed: () => Math.hypot(probe.vx, probe.vy),
      setKeys,
      skipTo: (level: number) => {
        useGameStore.setState({ level, phase: "playing" });
        this.continueRun();
      },
      summonTwin: () => {
        const n = Math.min(TWIN_MAX, useGameStore.getState().twins + 1);
        useGameStore.setState({ twins: n });
        this.spawnWings();
      },
    };
  }
}

export { W, H };
