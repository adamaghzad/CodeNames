"use client";

import { motion } from "framer-motion";
import { Bot, Crown, Eye, UserCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AgentAvatar, PlayerChip } from "@/components/game/AgentAvatar";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { PublicMember, PublicRoom } from "@/lib/multiplayer/types";
import type { Team } from "@/lib/game-engine/types";
import { cn } from "@/lib/utils";

function MemberRow({ m, team }: { m: PublicMember; team: Team }) {
  const { t } = useLanguage();
  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center justify-between gap-2 rounded-2xl border border-white/5 bg-black/30 px-2.5 py-1.5 text-sm"
    >
      <span className="flex min-w-0 items-center gap-2">
        <PlayerChip name={m.displayName} team={team} size="sm" />
        <span
          className={cn("h-2 w-2 shrink-0 rounded-full", m.online ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-slate-500")}
          title={m.online ? "Online" : "Offline"}
        />
        <span className="truncate font-medium text-slate-200">{m.displayName}</span>
        {m.isYou && <span className="text-[10px] font-bold uppercase text-violet-300">{t.you}</span>}
        {m.isHost && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-label={t.host} />}
      </span>
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
          m.ready ? "bg-emerald-500/15 text-emerald-300" : "bg-white/5 text-slate-500"
        )}
      >
        {m.ready ? t.ready : t.notReady}
      </span>
    </motion.li>
  );
}

interface Props {
  room: PublicRoom;
  team: Team;
  busy: boolean;
  onJoinTeam: (team: Team) => void;
  onSetRole: (role: "spymaster" | "operative") => void;
  onToggleAi: (team: Team, enabled: boolean) => void;
}

export function TeamPanel({ room, team, busy, onJoinTeam, onSetRole, onToggleAi }: Props) {
  const { t } = useLanguage();
  const isRed = team === "red";
  const members = room.members.filter((m) => m.team === team);
  const spymaster = members.find((m) => m.role === "spymaster");
  const operatives = members.filter((m) => m.role === "operative");
  const you = room.you;
  const youHere = you?.team === team;
  const aiOn = room.aiSpymaster[team];
  const isHost = Boolean(you?.isHost);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 240, damping: 24 }}
    >
      <Card
        className={cn(
          "relative space-y-3 overflow-hidden p-4",
          isRed
            ? "border-rose-400/25 bg-[linear-gradient(170deg,rgba(255,70,88,0.13),rgba(10,15,34,0.4)_55%)]"
            : "border-sky-400/25 bg-[linear-gradient(170deg,rgba(34,184,240,0.13),rgba(10,15,34,0.4)_55%)]",
          youHere && "ring-2 ring-white/30"
        )}
      >
        {/* watermark agent emblem */}
        <div className="pointer-events-none absolute -end-6 -top-5 h-36 w-36 opacity-[0.16]" aria-hidden>
          <AgentAvatar team={team} variant="spymaster" />
        </div>

        <div className="relative flex items-center justify-between">
          <h3
            className={cn(
              "font-display text-lg font-bold uppercase tracking-wide",
              isRed ? "text-rose-200" : "text-sky-200"
            )}
          >
            {isRed ? t.redTeam : t.blueTeam}
          </h3>
          <span className="flex items-center gap-1 rounded-full bg-black/30 px-2 py-0.5 text-xs font-semibold text-slate-300">
            <Users className="h-3.5 w-3.5" aria-hidden /> {members.length}
          </span>
        </div>

        {/* Spymaster seat */}
        <div className="relative rounded-2xl border border-white/10 bg-black/35 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">
            <Eye className="h-3.5 w-3.5" aria-hidden /> {t.spymaster}
          </p>
          {aiOn ? (
            <p className="flex items-center gap-2 text-sm font-semibold text-violet-200">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-violet-500/35">
                <Bot className="h-4 w-4" aria-hidden />
              </span>
              Groq AI <span className="font-mono text-[10px] text-slate-500">openai/gpt-oss-20b</span>
              <span className="ms-auto flex gap-1" aria-hidden>
                <span className="think-dot h-1.5 w-1.5 rounded-full bg-violet-300" />
                <span className="think-dot h-1.5 w-1.5 rounded-full bg-violet-300" style={{ animationDelay: "0.15s" }} />
                <span className="think-dot h-1.5 w-1.5 rounded-full bg-violet-300" style={{ animationDelay: "0.3s" }} />
              </span>
            </p>
          ) : spymaster ? (
            <ul>
              <MemberRow m={spymaster} team={team} />
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-white/15 px-3 py-2 text-center text-sm italic text-slate-500">
              Seat open
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {!aiOn && youHere && you?.role !== "spymaster" && !spymaster && (
              <Button size="sm" variant={isRed ? "red" : "blue"} className="rounded-full" disabled={busy} onClick={() => onSetRole("spymaster")}>
                {t.claimSpymaster}
              </Button>
            )}
            {youHere && you?.role === "spymaster" && (
              <Button size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={() => onSetRole("operative")}>
                {t.releaseSpymaster}
              </Button>
            )}
            {isHost && (
              <Button size="sm" variant="ghost" className="rounded-full" disabled={busy} onClick={() => onToggleAi(team, !aiOn)}>
                <Bot className="h-3.5 w-3.5" aria-hidden /> {aiOn ? "AI: ON" : "AI: OFF"}
              </Button>
            )}
          </div>
        </div>

        {/* Operatives */}
        <div className="relative">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">
            <UserCheck className="h-3.5 w-3.5" aria-hidden /> {t.operative}s ({operatives.length})
          </p>
          {operatives.length ? (
            <ul className="space-y-1.5">
              {operatives.map((m) => (
                <MemberRow key={m.id} m={m} team={team} />
              ))}
            </ul>
          ) : (
            <p className="text-sm italic text-slate-500">—</p>
          )}
        </div>

        {!youHere && (
          <Button variant={isRed ? "red" : "blue"} className="relative w-full rounded-full" disabled={busy} onClick={() => onJoinTeam(team)}>
            {t.joinTeam}
          </Button>
        )}
      </Card>
    </motion.div>
  );
}
