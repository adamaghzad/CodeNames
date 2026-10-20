"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Bot, BrainCircuit, Eye, Fingerprint, Keyboard, Sparkles, Users, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { cn } from "@/lib/utils";

const DEMO_WORDS = ["NEURON", "Atlas", "STRIKER", "SAHARA", "MODEL", "TAGINE", "PENALTY", "TOKEN", "MEDINA", "CLUSTER", "GOALKEEPER", "ROBOT", "COUSCOUS", "LEARNING", "STADIUM", "PROMPT", "SOUK", "DRIBBLE", "VISION", "Rabat", "PIPELINE", "TROPHY", "AGENT", "Fès", "LEAGUE"];

type TileTone = "red" | "blue" | "plain";
function tone(i: number): TileTone {
  if (i % 7 === 3) return "red";
  if (i % 5 === 2) return "blue";
  return "plain";
}

const TILE_STYLES: Record<TileTone, string> = {
  red: "border-rose-200/50 bg-[linear-gradient(150deg,#ff7a72,#f43f4e_55%,#b91c30)] text-white shadow-[0_10px_22px_-10px_rgba(244,63,94,0.7)]",
  blue: "border-sky-200/50 bg-[linear-gradient(150deg,#54d8ff,#149fe0_55%,#0369a1)] text-white shadow-[0_10px_22px_-10px_rgba(14,159,224,0.7)]",
  plain:
    "border-[#fff6df]/70 bg-[linear-gradient(155deg,#fffaf0,#f3e6c8_50%,#e2cda1)] text-slate-900 shadow-[0_10px_20px_-10px_rgba(0,0,0,0.8)]",
};

