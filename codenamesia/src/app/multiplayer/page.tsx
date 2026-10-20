"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Loader2, LogIn, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CategoryInput, type CategoryValue } from "@/components/create/CategoryInput";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { createRoom, ensureIdentity, joinRoom, rememberRoom, savedDisplayName } from "@/lib/multiplayer/client";
import type { Difficulty, Language } from "@/lib/game-engine/types";

export default function MultiplayerPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [name, setName] = useState(savedDisplayName());
  const [categories, setCategories] = useState<CategoryValue[]>([{ name: "Artificial Intelligence" }, { name: "Morocco" }]);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [language, setLanguage] = useState<Language>("en");
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [aiRed, setAiRed] = useState(false);
  const [aiBlue, setAiBlue] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cleanCats = categories.filter((c) => c.name.trim().length >= 2);

  const onCreate = async () => {
    setBusy("create");
    setError(null);
    try {
      await ensureIdentity(name.trim() || undefined);
      const { room } = await createRoom({
        categories: cleanCats,
        difficulty,
        language,
        mode: "human-vs-human",
        maxPlayers,
        aiSpymasterRed: aiRed,
        aiSpymasterBlue: aiBlue,
        displayName: name.trim() || undefined,
      });
      rememberRoom(room);
      router.push(`/room/${room.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the room.");
      setBusy(null);
    }
  };

  const onJoin = async () => {
    setBusy("join");
    setError(null);
    try {
      await ensureIdentity(name.trim() || undefined);
      const { room } = await joinRoom(code.trim().toUpperCase(), name.trim() || undefined);
      rememberRoom(room);
      router.push(`/room/${room.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join that room.");
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 pt-10">
      <div className="text-center">
        <h1 className="text-3xl font-black text-white">{t.multiplayer}</h1>
        <p className="mt-2 text-sm text-slate-400">
          Create a private room, share the invite link, pick teams — then the AI builds your board live for everyone.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-2.5 text-center text-sm text-rose-200">
          {error}
        </p>
      )}

      <Card className="p-5">
        <label className="text-xs font-bold uppercase tracking-widest text-slate-400" htmlFor="mp-name">
          {t.yourName}
        </label>
        <Input id="mp-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Yassine" maxLength={24} className="mt-2" />
        <p className="mt-1.5 text-[11px] text-slate-500">{t.guestMode} — no account needed. Your guest identity is signed server-side.</p>
      </Card>

      {/* Create room */}
      <Card className="space-y-5 p-6">
        <h2 className="flex items-center gap-2 text-lg font-black text-white">
          <PlusCircle className="h-5 w-5 text-violet-300" /> {t.createRoom}
        </h2>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">{t.categories}</p>
          <CategoryInput value={categories} onChange={setCategories} showWeights={false} />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="space-y-1.5 text-xs font-semibold text-slate-300">
            {t.difficulty}
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)} className="h-11 w-full cursor-pointer rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400">
              <option value="easy">{t.easy}</option>
              <option value="medium">{t.medium}</option>
              <option value="hard">{t.hard}</option>
            </select>
          </label>
          <label className="space-y-1.5 text-xs font-semibold text-slate-300">
            {t.language}
            <select value={language} onChange={(e) => setLanguage(e.target.value as Language)} className="h-11 w-full cursor-pointer rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400">
              <option value="en">English</option>
              <option value="fr">Français</option>
              <option value="ar">العربية</option>
            </select>
          </label>
          <label className="space-y-1.5 text-xs font-semibold text-slate-300">
            {t.maxPlayers}
            <select value={maxPlayers} onChange={(e) => setMaxPlayers(Number(e.target.value))} className="h-11 w-full cursor-pointer rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400">
              {[4, 6, 8, 10, 12, 16].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-slate-300">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={aiRed} onChange={(e) => setAiRed(e.target.checked)} className="h-4 w-4 accent-rose-500" />
            <Bot className="h-4 w-4 text-rose-300" /> {t.aiSpymasterRed}
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={aiBlue} onChange={(e) => setAiBlue(e.target.checked)} className="h-4 w-4 accent-sky-500" />
            <Bot className="h-4 w-4 text-sky-300" /> {t.aiSpymasterBlue}
          </label>
        </div>
        <p className="-mt-3 text-[11px] text-slate-500">Tip: with both AI spymasters on, just 2 humans (one operative per team) can start a game.</p>

        <Button size="lg" className="w-full" onClick={() => void onCreate()} disabled={busy !== null || cleanCats.length === 0}>
          {busy === "create" ? <Loader2 className="h-5 w-5 animate-spin" /> : null} {t.createRoom}
        </Button>
      </Card>

      {/* Join room */}
      <Card className="space-y-4 p-6">
        <h2 className="flex items-center gap-2 text-lg font-black text-white">
          <LogIn className="h-5 w-5 text-sky-300" /> {t.joinRoom}
        </h2>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void onJoin();
          }}
        >
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder={t.enterRoomCode}
            aria-label={t.roomCode}
            className="font-mono uppercase tracking-[0.25em]"
            maxLength={8}
          />
          <Button type="submit" variant="blue" disabled={busy !== null || code.trim().length < 4}>
            {busy === "join" ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {t.join}
          </Button>
        </form>
      </Card>
    </div>
  );
}
