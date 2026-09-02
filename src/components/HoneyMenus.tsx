import { useState } from "react";
import { Coffee, Copy, Flame, Gauge, Github, MessageCircle, Rocket, Share2, Shield, Users } from "lucide-react";
import { UiButton } from "./usePress";
import {
  atCap,
  DIFFICULTIES,
  nextBlurb,
  UPGRADES,
  useGameStore,
  type Difficulty,
  type Stats,
  type UpgradeId,
} from "@/game/store";
import { PLAY_URL, REPO_URL } from "./HoneyHud";

export function Overlay({
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

export function MenuCard({
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
    <div className="w-full max-w-[390px] rounded-lg bg-paper p-4 text-center shadow-panel ring-1 ring-line md:max-w-[420px]">
      <img
        src="/mascot.png"
        alt="Bumble, the Honey Ace"
        className="bee-bob mx-auto size-16 rounded-full bg-sky-deep object-cover ring-2 ring-honey/50"
      />
      <h2 className="font-display mt-2 text-3xl leading-none font-semibold">Honey Ace</h2>
      <p className="mt-1.5 text-sm text-muted">Pick a rank, then fly.</p>
      <div className="mt-3 grid grid-cols-1 gap-2" role="group" aria-label="Difficulty">
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
              className={`flex min-h-12 w-full items-center justify-between rounded-md px-4 text-left ring-1 ${
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
        className="mt-2 flex h-12 w-full items-center justify-center rounded-md bg-cherry text-base font-bold text-paper ring-1 ring-cherry"
      >
        Start sortie
      </button>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <MenuShare />
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          data-ui="github"
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-sky/40 text-sm font-bold ring-1 ring-line transition-transform duration-150 hover:bg-sky/70 active:scale-[0.98]"
        >
          <Github className="size-4 text-cherry" strokeWidth={2.4} />
          GitHub
        </a>
      </div>
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

function playUrl() {
  return PLAY_URL;
}

function shareBits(score: number, best: number, level: number, rank: string) {
  const text = `I scored ${score.toLocaleString()} on Honey Ace (${rank}) — Stage ${level}. High score ${best.toLocaleString()}. Think you can beat Bumble?`;
  const url = playUrl();
  return { text, url, full: `${text} ${url}` };
}

function inviteBits() {
  const text = "Play Honey Ace — a cartoon TwinBee-style shmup. Fly Bumble and beat my score.";
  const url = playUrl();
  return { text, url, full: `${text} ${url}` };
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function MenuShare() {
  const [copied, setCopied] = useState(false);

  async function shareGame() {
    const { text, url, full } = inviteBits();
    try {
      if (navigator.share) {
        await navigator.share({ title: "Honey Ace", text, url });
        return;
      }
    } catch (err) {
      if ((err as DOMException).name === "AbortError") return;
    }
    const ok = await copyText(full);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  }

  return (
    <button
      type="button"
      data-ui="share"
      onClick={() => void shareGame()}
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-sky/40 text-sm font-bold ring-1 ring-line transition-transform duration-150 hover:bg-sky/70 active:scale-[0.98]"
    >
      <Share2 className="size-4 text-cherry" strokeWidth={2.4} />
      {copied ? "Copied" : "Share"}
    </button>
  );
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
    const ok = await copyText(value);
    if (!ok) return;
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
      <a
        href={REPO_URL}
        target="_blank"
        rel="noreferrer"
        data-ui="github"
        className="mt-1.5 flex min-h-11 w-full items-center justify-center gap-1 rounded-md bg-sky/40 text-xs font-bold ring-1 ring-line"
      >
        <Github className="size-3.5" strokeWidth={2.4} />
        GitHub
      </a>
    </div>
  );
}
