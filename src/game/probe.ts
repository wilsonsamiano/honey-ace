export const probe = {
  x: 180,
  y: 520,
  vx: 0,
  vy: 0,
  w: 360,
  h: 640,
  playing: false,
};

declare global {
  interface Window {
    __controlsTest?: {
      getX: () => number;
      getY: () => number;
      getSpeed: () => number;
      setKeys: (codes: string[]) => void;
      skipTo?: (level: number) => void;
      summonTwin?: () => void;
    };
  }
}
