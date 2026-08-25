import * as Phaser from "phaser";
import { PlayScene } from "./scenes/PlayScene";
import { H, pickField, W } from "./field";

let game: Phaser.Game | null = null;

export function createHoneyAce(parent: HTMLElement) {
  if (game) {
    game.destroy(true);
    game = null;
  }
  parent.innerHTML = "";
  const field = pickField(parent);
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: field.w,
    height: field.h,
    backgroundColor: "#6ec8f5",
    pixelArt: false,
    antialias: false,
    roundPixels: true,
    banner: false,
    disableContextMenu: true,
    powerPreference: "high-performance",
    fps: { target: 60, min: 30, smoothStep: true },
    render: {
      antialias: false,
      roundPixels: true,
      batchSize: 4096,
      powerPreference: "high-performance",
    },
    physics: {
      default: "arcade",
      arcade: { gravity: { x: 0, y: 0 }, debug: false, fps: 60, overlapBias: 8 },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: field.w,
      height: field.h,
      parent,
      expandParent: false,
    },
    input: { keyboard: false, mouse: false, touch: false },
    scene: [PlayScene],
    audio: { noAudio: true },
    callbacks: {
      postBoot: (g) => {
        const canvas = g.canvas;
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.style.display = "block";
        canvas.style.willChange = "transform";
        canvas.style.pointerEvents = "none";
        if (canvas.parentElement !== parent) parent.appendChild(canvas);
        g.scale.refresh();
      },
    },
  });
  const apply = () => {
    if (!game) return;
    const next = pickField(parent);
    if (game.scale.gameSize.width !== next.w || game.scale.gameSize.height !== next.h) {
      game.scale.resize(next.w, next.h);
      const scene = game.scene.getScene("play") as PlayScene | undefined;
      scene?.relayout();
    } else {
      game.scale.refresh();
    }
  };
  const ro = new ResizeObserver(() => apply());
  ro.observe(parent);
  game.events.once("destroy", () => ro.disconnect());
  return game;
}

export function destroyHoneyAce() {
  game?.destroy(true);
  game = null;
}

export function getPlayScene() {
  return game?.scene.getScene("play") as PlayScene | undefined;
}

export { W, H };
