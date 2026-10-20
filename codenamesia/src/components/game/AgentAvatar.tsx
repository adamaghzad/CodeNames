"use client";

import { useId } from "react";
import type { Team } from "@/lib/game-engine/types";
import { cn } from "@/lib/utils";

/**
 * Original vector "field agent" emblem for CodenamesIA — abstract visor,
 * signal arcs and circuit traces. Drawn in-code (no external artwork) so the
 * identity stays 100% ours while still feeling like a spy dossier portrait.
 */
export function AgentAvatar({
  team,
  variant = "operative",
  className,
}: {
  team: Team;
  variant?: "operative" | "spymaster";
  className?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const red = team === "red";
  const c1 = red ? "#ff5d6c" : "#38c6ff";
  const c2 = red ? "#a11220" : "#075e9e";
  const glow = red ? "#ffb3ba" : "#a5e8ff";

  return (
    <svg viewBox="0 0 120 120" role="img" aria-hidden className={cn("h-full w-full", className)}>
      <defs>
        <linearGradient id={`ag-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c1} />
          <stop offset="100%" stopColor={c2} />
        </linearGradient>
        <radialGradient id={`ah-${uid}`} cx="0.5" cy="0.35" r="0.75">
          <stop offset="0%" stopColor={glow} stopOpacity="0.55" />
          <stop offset="100%" stopColor={glow} stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="60" cy="60" r="52" fill={`url(#ah-${uid})`} />
      <circle cx="60" cy="60" r="47" fill="none" stroke={c1} strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="5 7" />
      <circle cx="60" cy="60" r="39" fill={`url(#ag-${uid})`} fillOpacity="0.16" stroke={c1} strokeOpacity="0.5" />

      {/* shoulders / suit */}
      <path d="M28 104c4-18 17-27 32-27s28 9 32 27Z" fill={`url(#ag-${uid})`} fillOpacity="0.9" />
      <path d="M52 80l8 12 8-12-8-4Z" fill="#04060e" fillOpacity="0.55" />
      {/* head */}
      <circle cx="60" cy="52" r="19" fill="#0b1020" stroke={glow} strokeOpacity="0.8" strokeWidth="1.6" />
      {/* visor */}
      {variant === "spymaster" ? (
        <>
          <path d="M42 50h36l-3.5 9H45.5Z" fill={glow} />
          <circle cx="60" cy="37" r="3.2" fill={glow} />
          <path d="M60 40v6" stroke={glow} strokeWidth="2" strokeLinecap="round" />
        </>
      ) : (
        <>
          <rect x="43" y="48" width="14" height="7" rx="3.5" fill={glow} />
          <rect x="63" y="48" width="14" height="7" rx="3.5" fill={glow} />
          <path d="M57 51h6" stroke={glow} strokeWidth="2" strokeLinecap="round" />
        </>
      )}
      <path d="M52 66c5 3 11 3 16 0" stroke={glow} strokeOpacity="0.75" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* earpiece + signal */}
      <circle cx="79" cy="56" r="2.6" fill={glow} />
      <path d="M85 50a9 9 0 0 1 0 12M90 45a16 16 0 0 1 0 22" stroke={c1} strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* circuit traces */}
      <path d="M22 34h10l5 5M98 84H88l-5-5" stroke={c1} strokeOpacity="0.65" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <circle cx="22" cy="34" r="2.2" fill={c1} />
      <circle cx="98" cy="84" r="2.2" fill={c1} />
    </svg>
  );
}

/** Small circular monogram chip for a player (initials, team gradient). */
export function PlayerChip({ name, team, size = "md" }: { name: string; team: Team | null; size?: "sm" | "md" }) {
  const initials = name
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-black text-white ring-2 ring-white/25",
        size === "sm" ? "h-6 w-6 text-[9px]" : "h-8 w-8 text-[11px]",
        team === "red"
          ? "bg-gradient-to-br from-rose-400 to-red-700"
          : team === "blue"
            ? "bg-gradient-to-br from-sky-400 to-blue-700"
            : "bg-gradient-to-br from-slate-500 to-slate-700"
      )}
    >
      {initials || "?"}
    </span>
  );
}
