"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogIn, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { createClient as createSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { ensureIdentity } from "@/lib/multiplayer/client";

export default function LoginPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const asGuest = async () => {
    setBusy(true);
    try {
      await ensureIdentity(name.trim() || undefined);
      router.push("/multiplayer");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed.");
      setBusy(false);
    }
  };

  const withEmail = async (signUp: boolean) => {
    const supabase = createSupabase();
    if (!supabase) return;
    setBusy(true); setMsg(null);
    const fn = signUp
      ? supabase.auth.signUp({ email, password, options: { data: { display_name: name } } })
      : supabase.auth.signInWithPassword({ email, password });
    const { error } = await fn;
    setBusy(false);
    if (error) setMsg(error.message);
    else router.push("/dashboard");
  };

  const withGoogle = async () => {
    const supabase = createSupabase();
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/dashboard` } });
  };

  return (
    <Card className="mx-auto mt-14 max-w-md space-y-5 p-7">
      <h1 className="text-center text-2xl font-black text-white">{t.login}</h1>
      {msg && <p role="alert" className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-center text-xs text-amber-200">{msg}</p>}

      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-300" htmlFor="login-name">{t.yourName}</label>
        <Input id="login-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Salma" maxLength={24} />
        <Button className="w-full" onClick={() => void asGuest()} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRound className="h-4 w-4" />} {t.guestMode}
        </Button>
        <p className="text-center text-[11px] text-slate-500">Instant, signed guest identity — enough for rooms, teams and stats on this device.</p>
      </div>

      {isSupabaseConfigured ? (
        <div className="space-y-2 border-t border-white/10 pt-5">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.email} aria-label={t.email} />
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t.password} aria-label={t.password} />
          <div className="flex gap-2">
            <Button variant="blue" className="flex-1" onClick={() => void withEmail(false)} disabled={busy}><LogIn className="h-4 w-4" /> {t.login}</Button>
            <Button variant="outline" className="flex-1" onClick={() => void withEmail(true)} disabled={busy}>Sign up</Button>
          </div>
          <Button variant="outline" className="w-full" onClick={() => void withGoogle()}>Google</Button>
        </div>
      ) : (
        <p className="border-t border-white/10 pt-4 text-center text-[11px] text-slate-500">
          Email/Google login activates when Supabase env vars are set (see .env.example).
        </p>
      )}
    </Card>
  );
}
