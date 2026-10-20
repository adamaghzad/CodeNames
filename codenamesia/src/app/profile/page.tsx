"use client";

import { useEffect, useState } from "react";
import { Save, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { ensureIdentity, loadIdentity, type Identity } from "@/lib/multiplayer/client";

export default function ProfilePage() {
  const { t } = useLanguage();
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const [played, setPlayed] = useState(0);

  useEffect(() => {
    const id = loadIdentity();
    setIdentity(id);
    setName(id?.displayName ?? "");
    setPlayed(Number(localStorage.getItem("codenamesia-played") || "0"));
  }, []);

  const save = async () => {
    const id = await ensureIdentity(name.trim() || undefined);
    setIdentity(id);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Card className="mx-auto mt-14 max-w-md space-y-5 p-7">
      <h1 className="flex items-center gap-2 text-2xl font-black text-white"><UserRound className="h-6 w-6 text-violet-300" /> {t.profile}</h1>
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-300" htmlFor="profile-name">{t.yourName}</label>
        <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} />
      </div>
      <dl className="space-y-1 text-sm text-slate-400">
        <div className="flex justify-between"><dt>Player ID</dt><dd className="font-mono text-xs text-slate-300">{identity?.userId?.slice(0, 13) ?? "—"}…</dd></div>
        <div className="flex justify-between"><dt>Identity</dt><dd className="text-slate-300">{identity?.kind ?? "none yet"}</dd></div>
        <div className="flex justify-between"><dt>{t.gamesPlayed}</dt><dd className="text-slate-300">{played}</dd></div>
      </dl>
      <Button className="w-full" onClick={() => void save()}><Save className="h-4 w-4" /> {saved ? t.copied.replace("!", "") + " ✓" : t.save}</Button>
      <p className="text-center text-[11px] text-slate-500">With Supabase Auth, profiles/stats persist in the <span className="font-mono">profiles</span> table across devices.</p>
    </Card>
  );
}
