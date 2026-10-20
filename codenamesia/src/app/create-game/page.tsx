"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CategoryInput, type CategoryValue } from "@/components/create/CategoryInput";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { createGame, storeTokens, trackLocalGame } from "@/lib/client-api";
import type { Difficulty, GameMode, Language } from "@/lib/game-engine/types";

export default function CreateGamePage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryValue[]>([{ name: "Artificial Intelligence" }, { name: "Data Science" }]);
  const [showWeights, setShowWeights] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [language, setLanguage] = useState<Language>("en");
  const [mode, setMode] = useState<GameMode>("ai-spymaster");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clean = categories.filter((c) => c.name.trim().length >= 2);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await createGame({ categories: clean, difficulty, language, mode });
      storeTokens(res.game.id, res.spymasterTokens);
      trackLocalGame({
        id: res.game.id,
        roomCode: res.game.roomCode,
        categories: res.game.categories,
        mode: res.game.mode,
        createdAt: res.game.createdAt,
      });
      router.push(`/game/${res.game.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed. Try clearer categories.");
      setBusy(false);
    }
  };

  const selectCls =
    "h-11 w-full cursor-pointer rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400";

  return (
    <div className="mx-auto max-w-3xl space-y-6 pt-10">
      <div className="text-center">
        <h1 className="text-3xl font-black text-white">{t.createGame}</h1>
        <p className="mt-2 text-sm text-slate-400">{t.quickGame} — or play with friends anywhere in <Link className="text-violet-300 underline" href="/multiplayer">{t.multiplayer}</Link>.</p>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-2.5 text-center text-sm text-rose-200">
          {error}
        </p>
      )}

      <Card className="space-y-5 p-6">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{t.categories}</p>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-400">
              <input type="checkbox" checked={showWeights} onChange={(e) => setShowWeights(e.target.checked)} className="accent-violet-500" />
              {t.weight}
            </label>
          </div>
          <CategoryInput value={categories} onChange={setCategories} showWeights={showWeights} />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="space-y-1.5 text-xs font-semibold text-slate-300">
            {t.difficulty}
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)} className={selectCls}>
              <option value="easy">{t.easy}</option>
              <option value="medium">{t.medium}</option>
              <option value="hard">{t.hard}</option>
            </select>
          </label>
          <label className="space-y-1.5 text-xs font-semibold text-slate-300">
            {t.language}
            <select value={language} onChange={(e) => setLanguage(e.target.value as Language)} className={selectCls}>
              <option value="en">English</option>
              <option value="fr">Français</option>
              <option value="ar">العربية</option>
            </select>
          </label>
          <label className="space-y-1.5 text-xs font-semibold text-slate-300">
            {t.gameMode}
            <select value={mode} onChange={(e) => setMode(e.target.value as GameMode)} className={selectCls}>
              <option value="human-vs-human">{t.humanVsHuman}</option>
              <option value="human-vs-ai">{t.humanVsAi}</option>
              <option value="ai-spymaster">{t.aiSpymaster}</option>
              <option value="solo">{t.solo}</option>
            </select>
          </label>
        </div>

        <Button size="lg" className="w-full" onClick={() => void generate()} disabled={busy || clean.length === 0}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
          {busy ? t.generating : t.generateWithAi}
        </Button>
        <p className="text-center text-[11px] text-slate-500">
          Groq <span className="font-mono">openai/gpt-oss-20b</span> generates 25 words · the server assigns teams & the assassin.
        </p>
      </Card>

      <Card className="flex items-center justify-between gap-3 p-5">
        <p className="flex items-center gap-2 text-sm text-slate-300">
          <Users className="h-5 w-5 text-violet-300" /> Friends on other devices?
        </p>
        <Link href="/multiplayer">
          <Button variant="blue">{t.createRoom}</Button>
        </Link>
      </Card>
    </div>
  );
}
