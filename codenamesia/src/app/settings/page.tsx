"use client";

import { Card } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { Language } from "@/lib/game-engine/types";

export default function SettingsPage() {
  const { t, lang, setLang } = useLanguage();
  return (
    <Card className="mx-auto mt-14 max-w-md space-y-5 p-7">
      <h1 className="text-2xl font-black text-white">{t.settings}</h1>
      <label className="block space-y-1.5 text-xs font-semibold text-slate-300">
        {t.language} (UI)
        <select value={lang} onChange={(e) => setLang(e.target.value as Language)} className="h-11 w-full cursor-pointer rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400">
          <option value="en">English</option>
          <option value="fr">Français</option>
          <option value="ar">العربية (RTL)</option>
        </select>
      </label>
      <p className="text-sm text-slate-400">{t.theme}: {t.dark} (default) — deep-navy gaming theme with red/blue team accents.</p>
      <p className="text-[11px] text-slate-500">Board language is chosen per game/room at creation; AI words and clues follow it.</p>
    </Card>
  );
}
