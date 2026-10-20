"use client";

import { useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function InviteLink({ code }: { code: string }) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/room/${code}` : `/room/${code}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="rounded-xl border border-white/15 bg-black/40 px-4 py-2 font-mono text-2xl font-black tracking-[0.3em] text-white">
        {code}
      </span>
      <Button variant="outline" size="sm" onClick={() => void copy()}>
        {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
        {copied ? t.copied : t.copyInvite}
      </Button>
      <span className="hidden items-center gap-1 text-xs text-slate-500 lg:flex">
        <Link2 className="h-3.5 w-3.5" /> {url}
      </span>
    </div>
  );
}
