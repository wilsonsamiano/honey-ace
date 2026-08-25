export let W = 360;
export let H = 640;

export const PHONE_FIELD = { w: 360, h: 640 };
export const TABLET_FIELD = { w: 960, h: 640 };

export function pickField(parent?: HTMLElement | null) {
  const cssW = parent?.clientWidth || 360;
  const next = cssW >= 520 ? TABLET_FIELD : PHONE_FIELD;
  W = next.w;
  H = next.h;
  return next;
}
