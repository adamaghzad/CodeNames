"use client";

import { motion } from "framer-motion";
import { Bomb, Eye, Fingerprint, Hand, Shield, Skull, Sparkle, User, Waves } from "lucide-react";
import { AgentAvatar, PlayerChip } from "./AgentAvatar";
import type { Assignment, PublicCard } from "@/lib/game-engine/types";
import type { CardTouchView } from "@/lib/multiplayer/types";
import { cn } from "@/lib/utils";

/** Full-colour faces (revealed cards — and what a spymaster sees pre-reveal). */
const TEAM_FACES: Record<Assignment, string> = {
  red: "bg-[linear-gradient(150deg,#ff7a72_0%,#f43f4e_52%,#b91c30_100%)] text-white border-rose-200/50 shadow-[0_14px_28px_-12px_rgba(244,63,94,0.55)]",
  blue: "bg-[linear-gradient(150deg,#54d8ff_0%,#149fe0_52%,#0369a1_100%)] text-white border-sky-200/50 shadow-[0_14px_28px_-12px_rgba(14,159,224,0.55)]",
  neutral:
    "bg-[linear-gradient(150deg,#f3e5c8_0%,#d9bd8f_55%,#b08d5a_100%)] text-stone-900 border-amber-100/60 shadow-[0_14px_28px_-14px_rgba(176,141,90,0.6)]",
  assassin:
    "bg-[linear-gradient(150deg,#2b2135_0%,#0a0714_60%,#000_100%)] text-rose-300 border-fuchsia-300/40 shadow-[0_14px_30px_-10px_rgba(168,85,247,0.45)]",
};

const FACE_ICON: Record<Assignment, typeof Shield> = {
  red: Shield,
  blue: Waves,
  neutral: User,
  assassin: Bomb,
};

interface Props {
  card: PublicCard;
  spymasterView: boolean;
  canGuess: boolean;
  busy: boolean;
  selected?: boolean;
  selectedIndex?: number;
  touches?: CardTouchView[];
  index?: number;
  onGuess: (cardId: string) => void;
}

