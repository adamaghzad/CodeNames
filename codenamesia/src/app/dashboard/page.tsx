"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, PlusCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

interface RecentGame { id: string; roomCode: string; categories: string[]; mode: string; status: string; winner: string | null; createdAt: string; }
interface MyRoom { code: string; id: string; at: string; }

export default function DashboardPage() {
  const { t } = useLanguage();
  const [games, setGames] = useState<RecentGame[]>([]);
  const [rooms, setRooms] = useState<MyRoom[]>([]);
  const [played, setPlayed] = useState(0);

  useEffect(() => {
    fetch("/api/games").then((r) => r.json()).then((d) => setGames(d.games ?? [])).catch(() => null);
    try {
      setRooms(JSON.parse(localStorage.getItem("codenamesia-my-rooms") ?? "[]") as MyRoom[]);
      setPlayed(Number(localStorage.getItem("codenamesia-played") || "0"));
    } catch { /* ignore */ }
  }, []);

  return (
    <div className="space-y-6 pt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-black text-white">{t.dashboard}</h1>
        <div className="flex gap-2">
          <Link href="/multiplayer"><Button><Users className="h-4 w-4" /> {t.multiplayer}</Button></Link>
          <Link href="/create-game"><Button variant="outline"><PlusCircle className="h-4 w-4" /> {t.createGame}</Button></Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5"><BarChart3 className="mb-2 h-6 w-6 text-violet-300" /><p className="text-2xl font-black text-white">{played}</p><p className="text-xs text-slate-500">{t.gamesPlayed} (this device)</p></Card>
        <Card className="p-5"><Users className="mb-2 h-6 w-6 text-sky-300" /><p className="text-2xl font-black text-white">{rooms.length}</p><p className="text-xs text-slate-500">Rooms visited</p></Card>
        <Card className="p-5"><PlusCircle className="mb-2 h-6 w-6 text-rose-300" /><p className="text-2xl font-black text-white">{games.length}</p><p className="text-xs text-slate-500">Games on this server</p></Card>
      </div>

      {rooms.length > 0 && (
        <Card className="p-5">
          <h2 className="mb-3 font-bold text-white">Your rooms</h2>
          <div className="flex flex-wrap gap-2">
            {rooms.map((r) => (
              <Link key={r.code} href={`/room/${r.code}`}><Badge tone="violet">{r.code}</Badge></Link>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-5">
        <h2 className="mb-3 font-bold text-white">{t.recentGames}</h2>
        {games.length === 0 ? (
          <p className="text-sm text-slate-500">{t.noGames}</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {games.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="text-sm text-slate-300">{g.categories.join(" · ")} <span className="text-xs text-slate-500">({g.mode})</span></span>
                <span className="flex items-center gap-2">
                  <Badge tone={g.status === "finished" ? "neutral" : "violet"}>{g.status}{g.winner ? ` · ${g.winner} won` : ""}</Badge>
                  <Link href={`/game/${g.id}`}><Button size="sm" variant="outline">Open</Button></Link>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
