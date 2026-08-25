import { useEffect, useRef, useState } from "react";
import { Coffee, Copy, Flame, Gauge, Heart, Maximize2, MessageCircle, Minimize2, Pause, Rocket, Share2, Shield, Users } from "lucide-react";
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

function HeaderBar() {
  const best = useGameStore((s) => s.best);
  return (
    <div className="mb-3 flex w-full max-w-[390px] items-center justify-between gap-3 px-1 md:max-w-[min(96vw,1080px)]">
      <div className="flex items-center gap-3">
        <img
          src="/mascot.png"
          alt=""
          className="bee-bob size-12 rounded-full bg-sky-deep object-cover ring-1 ring-line"
        />
        <div>
          <p className="font-display text-xs font-semibold tracking-wide text-muted uppercase">
            Cartoon squadron
          </p>
          <h1 className="font-display text-3xl leading-none font-semibold tracking-tight">Honey Ace</h1>
        </div>
      </div>
      <p className="font-sans text-sm font-bold tabular-nums text-muted">Best {best}</p>
    </div>
  );
}

function ScoreChip() {
  const score = useGameStore((s) => s.score);
  const motif = useGameStore((s) => s.motif);
  return (
    <div className="rounded-md bg-paper/90 px-2.5 py-1.5 shadow-panel ring-1 ring-line">
      <p className="text-[10px] font-bold tracking-wide text-muted uppercase">Score</p>
      <p className="font-display text-lg leading-none font-semibold tabular-nums">{score}</p>
      {motif ? <p className="mt-0.5 text-[9px] font-bold text-muted">{motif}</p> : null}
    </div>
  );
}

function StageChip() {
  const level = useGameStore((s) => s.level);
  const hp = useGameStore((s) => s.hp);
  const maxHp = useGameStore((s) => s.maxHp);
  const twins = useGameStore((s) => s.twins);
  const difficulty = useGameStore((s) => s.difficulty);
  const phase = useGameStore((s) => s.phase);
  const climate = useGameStore((s) => s.climate);
  const heartCount = Math.min(maxHp, 8);
  return (
    <div className="rounded-md bg-paper/90 px-2.5 py-1.5 text-right shadow-panel ring-1 ring-line">
      <p className="text-[10px] font-bold tracking-wide text-muted uppercase">Stage {level}</p>
      <div className="mt-1 flex items-center justify-end gap-0.5" aria-label={`Hull ${hp} of ${maxHp}`}>
        {Array.from({ length: heartCount }).map((_, i) => (
          <Heart
            key={i}
            className={`size-4 ${i < Math.min(hp, heartCount) ? "fill-cherry text-cherry" : "text-line"}`}
            strokeWidth={2}
          />
        ))}
        {maxHp > 8 && <span className="ml-1 text-xs font-bold tabular-nums text-ink">{hp}</span>}
      </div>
      {phase !== "menu" && (
        <p className="mt-1 font-sans text-[10px] font-bold tracking-wide text-muted uppercase">
          {climate} · {twins > 0 ? "Twin ace" : "Solo"} · {difficulty}
        </p>
      )}
    </div>
  );
}

