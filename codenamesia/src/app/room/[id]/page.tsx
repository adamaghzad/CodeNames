"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Crown, Loader2, LogOut, Play, Sparkles, Users, Wifi, WifiOff, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InviteLink } from "@/components/lobby/InviteLink";
import { TeamPanel } from "@/components/lobby/TeamPanel";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { useRoom } from "@/hooks/useRoom";
import {
  ensureIdentity,
  joinRoom,
  leaveRoom as leaveRoomApi,
  loadIdentity,
  rememberRoom,
  setAiSpymaster,
  setReady,
  setRole,
  setTeam,
  startRoomGame,
} from "@/lib/multiplayer/client";
import type { Team } from "@/lib/game-engine/types";

export default function RoomLobbyPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const code = (params.id ?? "").toUpperCase();

  const [joined, setJoined] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [name, setName] = useState(loadIdentity()?.displayName ?? "");
  const [busy, setBusy] = useState(false);
  const [starting, setStarting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const joinAttempted = useRef(false);

  const { room, error: roomError, connected, refresh } = useRoom(joined ? code : null);

  // Auto-join when we already have an identity with a name (invite-link flow).
  useEffect(() => {
    if (joinAttempted.current) return;
    const existing = loadIdentity();
    if (existing?.displayName) {
      joinAttempted.current = true;
      void doJoin(existing.displayName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Everyone follows the host into the game.
  useEffect(() => {
    if (room && (room.status === "playing" || room.status === "finished") && room.gameId) {
      router.replace(`/game/${room.gameId}`);
    }
  }, [room, router]);

  async function doJoin(displayName?: string) {
    setBusy(true);
    setJoinError(null);
    try {
      await ensureIdentity(displayName?.trim() || undefined);
      const { room: joinedRoom } = await joinRoom(code, displayName?.trim() || undefined);
      rememberRoom(joinedRoom);
      setJoined(true);
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : "Could not join this room.");
    } finally {
      setBusy(false);
    }
  }

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  };

  const onStart = async () => {
    if (!room) return;
    setStarting(true);
    setActionError(null);
    try {
      const { gameId } = await startRoomGame(room.id);
      router.push(`/game/${gameId}`);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not start the game.");
      setStarting(false);
    }
  };

  // ---------- name gate / join errors ----------
  if (!joined) {
    return (
      <Card className="mx-auto mt-16 max-w-md space-y-4 p-7 text-center">
        <Users className="mx-auto h-9 w-9 text-violet-300" />
        <h1 className="text-xl font-black text-white">
          {t.joinRoom} <span className="font-mono tracking-[0.25em] text-violet-300">{code}</span>
        </h1>
        {joinError ? (
          <>
            <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {joinError}
            </p>
            <Link href="/multiplayer">
              <Button variant="outline">{t.multiplayer}</Button>
            </Link>
          </>
        ) : (
          <>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.yourName} aria-label={t.yourName} maxLength={24} />
            <Button className="w-full" size="lg" disabled={busy} onClick={() => void doJoin(name)}>
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : null} {t.join}
            </Button>
            <p className="text-[11px] text-slate-500">{t.guestMode} — a signed guest identity is created for you.</p>
          </>
        )}
      </Card>
    );
  }

  if (!room) {
    return (
      <div className="mx-auto mt-20 max-w-md text-center">
        {roomError ? (
          <p className="text-rose-300">
            {roomError}{" "}
            <button className="underline" onClick={() => void refresh()}>
              Retry
            </button>
          </p>
        ) : (
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-violet-300" />
        )}
      </div>
    );
  }

  const you = room.you;
  const bench = room.members.filter((m) => !m.team);
  const isHost = Boolean(you?.isHost);

  return (
    <div className="space-y-5 pt-8">
      {/* Header */}
      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-black text-white">
              {t.lobby}
              <span className={connected ? "text-emerald-300" : "text-rose-300"} title={connected ? t.connected : t.reconnecting}>
                {connected ? <Wifi className="h-4.5 w-4.5" /> : <WifiOff className="h-4.5 w-4.5" />}
              </span>
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              <Crown className="me-1 inline h-3.5 w-3.5 text-amber-300" />
              {t.host}: <strong className="text-slate-200">{room.hostName}</strong> · {room.members.length}/{room.maxPlayers} {t.playersOnline}
            </p>
          </div>
          <InviteLink code={room.code} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {room.categories.map((c) => (
            <Badge key={c.name} tone="violet">
              <Sparkles className="h-3 w-3" /> {c.name}
            </Badge>
          ))}
          <Badge>{room.difficulty}</Badge>
          <Badge>{room.language.toUpperCase()}</Badge>
          {room.aiSpymaster.red && <Badge tone="red">AI {t.spymaster}</Badge>}
          {room.aiSpymaster.blue && <Badge tone="blue">AI {t.spymaster}</Badge>}
        </div>
        {!connected && <p className="text-xs text-rose-300">{t.reconnecting}</p>}
      </Card>

      {actionError && (
        <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-200">
          {actionError}
        </p>
      )}

      {/* Teams */}
      <div className="grid gap-4 md:grid-cols-2">
        <TeamPanel
          room={room}
          team="red"
          busy={busy}
          onJoinTeam={(team: Team) => void act(() => setTeam(room.id, team))}
          onSetRole={(role) => void act(() => setRole(room.id, role))}
          onToggleAi={(team, enabled) => void act(() => setAiSpymaster(room.id, team, enabled))}
        />
        <TeamPanel
          room={room}
          team="blue"
          busy={busy}
          onJoinTeam={(team: Team) => void act(() => setTeam(room.id, team))}
          onSetRole={(role) => void act(() => setRole(room.id, role))}
          onToggleAi={(team, enabled) => void act(() => setAiSpymaster(room.id, team, enabled))}
        />
      </div>

      {/* Bench */}
      {bench.length > 0 && (
        <Card className="p-4">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">{t.bench}</h3>
          <div className="flex flex-wrap gap-1.5">
            {bench.map((m) => (
              <Badge key={m.id}>
                <span className={m.online ? "text-emerald-300" : "text-slate-500"}>●</span> {m.displayName}
                {m.isYou ? ` (${t.you})` : ""}
              </Badge>
            ))}
          </div>
          {you && !you.team && (
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="red" disabled={busy} onClick={() => void act(() => setTeam(room.id, "red"))}>
                {t.joinTeam}: {t.redTeam}
              </Button>
              <Button size="sm" variant="blue" disabled={busy} onClick={() => void act(() => setTeam(room.id, "blue"))}>
                {t.joinTeam}: {t.blueTeam}
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Actions */}
      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-3">
          {you && !isHost && (
            <Button
              variant={you.ready ? "outline" : "default"}
              disabled={busy}
              onClick={() => void act(() => setReady(room.id, !you.ready))}
            >
              {you.ready ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : null}
              {you.ready ? t.ready : t.notReady}
            </Button>
          )}
          {isHost ? (
            <Button size="lg" disabled={starting || !room.startCheck.canStart} onClick={() => void onStart()}>
              {starting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
              {starting ? t.generating : t.startGame}
            </Button>
          ) : (
            <p className="text-sm text-slate-400">
              {room.startCheck.canStart ? "Waiting for the host to start…" : t.waitingPlayers}
            </p>
          )}
          <Button
            variant="ghost"
            className="ms-auto"
            onClick={() =>
              void (async () => {
                await leaveRoomApi(room.id).catch(() => null);
                router.push("/multiplayer");
              })()
            }
          >
            <LogOut className="h-4 w-4" /> {t.leaveRoom}
          </Button>
        </div>

        {!room.startCheck.canStart && (
          <ul className="space-y-1 text-sm text-amber-200">
            {room.startCheck.problems.map((p) => (
              <li key={p} className="flex items-center gap-2">
                <XCircle className="h-4 w-4 shrink-0" /> {p}
              </li>
            ))}
          </ul>
        )}
        {room.startCheck.canStart && (
          <p className="flex items-center gap-2 text-sm text-emerald-300">
            <CheckCircle2 className="h-4 w-4" /> Both teams are set — ready to play!
          </p>
        )}
      </Card>
    </div>
  );
}
