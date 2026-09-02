import { useEffect, useRef, useState } from "react";
import { Coffee, Copy, Flame, Gauge, Github, Heart, Maximize2, MessageCircle, Minimize2, Pause, Rocket, Share2, Shield, Users } from "lucide-react";
import { bindInput, bindMenuTaps } from "@/game/input";
import { startMusic, stopMusic, unlockAudio, sfx } from "@/game/audio";
import { UiButton } from "./usePress";
import {
  hydrateBest,
  atCap,
  DIFFICULTIES,
  nextBlurb,
  UPGRADES,
  useGameStore,
  type Difficulty,
  type Stats,
  type UpgradeId,
} from "@/game/store";

type GameApi = typeof import("@/game/createGame");

export const PLAY_URL = "https://honey-ace.grok.me";
export const REPO_URL = "https://github.com/wilsonsamiano/honey-ace";

export function HoneyAce() {
  const hostRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<GameApi | null>(null);
  const [full, setFull] = useState(false);
  const phase = useGameStore((s) => s.phase);
  const difficulty = useGameStore((s) => s.difficulty);
  const best = useGameStore((s) => s.best);
  const onTitle = phase === "menu";
  const overlay = phase !== "playing" && phase !== "menu";

  useEffect(() => {
    hydrateBest();
    const unbindMenu = bindMenuTaps();
    const onFs = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      unbindMenu();
      document.removeEventListener("fullscreenchange", onFs);
      stopMusic();
      apiRef.current?.destroyHoneyAce();
      apiRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (onTitle) return;
    const unbind = bindInput();
    return unbind;
  }, [onTitle]);

  useEffect(() => {
    if (onTitle || apiRef.current || !hostRef.current) return;
    let cancelled = false;
    void import("@/game/createGame").then((api) => {
      if (cancelled || !hostRef.current) return;
      apiRef.current = api;
      api.createHoneyAce(hostRef.current);
      if (useGameStore.getState().phase === "playing") {
        api.getPlayScene()?.startRun();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [onTitle]);

  function begin() {
    unlockAudio();
    sfx.start();
    startMusic();
    useGameStore.getState().startRun();
    const scene = apiRef.current?.getPlayScene();
    if (scene) {
      scene.scene.resume();
      scene.startRun();
    }
  }

  function pick(id: UpgradeId) {
    unlockAudio();
    sfx.upgrade();
    startMusic();
    useGameStore.getState().applyUpgrade(id);
    apiRef.current?.getPlayScene()?.continueRun();
  }

  function pauseGame() {
    if (useGameStore.getState().phase !== "playing") return;
    sfx.pause();
    useGameStore.getState().togglePause();
  }

  function resumeGame() {
    sfx.resume();
    useGameStore.getState().resume();
    startMusic();
    apiRef.current?.getPlayScene()?.scene.resume();
  }

  function quitGame() {
    useGameStore.getState().quitToMenu();
    apiRef.current?.getPlayScene()?.scene.resume();
  }

  async function toggleFull() {
    const node = frameRef.current as (HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> }) | null;
    if (!node) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (node.requestFullscreen) await node.requestFullscreen();
      else await node.webkitRequestFullscreen?.();
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="relative flex min-h-dvh flex-col items-center overflow-x-hidden bg-sky px-3 py-3 text-ink sm:px-5 sm:py-5">
      <HeaderBar />

      {onTitle && (
        <MenuCard
          best={best}
          difficulty={difficulty}
          onRank={(id) => {
            useGameStore.getState().setDifficulty(id);
            unlockAudio();
            sfx.ui();
          }}
          onStart={begin}
        />
      )}

      <div
        ref={frameRef}
        className={
          onTitle
            ? "hidden"
            : `relative w-full max-w-[390px] overflow-hidden rounded-xl bg-sky-deep shadow-panel ring-1 ring-line md:max-w-[min(96vw,1080px)] ${
                overlay ? "" : "touch-none"
              }`
        }
        style={onTitle || overlay ? undefined : { touchAction: "none" }}
      >
        <div
          ref={hostRef}
          data-game-host="true"
          className="pointer-events-none mx-auto aspect-[360/640] w-full select-none md:aspect-[3/2]"
        />

        {!onTitle && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-2">
            <ScoreChip />
            <div className="flex items-start gap-1.5">
              <StageChip />
              <UiButton
                data-ui="full"
                onPress={toggleFull}
                className="pointer-events-auto flex size-9 shrink-0 items-center justify-center rounded-md bg-paper/90 text-ink shadow-panel ring-1 ring-line"
                aria-label={full ? "Exit full screen" : "Full screen"}
              >
                {full ? <Minimize2 className="size-4" strokeWidth={2.4} /> : <Maximize2 className="size-4" strokeWidth={2.4} />}
              </UiButton>
              {phase === "playing" && (
                <UiButton
                  data-ui="pause"
                  onPress={pauseGame}
                  className="pointer-events-auto flex size-9 shrink-0 items-center justify-center rounded-md bg-paper/90 text-ink shadow-panel ring-1 ring-line"
                  aria-label="Pause"
                >
                  <Pause className="size-4" strokeWidth={2.4} />
                </UiButton>
              )}
            </div>
          </div>
        )}

        <BossBar />
        <RankBar />

        {overlay && (
          <Overlay begin={begin} pick={pick} resumeGame={resumeGame} quitGame={quitGame} />
        )}
      </div>

      <p className="mt-3 max-w-[390px] text-center text-sm text-muted md:max-w-[min(96vw,1080px)]">
        Phones stay tall. On a tablet, the sky opens wide — sit side by side, one finger each. Esc or P pauses.
      </p>
    </div>
  );
}