export function WordCard({ card, spymasterView, canGuess, busy, selected, selectedIndex, touches, index = 0, onGuess }: Props) {
  const wordLen = card.word.length;
  const wordSize =
    wordLen > 15
      ? "text-[8px] sm:text-[10px] lg:text-[11px]"
      : wordLen > 11
        ? "text-[9px] sm:text-xs lg:text-[13px]"
        : "text-[11px] sm:text-sm lg:text-[15px]";
  const spyAssignment = spymasterView && !card.revealed ? card.assignment : undefined;
  const RevealIcon = card.assignment ? FACE_ICON[card.assignment] : Sparkle;
  const SpyIcon = spyAssignment ? FACE_ICON[spyAssignment] : Fingerprint;
  const otherTouches = (touches ?? []).filter((touch) => !touch.isYou);

  return (
    <div className="card-scene aspect-[4/3] w-full">
      <motion.button
        type="button"
        initial={{ opacity: 0, y: 16, rotateX: -10 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ delay: Math.min(index * 0.028, 0.7), type: "spring", stiffness: 320, damping: 26 }}
        whileHover={canGuess && !card.revealed ? { scale: 1.045, y: -4, rotate: -0.6 } : undefined}
        whileTap={canGuess && !card.revealed ? { scale: 0.97 } : undefined}
        disabled={!canGuess || card.revealed || busy}
        onClick={() => onGuess(card.id)}
        aria-label={`${card.word}${card.revealed && card.assignment ? ` (${card.assignment})` : ""}`}
        aria-pressed={selected || undefined}
        className={cn(
          "group relative h-full w-full rounded-[1.1rem] text-center [perspective:900px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300",
          canGuess && !card.revealed ? "cursor-pointer" : "cursor-default",
          selected && "z-10"
        )}
      >
        {/* Plain CSS 3D flip wrapper — Framer Motion owns the button's transform,
            so the flip must live on this inner element to not be overridden. */}
        <span className={cn("card-inner absolute inset-0 block", card.revealed && "card-flipped")}>
        {/* FRONT — unrevealed intel tile (operatives) / tinted key tile (spymasters) */}
        <span
          className={cn(
            "card-face tile-sheen absolute inset-0 overflow-hidden rounded-[1.1rem] border shadow-[0_16px_30px_-14px_rgba(0,0,0,0.8)] transition-shadow",
            spyAssignment
              ? TEAM_FACES[spyAssignment]
              : "border-[#fff6df]/70 bg-[linear-gradient(155deg,#fffaf0_0%,#f3e6c8_48%,#e2cda1_100%)] text-slate-900",
            canGuess && !spyAssignment && "group-hover:shadow-[0_20px_36px_-14px_rgba(255,214,140,0.45)]",
            selected && "ring-4 ring-violet-300 ring-offset-2 ring-offset-[#0a0f22]"
          )}
        >
          {/* top strip: category chip + spymaster signal */}
          <span className="absolute inset-x-2 top-2 flex items-start justify-between gap-1">
            <span
              className={cn(
                "max-w-[72%] truncate rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.14em] sm:text-[9px]",
                spyAssignment ? "bg-black/25 text-white/90" : "bg-[#2a2118]/10 text-[#6b5738]"
              )}
            >
              {card.category}
            </span>
            {spyAssignment ? (
              spyAssignment === "assassin" ? (
                <Skull className="h-3.5 w-3.5 shrink-0 text-white drop-shadow" aria-label="Assassin" />
              ) : (
                <Eye className="h-3.5 w-3.5 shrink-0 text-white/85" aria-hidden />
              )
            ) : (
              <span className="font-mono text-[8px] font-semibold tracking-widest text-[#6b5738]/70 sm:text-[9px]">
                {String(card.position + 1).padStart(2, "0")}
              </span>
            )}
          </span>

          {/* centre glyph */}
          <span className="absolute inset-0 grid place-items-center pb-5">
            <SpyIcon
              aria-hidden
              className={cn("h-7 w-7 sm:h-9 sm:w-9", spyAssignment ? "text-white/35" : "text-[#8a6f42]/30")}
              strokeWidth={1.4}
            />
          </span>

          {/* word band */}
          <span
            className={cn(
              "absolute inset-x-2 bottom-2 grid place-items-center rounded-lg px-1 py-1.5 sm:py-2",
              spyAssignment ? "bg-black/35" : "bg-[#241a10] shadow-inner"
            )}
          >
            <span className={cn("w-full break-words font-display font-bold uppercase leading-none tracking-wide text-amber-50", wordSize)}>
              {card.word}
            </span>
          </span>
        </span>

        {/* BACK — revealed */}
        <span
          className={cn(
            "card-face card-back tile-sheen absolute inset-0 overflow-hidden rounded-[1.1rem] border",
            card.assignment ? TEAM_FACES[card.assignment] : ""
          )}
        >
          <span className="absolute inset-0 grid place-items-center pb-6">
            {card.assignment === "red" || card.assignment === "blue" ? (
              <span className="block h-12 w-12 drop-shadow-[0_10px_18px_rgba(0,0,0,0.35)] sm:h-16 sm:w-16 lg:h-[4.5rem] lg:w-[4.5rem]">
                <AgentAvatar team={card.assignment} variant="operative" />
              </span>
            ) : (
              <RevealIcon aria-hidden className="h-9 w-9 text-white/40 sm:h-11 sm:w-11" strokeWidth={1.3} />
            )}
          </span>
          {card.assignment === "assassin" && (
            <span className="animate-pulse-ring absolute end-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-rose-500/30">
              <Bomb className="h-3.5 w-3.5 text-rose-200" aria-hidden />
            </span>
          )}
          <span className="absolute inset-x-2 bottom-2 grid place-items-center gap-0.5 rounded-lg bg-black/35 px-1 py-1.5">
            <span className={cn("w-full break-words font-display font-bold uppercase leading-none tracking-wide text-white", wordSize)}>
              {card.word}
            </span>
            <span className="text-[8px] font-bold uppercase tracking-[0.22em] opacity-85">{card.assignment}</span>
          </span>
        </span>
        </span>
        {selected && !card.revealed && typeof selectedIndex === "number" && selectedIndex >= 0 && (
          <span className="absolute -end-2 -top-2 z-20 grid h-7 w-7 place-items-center rounded-full bg-violet-500 font-display text-xs font-bold text-white shadow-[0_10px_20px_-8px_rgba(139,92,246,0.9)] ring-2 ring-white/80">
            {selectedIndex + 1}
          </span>
        )}
        {otherTouches.length > 0 && !card.revealed && (
          <span className="absolute -start-2 -top-2 z-20 flex items-center" aria-hidden>
            <span className="flex -space-x-1.5">
              {otherTouches.slice(0, 3).map((touch) => (
                <span key={touch.playerId} className="relative" title={`${touch.displayName} · #${touch.order + 1}`}>
                  <PlayerChip name={touch.displayName} team={touch.team} size="sm" />
                  <span className="absolute -bottom-1 -end-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-emerald-400 font-display text-[8px] font-bold leading-none text-emerald-950 ring-1 ring-white/85">
                    {touch.order + 1}
                  </span>
                </span>
              ))}
            </span>
            {otherTouches.length > 3 && (
              <span className="ms-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#0a0f22]/90 px-1 text-[8px] font-bold text-white ring-1 ring-white/60">
                +{otherTouches.length - 3}
              </span>
            )}
            <span className="ms-1.5 grid h-6 w-6 place-items-center rounded-full bg-emerald-400 text-emerald-950 shadow-[0_8px_16px_-6px_rgba(52,211,153,0.9)] ring-2 ring-white/85">
              <Hand className="h-3.5 w-3.5" strokeWidth={2.2} />
            </span>
          </span>
        )}
      </motion.button>
    </div>
  );
}
