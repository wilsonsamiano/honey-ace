import { startMusic, unlockAudio } from "./audio";
import { useGameStore } from "./store";

export type InputState = {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  fire: boolean;
};

export const input: InputState = {
  left: false,
  right: false,
  up: false,
  down: false,
  fire: false,
};

export const twinKeys = {
  left: false,
  right: false,
  up: false,
  down: false,
};

export type Aim = {
  id: number;
  clientX: number;
  clientY: number;
  kind: "mouse" | "touch";
};

export const pointer = {
  clientX: 0,
  clientY: 0,
  touchDown: false,
  mouseLive: false,
  kind: "mouse" as "mouse" | "touch",
};

const aims = new Map<number, Aim>();
let primaryId: number | null = null;
const held = new Set<string>();
const uiPointers = new Set<number>();

function isTouchPointer(e: PointerEvent) {
  return e.pointerType === "touch" || e.pointerType === "pen";
}

export function markUiPointer(id: number) {
  uiPointers.add(id);
  if (aims.has(id)) {
    aims.delete(id);
    if (primaryId === id) primaryId = aims.size ? [...aims.keys()][0]! : null;
    syncPointer();
  }
}

function syncFromKeys() {
  input.left = held.has("KeyA");
  input.right = held.has("KeyD");
  input.up = held.has("KeyW");
  input.down = held.has("KeyS");
  twinKeys.left = held.has("ArrowLeft");
  twinKeys.right = held.has("ArrowRight");
  twinKeys.up = held.has("ArrowUp");
  twinKeys.down = held.has("ArrowDown");
  if (!useGameStore.getState().twins) {
    input.left = input.left || twinKeys.left;
    input.right = input.right || twinKeys.right;
    input.up = input.up || twinKeys.up;
    input.down = input.down || twinKeys.down;
  }
  input.fire = held.has("Space") || held.has("KeyJ") || held.has("KeyZ");
}

function syncPointer() {
  const main = primaryId !== null ? aims.get(primaryId) : undefined;
  if (!main) {
    pointer.touchDown = false;
    return;
  }
  pointer.clientX = main.clientX;
  pointer.clientY = main.clientY;
  pointer.kind = main.kind;
  pointer.touchDown = main.kind === "touch";
  if (main.kind === "mouse") pointer.mouseLive = true;
}

function remember(e: PointerEvent) {
  const kind = isTouchPointer(e) ? "touch" : "mouse";
  aims.set(e.pointerId, { id: e.pointerId, clientX: e.clientX, clientY: e.clientY, kind });
  if (primaryId === null || !aims.has(primaryId)) primaryId = e.pointerId;
  syncPointer();
}

function isUi(e: Event) {
  const t = e.target as HTMLElement | null;
  return !!t?.closest("button, a, [data-ui]");
}

function onKeyDown(e: KeyboardEvent) {
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
    e.preventDefault();
  }
  if (e.code === "Escape" || e.code === "KeyP") {
    e.preventDefault();
    useGameStore.getState().togglePause();
    return;
  }
  held.add(e.code);
  syncFromKeys();
  unlockAudio();
  startMusic();
}

function onKeyUp(e: KeyboardEvent) {
  held.delete(e.code);
  syncFromKeys();
}

export function clearKeys() {
  held.clear();
  input.left = input.right = input.up = input.down = input.fire = false;
  twinKeys.left = twinKeys.right = twinKeys.up = twinKeys.down = false;
}

function playing() {
  return useGameStore.getState().phase === "playing";
}

function blocked(e: PointerEvent) {
  if (uiPointers.has(e.pointerId)) return true;
  if (!playing()) return true;
  return isUi(e);
}

function onPointerDown(e: PointerEvent) {
  if (isUi(e)) {
    markUiPointer(e.pointerId);
    return;
  }
  if (blocked(e)) return;
  remember(e);
  unlockAudio();
  startMusic();
}

function onPointerMove(e: PointerEvent) {
  if (blocked(e)) return;
  remember(e);
}

function onPointerUp(e: PointerEvent) {
  uiPointers.delete(e.pointerId);
  if (isTouchPointer(e)) {
    aims.delete(e.pointerId);
    if (primaryId === e.pointerId) {
      primaryId = aims.size ? [...aims.keys()][0]! : null;
    }
  } else if (!blocked(e)) {
    remember(e);
  }
  syncPointer();
}

export function bindMenuTaps() {
  const fire = (x: number, y: number, e: Event) => {
    const node = document
      .elementsFromPoint(x, y)
      .find((el) => el instanceof HTMLElement && el.closest("[data-ui]")) as HTMLElement | undefined;
    const ui = node?.closest("button[data-ui]") as HTMLButtonElement | null;
    if (!ui) return false;
    if (ui.dataset.tapLock === "1") return true;
    ui.dataset.tapLock = "1";
    window.setTimeout(() => {
      ui.dataset.tapLock = "";
    }, 350);
    ui.click();
    e.preventDefault();
    e.stopPropagation();
    return true;
  };

  const fromPointer = (e: Event) => {
    if (e instanceof PointerEvent && e.button !== 0 && e.pointerType === "mouse") return;
    const p = e as PointerEvent | MouseEvent;
    if ("clientX" in p) fire(p.clientX, p.clientY, e);
  };
  const fromTouch = (e: Event) => {
    const t = e as TouchEvent;
    const touch = t.changedTouches[0];
    if (!touch) return;
    fire(touch.clientX, touch.clientY, e);
  };

  document.addEventListener("pointerdown", fromPointer, true);
  document.addEventListener("mousedown", fromPointer, true);
  document.addEventListener("touchstart", fromTouch, { capture: true, passive: false });
  return () => {
    document.removeEventListener("pointerdown", fromPointer, true);
    document.removeEventListener("mousedown", fromPointer, true);
    document.removeEventListener("touchstart", fromTouch, true);
  };
}

export function bindInput() {
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", clearKeys);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearKeys();
      for (const [id, aim] of [...aims]) {
        if (aim.kind === "touch") aims.delete(id);
      }
      pointer.touchDown = false;
      if (primaryId !== null && !aims.has(primaryId)) {
        primaryId = aims.size ? [...aims.keys()][0]! : null;
      }
      syncPointer();
      if (useGameStore.getState().phase === "playing") useGameStore.getState().togglePause();
    }
  });
  window.addEventListener("pointerdown", onPointerDown, { passive: true });
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerup", onPointerUp, { passive: true });
  window.addEventListener("pointercancel", onPointerUp, { passive: true });
  return () => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", clearKeys);
    window.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
  };
}

export function pointerSteering() {
  return pointer.touchDown || pointer.mouseLive;
}

export function extraAims(): Aim[] {
  const extras: Aim[] = [];
  for (const aim of aims.values()) {
    if (aim.id === primaryId) continue;
    if (aim.kind !== "touch") continue;
    extras.push(aim);
  }
  extras.sort((a, b) => a.id - b.id);
  return extras;
}

export function setKeys(codes: string[]) {
  held.clear();
  for (const c of codes) held.add(c);
  syncFromKeys();
  pointer.touchDown = false;
  pointer.mouseLive = false;
  aims.clear();
  primaryId = null;
}
