let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let musicOn = false;
let nextNote = 0;
let musicHandle = 0;
let visBound = false;

export function unlockAudio() {
  if (!ctx) {
    ctx = new AudioContext({ latencyHint: "interactive" });
    master = ctx.createGain();
    sfxBus = ctx.createGain();
    musicBus = ctx.createGain();
    sfxBus.gain.value = 0.8;
    musicBus.gain.value = 0.42;
    master.gain.value = 0.85;
    sfxBus.connect(master);
    musicBus.connect(master);
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  if (!visBound) {
    visBound = true;
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        void ctx?.resume();
        if (musicOn) startMusic();
      }
    });
  }
}

function tone(freq: number, dur: number, type: OscillatorType, gain = 0.05, when = 0, slide?: number) {
  if (!ctx || !sfxBus) return;
  const t0 = ctx.currentTime + when;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(Math.max(20, freq), t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t0 + dur);
  g.gain.setValueAtTime(Math.max(0.0001, gain), t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(sfxBus);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise(dur: number, gain: number, cutoff = 900, when = 0) {
  if (!ctx || !sfxBus) return;
  const t0 = ctx.currentTime + when;
  const n = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.setValueAtTime(cutoff, t0);
  f.frequency.exponentialRampToValueAtTime(180, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f);
  f.connect(g);
  g.connect(sfxBus);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

function arp(notes: number[], step: number, type: OscillatorType, gain: number) {
  notes.forEach((f, i) => tone(f, step * 1.6, type, gain, i * step));
}

let lastPew = 0;
let lastPel = 0;
let lastTick = 0;

export const sfx = {
  shoot: () => {
    if (!ctx) return;
    const t = ctx.currentTime;
    if (t - lastPew < 0.05) return;
    lastPew = t;
    tone(980 + Math.random() * 80, 0.06, "square", 0.018, 0, 620);
    tone(1480, 0.03, "triangle", 0.01);
  },
  missile: () => {
    tone(180, 0.16, "sawtooth", 0.03, 0, 420);
    tone(520, 0.08, "square", 0.016, 0.04, 240);
  },
  hit: () => {
    if (!ctx) return;
    const t = ctx.currentTime;
    if (t - lastTick < 0.03) return;
    lastTick = t;
    tone(620 + Math.random() * 80, 0.05, "triangle", 0.028, 0, 280);
  },
  bossHit: () => {
    tone(210, 0.07, "square", 0.03);
    tone(340, 0.05, "triangle", 0.02, 0.02);
  },
  boom: () => {
    noise(0.18, 0.08, 700);
    tone(160, 0.14, "sawtooth", 0.03, 0, 70);
    tone(90, 0.2, "triangle", 0.022);
  },
  bossBoom: () => {
    noise(0.42, 0.11, 500);
    tone(140, 0.28, "sawtooth", 0.04, 0, 48);
    tone(90, 0.36, "square", 0.02, 0.04, 40);
    arp([392, 330, 262, 196], 0.07, "triangle", 0.024);
  },
  pellet: () => {
    if (!ctx) return;
    const t = ctx.currentTime;
    if (t - lastPel < 0.08) return;
    lastPel = t;
    tone(280 + Math.random() * 40, 0.05, "square", 0.012, 0, 160);
  },
  pop: () => tone(740, 0.04, "triangle", 0.016, 0, 400),
  bell: () => {
    arp([784, 988, 1175, 1568], 0.055, "sine", 0.032);
  },
  hurt: () => {
    tone(220, 0.12, "square", 0.04, 0, 90);
    noise(0.12, 0.04, 400);
  },
  die: () => {
    tone(330, 0.4, "sawtooth", 0.04, 0, 70);
    tone(196, 0.5, "square", 0.03, 0.05, 50);
    noise(0.35, 0.07, 350);
  },
  upgrade: () => {
    arp([523, 659, 784, 1046], 0.07, "sine", 0.034);
  },
  twin: () => {
    arp([659, 784, 988, 1318], 0.06, "triangle", 0.03);
  },
  warning: () => {
    tone(392, 0.16, "square", 0.036);
    tone(262, 0.18, "square", 0.03, 0.16);
    tone(392, 0.16, "square", 0.036, 0.34);
    tone(196, 0.28, "sawtooth", 0.024, 0.5);
  },
  clear: () => {
    arp([523, 659, 784, 988, 1318], 0.08, "sine", 0.03);
  },
  start: () => {
    arp([392, 523, 659, 784], 0.07, "triangle", 0.032);
  },
  pause: () => tone(330, 0.1, "sine", 0.028, 0, 220),
  resume: () => tone(523, 0.1, "sine", 0.028, 0, 784),
  ui: () => tone(880, 0.04, "sine", 0.02),
};

const BPM = 68;
const BEAT = 60 / BPM;
const LOOP_BEATS = 128;

const PAD = [130.81, 110.0, 87.31, 98.0, 146.83, 110.0, 87.31, 123.47];
const FIFTH = [196.0, 164.81, 130.81, 146.83, 220.0, 164.81, 130.81, 185.0];
const BASS = [65.41, 55.0, 43.65, 49.0, 73.42, 55.0, 43.65, 61.74];
const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
const MOTIF = [0, 2, 4, 2, 3, 4, 2, 0, 4, 5, 4, 2, 3, 2, 0, 2];

function voice(when: number, freq: number, dur: number, type: OscillatorType, vol: number, attack = 0.12) {
  if (!ctx || !musicBus || freq <= 0) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, when);
  const t0 = Math.max(when, ctx.currentTime);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(musicBus);
  o.start(when);
  o.stop(when + dur + 0.08);
}

function tickMusic() {
  if (!ctx || !musicOn) return;
  const now = ctx.currentTime;
  if (nextNote < now - 0.4) nextNote = now;
  while (nextNote < now + 0.5) {
    const beat = Math.floor(nextNote / BEAT);
    const i = ((beat % LOOP_BEATS) + LOOP_BEATS) % LOOP_BEATS;
    const bar = Math.floor(i / 4) % PAD.length;

    if (i % 4 === 0) {
      voice(nextNote, PAD[bar], BEAT * 4.4, "sine", 0.07, 0.35);
      voice(nextNote, FIFTH[bar], BEAT * 4.4, "sine", 0.045, 0.4);
      voice(nextNote, BASS[bar], BEAT * 3.8, "triangle", 0.08, 0.18);
    }

    const degree = MOTIF[i % MOTIF.length];
    const cycle = Math.floor(i / 32) % 4;
    if (i % 2 === 0) {
      const shift = cycle === 2 ? 1 : cycle === 3 ? -1 : 0;
      const idx = Math.max(0, Math.min(SCALE.length - 1, degree + shift));
      const oct = cycle === 1 ? 0.5 : 1;
      voice(nextNote, SCALE[idx] * oct, BEAT * 2.2, "sine", 0.055, 0.08);
    }

    nextNote += BEAT;
  }
  musicHandle = window.setTimeout(tickMusic, 90);
}

export function startMusic() {
  unlockAudio();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  if (musicOn && musicHandle) return;
  musicOn = true;
  nextNote = ctx.currentTime + 0.04;
  tickMusic();
}

export function stopMusic() {
  musicOn = false;
  if (musicHandle) window.clearTimeout(musicHandle);
  musicHandle = 0;
}