export default function HomePage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [code, setCode] = useState("");

  return (
    <div className="space-y-16 pt-8 sm:pt-12">
      {/* Hero */}
      <section className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-slate-300"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" aria-hidden />
            AI word-association mission
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, type: "spring", stiffness: 220, damping: 24 }}
            className="font-display text-5xl font-bold leading-[1.02] tracking-tight text-white sm:text-6xl lg:text-7xl"
          >
            Codenames<span className="gradient-text">IA</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="mt-5 max-w-xl text-lg text-slate-300"
          >
            {t.tagline}
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="mt-3 max-w-xl text-sm leading-relaxed text-slate-500"
          >
            Type <em className="text-slate-300">any</em> categories — “Morocco + Football”, “Anime + Medicine”,
            anything — and Groq AI (<span className="font-mono text-slate-400">openai/gpt-oss-20b</span>) builds a
            fresh 25-word board. Play on one device, against AI, or in real-time rooms with friends anywhere.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24 }}
            className="mt-8 flex flex-wrap gap-3"
          >
            <Link href="/multiplayer">
              <Button size="lg" className="rounded-full px-7">
                <Users className="h-5 w-5" aria-hidden /> {t.multiplayer}
              </Button>
            </Link>
            <Link href="/create-game">
              <Button size="lg" variant="outline" className="rounded-full px-7">
                <Sparkles className="h-5 w-5" aria-hidden /> {t.createGame}
              </Button>
            </Link>
          </motion.div>

          <motion.form
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-panel mt-7 flex max-w-md items-center gap-2 rounded-full py-1.5 pe-1.5 ps-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim().length >= 4) router.push(`/room/${code.trim().toUpperCase()}`);
            }}
          >
            <Fingerprint className="h-5 w-5 shrink-0 text-slate-500" aria-hidden />
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={t.enterRoomCode}
              aria-label={t.roomCode}
              className="h-10 border-0 bg-transparent font-mono uppercase tracking-[0.3em] shadow-none focus-visible:ring-0"
              maxLength={8}
            />
            <Button type="submit" variant="blue" className="h-10 shrink-0 rounded-full px-5">
              {t.join}
            </Button>
          </motion.form>
        </div>

        {/* Floating demo board — original porcelain tiles */}
        <div className="relative mx-auto w-full max-w-md" aria-hidden>
          <div
            className="absolute -inset-6 rounded-[2.5rem] bg-[radial-gradient(circle_at_30%_20%,rgba(139,92,246,0.35),transparent_55%),radial-gradient(circle_at_80%_85%,rgba(34,184,240,0.3),transparent_55%)] blur-2xl"
          />
          <div className="animate-floaty board-frame relative rounded-[1.8rem] p-3 sm:p-4">
            <div className="relative z-10 grid grid-cols-5 gap-2">
              {DEMO_WORDS.map((w, i) => (
                <motion.div
                  key={w}
                  initial={{ opacity: 0, scale: 0.75, rotate: -4 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  transition={{ delay: 0.15 + i * 0.035, type: "spring", stiffness: 300, damping: 22 }}
                  whileHover={{ scale: 1.08, rotate: -1, zIndex: 5 }}
                  className={cn(
                    "grid aspect-[4/3] place-items-center overflow-hidden rounded-xl border px-0.5 text-center font-display text-[9px] font-bold uppercase leading-tight sm:text-[10px]",
                    tone(i) !== "plain" && "tile-sheen",
                    TILE_STYLES[tone(i)]
                  )}
                >
                  {w}
                </motion.div>
              ))}
            </div>
          </div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1 }}
            className="relative mt-4 text-center text-xs font-semibold uppercase tracking-[0.22em] text-slate-500"
          >
            Morocco × Football × Artificial Intelligence
          </motion.p>
        </div>
      </section>

      {/* How it works */}
      <section>
        <h2 className="mb-2 text-center font-display text-2xl font-bold uppercase tracking-wide text-white sm:text-3xl">
          {t.howToPlay}
        </h2>
        <p className="mb-8 text-center text-sm text-slate-500">Three steps from idea to mission.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: Keyboard, title: "1 · Invent categories", body: "Enter any topics, mix unrelated worlds, pick difficulty and language (EN / FR / AR)." },
            { icon: BrainCircuit, title: "2 · AI builds the board", body: "Groq generates exactly 25 validated words. The server — never the AI — secretly assigns 9 / 8 / 7 / assassin." },
            { icon: Eye, title: "3 · Clue & guess", body: "Spymasters see the key card and give one-word clues. Operatives guess — watch out for the assassin!" },
          ].map(({ icon: Icon, title, body }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: i * 0.08, type: "spring", stiffness: 240, damping: 24 }}
              whileHover={{ y: -5 }}
            >
              <Card className="h-full p-6">
                <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/30 to-sky-500/20 ring-1 ring-white/10">
                  <Icon className="h-6 w-6 text-violet-200" aria-hidden />
                </span>
                <h3 className="font-display font-bold text-white">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{body}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Modes */}
      <section className="grid gap-4 pb-4 sm:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          whileHover={{ y: -5 }}
        >
          <Card className="relative h-full overflow-hidden border-violet-400/30 p-7">
            <span
              className="pointer-events-none absolute -end-10 -top-10 h-40 w-40 rounded-full bg-violet-500/25 blur-3xl"
              aria-hidden
            />
            <span className="relative mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/25 ring-1 ring-violet-300/30">
              <Wifi className="h-6 w-6 text-violet-200" aria-hidden />
            </span>
            <h3 className="relative font-display text-xl font-bold text-white">{t.multiplayer}</h3>
            <p className="relative mt-2 text-sm leading-relaxed text-slate-400">
              Private rooms, invite links, team & spymaster selection, ready checks, presence and fully
              synchronized real-time play across phones and laptops.
            </p>
            <Link href="/multiplayer" className="relative mt-5 inline-block">
              <Button className="rounded-full px-6">{t.createRoom}</Button>
            </Link>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ delay: 0.08 }}
          whileHover={{ y: -5 }}
        >
          <Card className="relative h-full overflow-hidden border-sky-400/30 p-7">
            <span
              className="pointer-events-none absolute -end-10 -top-10 h-40 w-40 rounded-full bg-sky-500/25 blur-3xl"
              aria-hidden
            />
            <span className="relative mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-sky-500/25 ring-1 ring-sky-300/30">
              <Bot className="h-6 w-6 text-sky-200" aria-hidden />
            </span>
            <h3 className="relative font-display text-xl font-bold text-white">{t.quickGame} & AI modes</h3>
            <p className="relative mt-2 text-sm leading-relaxed text-slate-400">
              Pass-and-play, Human vs AI, AI-spymaster and solo training — same engine, instant start, no account.
            </p>
            <Link href="/create-game" className="relative mt-5 inline-block">
              <Button variant="outline" className="rounded-full px-6">{t.playNow}</Button>
            </Link>
          </Card>
        </motion.div>
      </section>
    </div>
  );
}
