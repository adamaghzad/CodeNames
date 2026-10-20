"use client";

import { motion } from "framer-motion";
import { Bot, Crown, Radio } from "lucide-react";
import { AgentAvatar, PlayerChip } from "./AgentAvatar";
import type { PublicMember } from "@/lib/multiplayer/types";
import type { Team } from "@/lib/game-engine/types";
import { cn } from "@/lib/utils";

interface Props {
  team: Team;
  label: string;
  operativesLabel: string;
  spymastersLabel: string;
  youLabel: string;
  score: { found: number; total: number };
  active: boolean;
  members?: PublicMember[]; // present in multiplayer rooms
  aiSpymaster?: boolean;
}

/**
 * Side "command rail" for one team: operative dossier on top, a giant
 * remaining-agents medallion in the middle, spymaster dossier below —
 * the classic table layout, re-drawn in CodenamesIA's own glass/neon style.
 */
export function TeamRail({ team, label, operativesLabel, spymastersLabel, youLabel, score, active, members, aiSpymaster }: Props) {
  const red = team === "red";
  const remaining = Math.max(0, score.total - score.found);
  const operatives = members?.filter((m) => m.role === "operative") ?? [];
  const spymaster = members?.find((m) => m.role === "spymaster");
  const pct = score.total ? Math.round((score.found / score.total) * 100) : 0;

  const panel = red
    ? "border-rose-400/25 bg-[linear-gradient(165deg,rgba(255,70,88,0.16),rgba(20,8,16,0.55)_60%)]"
    : "border-sky-400/25 bg-[linear-gradient(165deg,rgba(34,184,240,0.16),rgba(6,14,28,0.55)_60%)]";
  const accentText = red ? "text-rose-200" : "text-sky-200";

  const memberLine = (m: PublicMember) => (
    <li key={m.id} className="flex items-center gap-2 rounded-xl bg-black/25 px-2 py-1.5">
      <PlayerChip name={m.displayName} team={team} size="sm" />
      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-100">{m.displayName}</span>
      {m.isYou && <span className="text-[9px] font-black uppercase tracking-wider text-violet-300">{youLabel}</span>}
      {m.isHost && <Crown className="h-3 w-3 shrink-0 text-amber-300" aria-hidden />}
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", m.online ? "bg-emerald-400" : "bg-slate-500")} aria-hidden />
    </li>
  );

  return (
    <aside aria-label={label} className="sticky top-24 hidden w-52 shrink-0 flex-col gap-3 self-start xl:flex 2xl:w-60">
      {/* Operatives dossier */}
      <motion.section
        initial={{ opacity: 0, x: red ? 18 : -18 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 24 }}
        className={cn("relative overflow-hidden rounded-3xl border p-3 backdrop-blur", panel, active && "ring-2 ring-white/35")}
      >
        <div className="pointer-events-none absolute -end-4 -top-3 h-24 w-24 opacity-35">
          <AgentAvatar team={team} variant="operative" />
        </div>
        <h3 className={cn("font-display text-[11px] font-bold uppercase tracking-[0.24em]", accentText)}>
          {operativesLabel}
        </h3>
        <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-slate-400">{label}</p>
        {members ? (
          operatives.length ? (
            <ul className="slim-scroll relative max-h-36 space-y-1.5 overflow-y-auto pe-0.5">{operatives.map(memberLine)}</ul>
          ) : (
            <p className="relative rounded-xl bg-black/25 px-2 py-2 text-xs italic text-slate-400">—</p>
          )
        ) : (
          <div className="relative flex gap-1" aria-hidden>
            {Array.from({ length: score.total }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-2 flex-1 rounded-full",
                  i < score.found ? (red ? "bg-rose-400" : "bg-sky-400") : "bg-white/15"
                )}
              />
            ))}
          </div>
        )}
      </motion.section>

      {/* Remaining-agents medallion */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.08, type: "spring", stiffness: 260, damping: 20 }}
        className={cn(
          "relative mx-auto grid h-32 w-32 place-items-center rounded-full border text-center",
          red
            ? "border-rose-300/40 bg-[radial-gradient(circle_at_35%_30%,#ff8a80,#e11d48_58%,#7f1d2d)] shadow-[0_20px_44px_-14px_rgba(225,29,72,0.65)]"
            : "border-sky-300/40 bg-[radial-gradient(circle_at_35%_30%,#7dd7ff,#0284c7_58%,#0c3a63)] shadow-[0_20px_44px_-14px_rgba(2,132,199,0.65)]",
          active && "animate-pulse-ring"
        )}
      >
        <div>
          <motion.p
            key={remaining}
            initial={{ scale: 1.35, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="font-display text-6xl font-bold leading-none text-white drop-shadow-[0_3px_10px_rgba(0,0,0,0.45)]"
          >
            {remaining}
          </motion.p>
          <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.2em] text-white/85">
            {score.found}/{score.total} · {pct}%
          </p>
        </div>
        {active && (
          <span className="absolute -top-1 end-2 grid h-6 w-6 place-items-center rounded-full bg-white text-slate-900 shadow">
            <Radio className="animate-signal h-3.5 w-3.5" aria-hidden />
          </span>
        )}
      </motion.div>

      {/* Spymasters dossier */}
      <motion.section
        initial={{ opacity: 0, x: red ? 18 : -18 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.05, type: "spring", stiffness: 220, damping: 24 }}
        className={cn("relative overflow-hidden rounded-3xl border p-3 backdrop-blur", panel)}
      >
        <div className="pointer-events-none absolute -end-4 -top-3 h-24 w-24 opacity-35">
          <AgentAvatar team={team} variant="spymaster" />
        </div>
        <h3 className={cn("mb-2 font-display text-[11px] font-bold uppercase tracking-[0.24em]", accentText)}>
          {spymastersLabel}
        </h3>
        {aiSpymaster ? (
          <p className="relative flex items-center gap-2 rounded-xl bg-black/25 px-2 py-2 text-xs font-semibold text-violet-100">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-violet-500/40">
              <Bot className="h-3.5 w-3.5" aria-hidden />
            </span>
            Groq AI
            <span className="ms-auto flex gap-1" aria-hidden>
              <span className="think-dot h-1.5 w-1.5 rounded-full bg-violet-300" />
              <span className="think-dot h-1.5 w-1.5 rounded-full bg-violet-300" style={{ animationDelay: "0.15s" }} />
              <span className="think-dot h-1.5 w-1.5 rounded-full bg-violet-300" style={{ animationDelay: "0.3s" }} />
            </span>
          </p>
        ) : members ? (
          spymaster ? (
            <ul className="relative">{memberLine(spymaster)}</ul>
          ) : (
            <p className="relative rounded-xl bg-black/25 px-2 py-2 text-xs italic text-slate-400">—</p>
          )
        ) : (
          <p className="relative rounded-xl bg-black/25 px-2 py-2 text-xs text-slate-300">{label}</p>
        )}
      </motion.section>
    </aside>
  );
}