function BossBar() {
  const phase = useGameStore((s) => s.phase);
  const bossName = useGameStore((s) => s.bossName);
  const bossHp = useGameStore((s) => s.bossHp);
  const bossMax = useGameStore((s) => s.bossMax);
  if (phase !== "playing" || bossMax <= 0) return null;
  return (
    <div className="pointer-events-none absolute inset-x-16 top-1 z-10">
      <div className="mx-auto max-w-sm rounded-md bg-paper/90 px-2 py-1 shadow-panel ring-1 ring-line">
        <p className="text-center text-[9px] font-bold tracking-wide text-cherry uppercase">
          {bossName}
        </p>
        <div className="mt-0.5 h-1.5 overflow-hidden rounded-sm bg-line" aria-label={`${bossName} hull ${bossHp}`}>
          <div
            className="h-full rounded-sm bg-cherry transition-[width] duration-150"
            style={{ width: `${Math.max(0, Math.min(100, (bossHp / bossMax) * 100))}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function RankBar() {
  const phase = useGameStore((s) => s.phase);
  const stats = useGameStore((s) => s.stats);
  const twins = useGameStore((s) => s.twins);
  if (phase !== "playing") return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center px-3">
      <div className="flex items-center gap-2 rounded-md bg-paper/90 px-2 py-1.5 shadow-panel ring-1 ring-line">
        <RankPips icon={Flame} value={stats.firepower} max={8} label="Fire" />
        <RankPips icon={Rocket} value={stats.missiles} max={6} label="Rockets" />
        <RankPips icon={Shield} value={stats.shields} max={8} label="Hull" />
        <RankPips icon={Gauge} value={stats.speed} max={6} label="Speed" />
        {twins > 0 ? <Users className="size-3.5 text-cherry" strokeWidth={2.4} aria-label="Twin Bee" /> : null}
      </div>
    </div>
  );
}

function Overlay({
  begin,
  pick,
  resumeGame,
  quitGame,
}: {
  begin: () => void;
  pick: (id: UpgradeId) => void;
  resumeGame: () => void;
  quitGame: () => void;
}) {
  const phase = useGameStore((s) => s.phase);
  const best = useGameStore((s) => s.best);
  const score = useGameStore((s) => s.score);
  const level = useGameStore((s) => s.level);
  const stats = useGameStore((s) => s.stats);
  const twins = useGameStore((s) => s.twins);
  const motif = useGameStore((s) => s.motif);
  return (
    <div
      data-ui="overlay"
      className="pointer-events-auto absolute inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-ink/40 p-3"
    >
      {phase === "paused" && (
        <PauseCard score={score} level={level} onResume={resumeGame} onQuit={quitGame} />
      )}
      {phase === "upgrade" && (
        <UpgradeCard stats={stats} twins={twins} level={level} motif={motif} onPick={pick} />
      )}
      {(phase === "gameover" || phase === "victory") && (
        <EndCard title="Shot down" score={score} best={best} level={level} onAgain={begin} />
      )}
    </div>
  );
}

function PauseCard({
  score,
  level,
  onResume,
  onQuit,
}: {
  score: number;
  level: number;
  onResume: () => void;
  onQuit: () => void;
}) {
  return (
    <div className="w-full max-w-[280px] rounded-lg bg-paper p-5 text-center shadow-panel ring-1 ring-line">
      <p className="font-display text-sm font-semibold tracking-wide text-cherry uppercase">Paused</p>
      <h2 className="font-display mt-1 text-3xl font-semibold">Hold fire</h2>
      <p className="mt-2 text-sm text-muted">
        Stage {level} · {score} pts
      </p>
      <UiButton
        onPress={onResume}
        className="mt-4 h-11 w-full rounded-md bg-cherry text-sm font-bold text-paper transition-transform duration-150 hover:brightness-105 active:scale-[0.98]"
      >
        Resume
      </UiButton>
      <UiButton
        onPress={onQuit}
        className="mt-2 h-11 w-full rounded-md bg-sky/40 text-sm font-bold ring-1 ring-line transition-transform duration-150 hover:bg-sky/70 active:scale-[0.98]"
      >
        Title screen
      </UiButton>
    </div>
  );
}

function MenuCard({
  best,
  difficulty,
  onRank,
  onStart,
}: {
  best: number;
  difficulty: Difficulty;
  onRank: (id: Difficulty) => void;
  onStart: () => void;
}) {
  return (
    <div className="w-full max-w-[390px] rounded-lg bg-paper p-5 text-center shadow-panel ring-1 ring-line md:max-w-[420px]">
      <img
        src="/mascot.png"
        alt="Bumble, the Honey Ace"
        className="bee-bob mx-auto size-20 rounded-full bg-sky-deep object-cover ring-2 ring-honey/50"
      />
      <h2 className="font-display mt-3 text-3xl leading-none font-semibold">Honey Ace</h2>
      <p className="mt-2 text-sm text-muted">Pick a rank, then fly.</p>
      <div className="mt-4 grid grid-cols-1 gap-2" role="group" aria-label="Difficulty">
        {DIFFICULTIES.map((d) => {
          const on = difficulty === d.id;
          return (
            <button
              key={d.id}
              type="button"
              data-ui="rank"
              data-rank={d.id}
              aria-pressed={on}
              onClick={() => onRank(d.id)}
              className={`flex min-h-14 w-full items-center justify-between rounded-md px-4 text-left ring-1 ${
                on ? "bg-cherry text-paper ring-cherry" : "bg-sky/40 text-ink ring-line"
              }`}
            >
              <span className="text-base font-bold tracking-wide uppercase">{d.title}</span>
              <span className={`text-xs ${on ? "text-paper/80" : "text-muted"}`}>{d.blurb}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs font-bold tracking-wide text-muted uppercase">Best {best}</p>
      <button
        type="button"
        data-ui="start"
        onClick={onStart}
        className="mt-3 flex h-14 w-full items-center justify-center rounded-md bg-cherry text-base font-bold text-paper ring-1 ring-cherry"
      >
        Start sortie
      </button>
      <a
        href="https://buymeacoffee.com/wilsonsamiano"
        target="_blank"
        rel="noreferrer"
        data-ui="coffee"
        className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-sky/40 text-sm font-bold ring-1 ring-line transition-transform duration-150 hover:bg-sky/70 active:scale-[0.98]"
      >
        <Coffee className="size-4 text-cherry" strokeWidth={2.4} />
        Buy me a coffee
      </a>
    </div>
  );
}

function UpgradeCard({
  stats,
  twins,
  level,
  motif,
  onPick,
}: {
  stats: Stats;
  twins: number;
  level: number;
  motif: string;
  onPick: (id: UpgradeId) => void;
}) {
  const icons = {
    firepower: Flame,
    missiles: Rocket,
    shields: Shield,
    speed: Gauge,
    twin: Users,
  };
  const choices = UPGRADES.filter((u) => !atCap(u.id, stats, twins));
  return (
    <div className="w-full max-w-[320px] rounded-lg bg-paper p-4 shadow-panel ring-1 ring-line">
      <h2 className="font-display text-2xl font-semibold">Stage {level} clear</h2>
      <p className="mt-1 text-sm text-muted">
        {motif ? `${motif} is done. ` : ""}Pick one rank. Caps hide when maxed.
      </p>
      <p className="mt-2 text-[10px] font-bold tracking-wide text-muted uppercase">
        Fire {stats.firepower} · Rockets {stats.missiles} · Hull {stats.shields} · Speed {stats.speed}
        {twins > 0 ? " · Twin" : ""}
      </p>
      <div className="mt-3 grid grid-cols-1 gap-2">
        {choices.map((u) => {
          const Icon = icons[u.id];
          const rank = u.id === "twin" ? 0 : stats[u.id];
          const pips = u.id === "firepower" || u.id === "shields" ? 8 : 6;
          return (
            <UiButton
              key={u.id}
              onPress={() => onPick(u.id)}
              className="flex min-h-11 items-center gap-3 rounded-md bg-sky/40 px-3 py-2 text-left ring-1 ring-line transition-transform duration-150 hover:bg-sky/70 active:scale-[0.99]"
            >
              <span className="flex size-9 items-center justify-center rounded-sm bg-paper ring-1 ring-line">
                <Icon className="size-4 text-ink" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{u.title}</span>
                <span className="block text-xs text-muted">{nextBlurb(u.id, stats, twins)}</span>
                {u.id !== "twin" && (
                  <span className="mt-1 flex gap-0.5">
                    {Array.from({ length: pips }).map((_, i) => (
                      <span
                        key={i}
                        className={`block size-1.5 rounded-full ${i < rank ? "bg-cherry" : "bg-line"}`}
                      />
                    ))}
                  </span>
                )}
              </span>
              <span className="font-display text-lg font-semibold tabular-nums">
                {u.id === "twin" ? "Call" : `Lv ${stats[u.id]}`}
              </span>
            </UiButton>
          );
        })}
      </div>
    </div>
  );
}

function RankPips({
  icon: Icon,
  value,
  max,
  label,
}: {
  icon: typeof Flame;
  value: number;
  max: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1" aria-label={`${label} ${value} of ${max}`}>
      <Icon className="size-3 text-ink" strokeWidth={2.4} />
      <span className="flex gap-px">
        {Array.from({ length: max }).map((_, i) => (
          <span key={i} className={`block h-2 w-1 rounded-sm ${i < value ? "bg-cherry" : "bg-line"}`} />
        ))}
      </span>
    </div>
  );
}

function shareBits(score: number, best: number, level: number, rank: string) {
  const text = `I scored ${score.toLocaleString()} on Honey Ace (${rank}) — Stage ${level}. High score ${best.toLocaleString()}. Think you can beat Bumble?`;
  const url = typeof window === "undefined" ? "https://github.com/wilsonsamiano/honey-ace" : window.location.href.split("#")[0];
  return { text, url, full: `${text} ${url}` };
}

function EndCard({
  title,
  score,
  best,
  level,
  onAgain,
}: {
  title: string;
  score: number;
  best: number;
  level: number;
  onAgain: () => void;
}) {
  const difficulty = useGameStore((s) => s.difficulty);
  const rank = DIFFICULTIES.find((d) => d.id === difficulty)?.title ?? "Normal";
  const [copied, setCopied] = useState(false);

  async function shareNative() {
    const { text, url, full } = shareBits(score, best, level, rank);
    try {
      if (navigator.share) {
        await navigator.share({ title: "Honey Ace", text, url });
        return;
      }
    } catch (err) {
      if ((err as DOMException).name === "AbortError") return;
    }
    await copyShare(full);
  }

  async function copyShare(value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      /* ignore */
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function openShare(href: string, extra?: string) {
    if (extra) void copyShare(extra);
    window.open(href, "_blank", "noopener,noreferrer");
  }

  const { text, url, full } = shareBits(score, best, level, rank);
  const encoded = encodeURIComponent(full);
  const encodedUrl = encodeURIComponent(url);

  return (
    <div className="w-full max-w-[320px] rounded-lg bg-paper p-5 text-center shadow-panel ring-1 ring-line">
      <h2 className="font-display text-3xl font-semibold">{title}</h2>
      <p className="mt-2 font-display text-2xl font-semibold tabular-nums">{score.toLocaleString()}</p>
      <p className="mt-1 text-xs font-bold tracking-wide text-muted uppercase">
        {rank} · Stage {level} · Best {best.toLocaleString()}
      </p>
      <UiButton
        onPress={onAgain}
        className="mt-4 h-11 w-full rounded-md bg-cherry text-sm font-bold text-paper transition-transform duration-150 hover:brightness-105 active:scale-[0.98]"
      >
        Fly again
      </UiButton>
      <p className="mt-3 text-xs font-bold tracking-wide text-muted uppercase">Share this run</p>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <button
          type="button"
          data-ui="share"
          onClick={() => void shareNative()}
          className="flex min-h-11 items-center justify-center gap-1 rounded-md bg-cherry px-1 text-xs font-bold text-paper"
        >
          <Share2 className="size-3.5" strokeWidth={2.4} />
          Share
        </button>
        <button
          type="button"
          data-ui="share"
          onClick={() => openShare(`https://twitter.com/intent/tweet?text=${encoded}`)}
          className="flex min-h-11 items-center justify-center rounded-md bg-sky/40 text-xs font-bold ring-1 ring-line"
        >
          X
        </button>
        <button
          type="button"
          data-ui="share"
          onClick={() => openShare(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodeURIComponent(text)}`)}
          className="flex min-h-11 items-center justify-center rounded-md bg-sky/40 text-xs font-bold ring-1 ring-line"
        >
          Facebook
        </button>
        <button
          type="button"
          data-ui="share"
          onClick={() => openShare("https://www.instagram.com/", full)}
          className="flex min-h-11 items-center justify-center rounded-md bg-sky/40 text-xs font-bold ring-1 ring-line"
        >
          Instagram
        </button>
        <button
          type="button"
          data-ui="share"
          onClick={() => openShare("https://www.tiktok.com/", full)}
          className="flex min-h-11 items-center justify-center rounded-md bg-sky/40 text-xs font-bold ring-1 ring-line"
        >
          TikTok
        </button>
        <button
          type="button"
          data-ui="share"
          onClick={() => {
            window.location.href = `sms:?&body=${encoded}`;
          }}
          className="flex min-h-11 items-center justify-center gap-1 rounded-md bg-sky/40 text-xs font-bold ring-1 ring-line"
        >
          <MessageCircle className="size-3.5" strokeWidth={2.4} />
          Text
        </button>
      </div>
      <button
        type="button"
        data-ui="share"
        onClick={() => void copyShare(full)}
        className="mt-1.5 flex min-h-11 w-full items-center justify-center gap-1 rounded-md bg-sky/40 text-xs font-bold ring-1 ring-line"
      >
        <Copy className="size-3.5" strokeWidth={2.4} />
        {copied ? "Copied score" : "Copy score"}
      </button>
    </div>
  );
}
