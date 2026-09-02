import { Flame, Gauge, Heart, Rocket, Shield, Users } from "lucide-react";
import { useGameStore } from "@/game/store";

export const PLAY_URL = "https://honey-ace.grok.me";
export const REPO_URL = "https://github.com/wilsonsamiano/honey-ace";

export function HeaderBar() {
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

export function ScoreChip() {
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

export function StageChip() {
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

export function BossBar() {
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

export function RankBar() {
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
