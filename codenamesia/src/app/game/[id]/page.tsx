"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { GameBoard } from "@/components/game/GameBoard";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export default function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useLanguage();
  return (
    <div className="pt-6">
      <Link href="/dashboard" className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> {t.dashboard}
      </Link>
      <GameBoard gameId={decodeURIComponent(id)} />
    </div>
  );
}
