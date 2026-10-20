"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Crown,
  Eye,
  Hand,
  Loader2,
  MessageSquareQuote,
  Minus,
  Plus,
  RotateCcw,
  ScrollText,
  Send,
  Skull,
  Sparkles,
  Trophy,
  Wifi,
  WifiOff,
} from "lucide-react";
import { WordCard } from "./WordCard";
import { TeamRail } from "./TeamRail";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { useRoomEvents } from "@/hooks/useRoom";
import {
  fetchGameAuthed,
  fetchRoom,
  postGameAuthed,
  restartRoom,
  type GameResponse,
} from "@/lib/multiplayer/client";
import type { CardTouchView, PublicRoom } from "@/lib/multiplayer/types";
import { getToken } from "@/lib/client-api";
import type { PublicGameState, Team } from "@/lib/game-engine/types";
import { cn } from "@/lib/utils";

type QuickView = "operative" | "red-spymaster" | "blue-spymaster";

const KEY_COLORS: Record<string, string> = {
  red: "bg-rose-500",
  blue: "bg-sky-500",
  neutral: "bg-amber-200/80",
  assassin: "bg-zinc-950 ring-1 ring-white/60",
};

export function GameBoard({ gameId }: { gameId: string }) {
  const { t } = useLanguage();
  const [data, setData] = useState<GameResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [clueWord, setClueWord] = useState("");
  const [clueNumber, setClueNumber] = useState(2);
  const [selectedIds, setSelectedIds] = useState<string[]>([]); // operative's ordered multi-select queue
  const [quickView, setQuickView] = useState<QuickView>("operative");
  const [room, setRoom] = useState<PublicRoom | null>(null); // team rosters for the command rails
  const aiTriggeredFor = useRef<string>("");
  const selectionSyncKey = useRef<string>("");
  const selectionHydratedFor = useRef<string>("");
  const localSelectionDirty = useRef(false);

  const game: PublicGameState | null = data?.game ?? null;
  const viewer = data?.viewer ?? null; // non-null ⇔ multiplayer room game
  const version = data?.version ?? 0;
  const serverTouches = data?.touches ?? [];

  const quickToken = useMemo<string | null>(() => {
    if (viewer || quickView === "operative") return null;
    return getToken(gameId, quickView === "red-spymaster" ? "red" : "blue");
  }, [viewer, quickView, gameId]);

  const refresh = useCallback(async () => {
    try {
      const fresh = await fetchGameAuthed(gameId, undefined);
      // Quick-game spymaster view needs the token variant of the payload.
      if (!fresh.viewer) {
        const token =
          quickView === "operative" ? null : getToken(gameId, quickView === "red-spymaster" ? "red" : "blue");
        if (token) {
          setData(await fetchGameAuthed(gameId, token));
          setError(null);
          return;
        }
      }
      setData(fresh);
      setError(null);
      if (fresh.viewer) {
        void fetchRoom(fresh.viewer.roomId)
          .then((r) => setRoom(r.room))
          .catch(() => null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load game.");
    }
  }, [gameId, quickView]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Realtime: room games subscribe to room events; quick games poll gently.
  const roomConnected = useRoomEvents(viewer?.roomId ?? null, () => void refresh());
  useEffect(() => {
    if (viewer?.roomId) return;
    const poll = setInterval(() => void refresh(), 3000);
    return () => clearInterval(poll);
  }, [viewer?.roomId, refresh]);

  const isSpymasterView = Boolean(game?.isSpymasterView);
  const myTeam: Team | null = viewer ? viewer.team : null;
  const aiSpyTurn = Boolean(
    game && viewer?.aiSpymaster[game.currentTeam] && game.phase === "awaiting-clue" && game.status === "playing"
  );
  const iCanTriggerAi = Boolean(viewer && (viewer.team === game?.currentTeam || viewer.isHost));

  const canGuess = Boolean(
    game &&
      game.status === "playing" &&
      game.phase === "guessing" &&
      (viewer
        ? viewer.role === "operative" && viewer.team === game.currentTeam
        : quickView === "operative")
  );
  const canGiveClue = Boolean(
    game &&
      game.status === "playing" &&
      game.phase === "awaiting-clue" &&
      (viewer
        ? viewer.role === "spymaster" && viewer.team === game.currentTeam && !viewer.aiSpymaster[game.currentTeam]
        : quickView === `${game.currentTeam}-spymaster`)
  );

  // Keep the operative's ordered multi-select valid as realtime state changes
  // (teammate reveals, turn switches, guess-budget changes). In quick games
  // the queue survives View-as switches so the spymaster can peek at touches
  // and hand the device back without losing the operative's selection.
  useEffect(() => {
    if (!game) return;
    setSelectedIds((prev) => {
      if (game.status !== "playing" || game.phase !== "guessing") return prev.length ? [] : prev;
      if (viewer && !canGuess) return prev.length ? [] : prev;
      const left = Math.max(0, game.maxGuesses - game.guessesUsedThisTurn);
      const next = prev.filter((id) => game.cards.some((c) => c.id === id && !c.revealed)).slice(0, left);
      return next.length === prev.length && next.every((id, i) => id === prev[i]) ? prev : next;
    });
  }, [game, canGuess, viewer]);

  // Restore my queue from the server once per clue (reload / second device).
  useEffect(() => {
    if (!game || !canGuess || !game.currentClue) return;
    const clueKey = `${game.id}:${game.currentClue.id}:${viewer?.team ?? game.currentTeam}`;
    if (selectionHydratedFor.current === clueKey) return;
    selectionHydratedFor.current = clueKey;
    if (localSelectionDirty.current) return;
    const mine = serverTouches
      .filter((touch) => touch.isYou)
      .sort((a, b) => a.order - b.order)
      .map((touch) => touch.cardId);
    if (mine.length) {
      selectionSyncKey.current = `${game.id}:${game.currentClue.id}:${mine.join(",")}`;
      setSelectedIds(mine);
    }
  }, [game, canGuess, serverTouches, viewer?.team]);

  // Sync my queue to the server so teammates + the spymaster see my touches
  // BEFORE I confirm. Debounced; the sent-key is only marked when the request
  // actually fires so a realtime refresh can't cancel it into oblivion.
  useEffect(() => {
    if (!game || !canGuess || !game.currentClue) return;
    const key = `${game.id}:${game.currentClue.id}:${selectedIds.join(",")}`;
    if (selectionSyncKey.current === key) return;
    const timer = setTimeout(() => {
      if (selectionSyncKey.current === key) return;
      selectionSyncKey.current = key;
      void postGameAuthed(`/api/games/${gameId}/selection`, { cardIds: selectedIds }, quickToken).catch(() => {
        if (selectionSyncKey.current === key) selectionSyncKey.current = "";
      });
    }, 120);
    return () => clearTimeout(timer);
  }, [selectedIds, canGuess, game, gameId, quickToken]);

  // ---- actions ----
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
      await refresh();
    } finally {
      setBusy(false);
      setSelectedIds([]);
    }
  };

  const submitClue = () =>
    act(async () => {
      await postGameAuthed(`/api/games/${gameId}/clue`, { clue: clueWord.trim(), number: clueNumber }, quickToken);
      setClueWord("");
    });

  const confirmGuess = () => {
    if (!game || !selectedIds.length) return;
    const left = Math.max(0, game.maxGuesses - game.guessesUsedThisTurn);
    const ids = selectedIds
      .filter((id) => game.cards.some((c) => c.id === id && !c.revealed))
      .slice(0, left);
    if (!ids.length) {
      setSelectedIds([]);
      return;
    }
    return act(() => postGameAuthed(`/api/games/${gameId}/guess`, { cardIds: ids, version }, quickToken));
  };

  const endTurnNow = () => act(() => postGameAuthed(`/api/games/${gameId}/end-turn`, {}, quickToken));

  const requestAiClue = useCallback(async () => {
    setAiBusy(true);
    setError(null);
    try {
      if (viewer) {
        await postGameAuthed(`/api/games/${gameId}/ai-clue`, {});
      } else {
        await postGameAuthed(`/api/ai/generate-clue`, { gameId, apply: true }, quickToken);
      }
      await refresh();
    } catch (e) {
      aiTriggeredFor.current = ""; // allow manual/auto retry after a failure
      setError(e instanceof Error ? e.message : "AI clue failed.");
    } finally {
      setAiBusy(false);
    }
  }, [viewer, gameId, quickToken, refresh]);

  // Auto-trigger the AI spymaster in rooms (server dedupes concurrent calls).
  // IMPORTANT: mark the guard only when the request actually fires. Realtime
  // refetches recreate `game`/`viewer` within milliseconds of mount, which
  // runs this effect's cleanup and cancels a naive timer — with the guard
  // already set, the AI clue would never be requested.
  useEffect(() => {
    if (!game || !aiSpyTurn || !iCanTriggerAi) return;
    const key = `${game.id}:${game.clues.length}:${game.currentTeam}`;
    if (aiTriggeredFor.current === key) return;
    const id = setTimeout(() => {
      if (aiTriggeredFor.current === key) return;
      aiTriggeredFor.current = key;
      void requestAiClue();
    }, 700);
    return () => clearTimeout(id);
  }, [game, aiSpyTurn, iCanTriggerAi, requestAiClue]);

  const aiTurn = () =>
    act(async () => {
      setAiBusy(true);
      try {
        await postGameAuthed(`/api/games/${gameId}/ai-turn`, {}, quickToken);
      } finally {
        setAiBusy(false);
      }
    });

  const aiGuessOnce = () =>
    act(async () => {
      setAiBusy(true);
      try {
        await postGameAuthed(`/api/ai/guess`, { gameId, apply: true }, quickToken);
      } finally {
        setAiBusy(false);
      }
    });

  const rematch = () =>
    viewer &&
    act(async () => {
      await restartRoom(viewer.roomId);
      window.location.href = `/room/${viewer.roomCode}`;
    });

  // ---- render states ----
  if (!game) {
    return error ? (
      <Card className="mx-auto mt-16 max-w-lg p-8 text-center">
        <p className="font-semibold text-rose-300">{error}</p>
        <Button className="mt-4" onClick={() => void refresh()}>
          Retry
        </Button>
      </Card>
    ) : (
      <div className="mx-auto mt-16 grid max-w-3xl grid-cols-5 gap-2" aria-label="Loading board">
        {Array.from({ length: 25 }).map((_, i) => (
          <div key={i} className="skeleton aspect-[4/3] rounded-xl" />
        ))}
      </div>
    );
  }

  const guessesLeft = Math.max(0, game.maxGuesses - game.guessesUsedThisTurn);
  const selectedCards = (canGuess ? selectedIds : [])
    .flatMap((id) => {
      const card = game.cards.find((c) => c.id === id);
      return card && !card.revealed ? [card] : [];
    })
    .slice(0, guessesLeft);
  const validSelectedIds = selectedCards.map((c) => c.id);
  const selectedIndexById = new Map(validSelectedIds.map((id, index) => [id, index] as const));
  const selectionFull = validSelectedIds.length >= guessesLeft;
  const toggleSelected = (cardId: string) => {
    if (!canGuess) return;
    localSelectionDirty.current = true;
    setSelectedIds((prev) => {
      const valid = prev.filter((id) => game.cards.some((c) => c.id === id && !c.revealed)).slice(0, guessesLeft);
      if (valid.includes(cardId)) return valid.filter((id) => id !== cardId);
      if (valid.length >= guessesLeft) return valid;
      return [...valid, cardId];
    });
  };
  const touchesByCard = new Map<string, CardTouchView[]>();
  for (const touch of serverTouches) {
    const list = touchesByCard.get(touch.cardId) ?? [];
    list.push(touch);
    touchesByCard.set(touch.cardId, list);
  }
  const currentLabel = game.currentTeam === "red" ? t.redTeam : t.blueTeam;
  const sortedCards = [...game.cards].sort((a, b) => a.position - b.position);
  const blueMembers = room?.members.filter((m) => m.team === "blue");
  const redMembers = room?.members.filter((m) => m.team === "red");
  const winnerLabel = game.winner === "red" ? t.redTeam : t.blueTeam;

  return (
    <div className="space-y-4">
      {game.demoMode && (
        <p className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-200">
          {t.demoBanner}
        </p>
      )}
      {viewer && !roomConnected && game.status === "playing" && (
        <p className="flex items-center justify-center gap-2 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-xs text-rose-200">
          <WifiOff className="h-3.5 w-3.5" /> {t.reconnecting}
        </p>
      )}
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          role="alert"
          className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-2.5 text-center text-sm text-rose-200"
        >
          {error}
        </motion.p>
      )}

      <div className="flex items-start justify-center gap-4">
        <TeamRail
          team="blue"
          label={t.blueTeam}
          operativesLabel={`${t.operative}s`}
          spymastersLabel={`${t.spymaster}s`}
          youLabel={t.you}
          score={game.scores.blue}
          active={game.status === "playing" && game.currentTeam === "blue"}
          members={blueMembers}
          aiSpymaster={viewer?.aiSpymaster.blue}
        />

        {/* ---------- centre column ---------- */}
        <section className="min-w-0 w-full max-w-4xl flex-1 space-y-3">
          {/* Mission headline */}
          <header className="space-y-1 pt-1 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">
              CodenamesIA · {game.categories.join(" × ")} · {game.difficulty} · {game.language.toUpperCase()}
            </p>
            <AnimatePresence mode="wait">
              <motion.h2
                key={`${game.status}-${game.currentTeam}-${game.phase}-${game.winner ?? ""}`}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ type: "spring", stiffness: 320, damping: 26 }}
                className={cn(
                  "font-display text-xl font-bold uppercase tracking-wide sm:text-3xl",
                  game.status === "finished"
                    ? "gradient-text"
                    : game.currentTeam === "red"
                      ? "text-rose-200 drop-shadow-[0_0_18px_rgba(255,70,88,0.35)]"
                      : "text-sky-200 drop-shadow-[0_0_18px_rgba(34,184,240,0.35)]"
                )}
              >
                {game.status === "finished" ? `${winnerLabel} ${t.wins}` : `${currentLabel} ${t.yourTurn}`}
              </motion.h2>
            </AnimatePresence>
            <p className="text-xs font-medium text-slate-400 sm:text-sm">
              {game.status === "finished" ? (
                game.winReason === "assassin" ? t.assassinHit : `${t.redTeam} ${game.scores.red.found}/${game.scores.red.total} · ${t.blueTeam} ${game.scores.blue.found}/${game.scores.blue.total}`
              ) : game.phase === "awaiting-clue" ? (
                t.waitingClue
              ) : (
                `${guessesLeft} ${t.guessesLeft}`
              )}
            </p>
          </header>

          {/* Mobile / tablet score strip (rails take over on xl) */}
          <div className="grid grid-cols-2 gap-2 xl:hidden">
            {(["blue", "red"] as Team[]).map((team) => (
              <div
                key={team}
                className={cn(
                  "glass-panel flex items-center justify-between rounded-2xl px-3 py-2",
                  game.status === "playing" && game.currentTeam === team && "ring-2 ring-white/35"
                )}
              >
                <span className={cn("text-xs font-black uppercase tracking-wider", team === "red" ? "text-rose-200" : "text-sky-200")}>
                  {team === "red" ? t.redTeam : t.blueTeam}
                </span>
                <span className="font-display text-2xl font-bold leading-none text-white">
                  {Math.max(0, game.scores[team].total - game.scores[team].found)}
                  <span className="ms-1 align-middle text-[10px] font-semibold text-slate-400">
                    {game.scores[team].found}/{game.scores[team].total}
                  </span>
                </span>
              </div>
            ))}
          </div>

          {/* Identity / view row */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span className="flex items-center gap-2">
              {viewer ? (
                <>
                  <span className={cn("flex items-center gap-1 font-semibold", roomConnected ? "text-emerald-300" : "text-rose-300")}>
                    {roomConnected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />} {t.connected}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono tracking-widest">{viewer.roomCode}</span>
                </>
              ) : (
                <span className="flex items-center gap-1.5 font-semibold text-violet-300">
                  <Sparkles className="h-3.5 w-3.5" /> {t.quickGame}
                </span>
              )}
            </span>
            {viewer ? (
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                {t.you}: <strong className="text-slate-100">{viewer.displayName}</strong> ·{" "}
                {viewer.team ? (viewer.team === "red" ? t.redTeam : t.blueTeam) : t.spectator} ·{" "}
                {viewer.role === "spymaster" ? t.spymaster : t.operative}
                {viewer.isHost && <Crown className="ms-1 inline h-3.5 w-3.5 text-amber-300" />}
              </span>
            ) : (
              <label className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1 pe-1 ps-2.5">
                <Eye className="h-3.5 w-3.5" /> {t.viewAs}
                <select
                  value={quickView}
                  onChange={(e) => setQuickView(e.target.value as QuickView)}
                  className="h-7 cursor-pointer rounded-full border border-white/15 bg-slate-900 px-2 text-xs font-semibold text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-300"
                >
                  <option value="operative">{t.operative}</option>
                  <option value="red-spymaster">{t.redTeam} {t.spymaster}</option>
                  <option value="blue-spymaster">{t.blueTeam} {t.spymaster}</option>
                </select>
              </label>
            )}
          </div>

          {/* Board */}
          <div
            className={cn(
              "board-frame rounded-[1.8rem] p-2.5 transition-shadow duration-500 sm:p-4",
              game.status === "playing" &&
                (game.currentTeam === "red"
                  ? "shadow-[0_0_70px_-18px_rgba(255,70,88,0.45)]"
                  : "shadow-[0_0_70px_-18px_rgba(34,184,240,0.45)]")
            )}
          >
            <div className="relative z-10 grid grid-cols-5 gap-2 sm:gap-2.5" role="grid" aria-label="Game board">
              {sortedCards.map((card, i) => (
                <WordCard
                  key={card.id}
                  card={card}
                  index={i}
                  selected={selectedIndexById.has(card.id)}
                  selectedIndex={selectedIndexById.get(card.id)}
                  touches={touchesByCard.get(card.id)}
                  spymasterView={isSpymasterView}
                  canGuess={canGuess && (selectedIndexById.has(card.id) || !selectionFull)}
                  busy={busy}
                  onGuess={toggleSelected}
                />
              ))}
            </div>
          </div>

          {canGuess && (
            <p className="text-center text-xs text-slate-400">
              {t.multiSelectHint}{" "}
              <span className="font-semibold text-slate-100">
                {validSelectedIds.length}/{guessesLeft}
              </span>
            </p>
          )}

          {/* Confirm reveal */}
          <AnimatePresence>
            {selectedCards.length > 0 && canGuess && (
              <motion.div
                initial={{ opacity: 0, y: 14, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                className="glass-panel sticky bottom-4 z-20 flex items-center justify-between gap-3 rounded-full py-2 pe-2 ps-5"
              >
                <p
                  className="min-w-0 truncate text-sm text-slate-200"
                  title={selectedCards.map((c) => c.word).join(" → ")}
                >
                  {t.confirmRevealSelected}{" "}
                  <strong className="font-display uppercase text-white">
                    {selectedCards.map((c) => c.word).join(" → ")}
                  </strong>{" "}
                  <span className="text-xs font-semibold text-violet-200">
                    ({selectedCards.length}/{guessesLeft})
                  </span>
                </p>
                <div className="flex shrink-0 gap-2">
                  <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setSelectedIds([])}>
                    {t.cancel}
                  </Button>
                  <Button size="sm" className="rounded-full" onClick={() => void confirmGuess()} disabled={busy || !selectedCards.length}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hand className="h-4 w-4" />} {t.reveal}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Clue command bar */}
          {game.status === "playing" && (
            <div className="flex items-stretch gap-2">
              {canGiveClue ? (
                <div className="glass-panel flex flex-1 items-center gap-2 rounded-full py-1.5 pe-1.5 ps-5">
                  <MessageSquareQuote className="h-5 w-5 shrink-0 text-violet-300" aria-hidden />
                  <input
                    value={clueWord}
                    onChange={(e) => setClueWord(e.target.value.replace(/\s/g, ""))}
                    placeholder={t.clueWord}
                    aria-label={t.clueWord}
                    onKeyDown={(e) => e.key === "Enter" && clueWord.trim() && void submitClue()}
                    className="h-11 min-w-0 flex-1 bg-transparent font-display text-lg font-bold uppercase tracking-wide text-white placeholder:text-sm placeholder:font-medium placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-500 focus:outline-none"
                  />
                  <span className="flex shrink-0 items-center gap-1">
                    <button type="button" aria-label="Decrease clue number" onClick={() => setClueNumber((n) => Math.max(0, n - 1))} className="grid h-8 w-8 cursor-pointer place-items-center rounded-full border border-white/15 bg-white/5 text-slate-200 transition hover:bg-white/15">
                      <Minus className="h-4 w-4" />
                    </button>
                    <input
                      type="number"
                      min={0}
                      max={9}
                      value={clueNumber}
                      onChange={(e) => setClueNumber(Math.max(0, Math.min(9, Number(e.target.value) || 0)))}
                      aria-label={t.clueNumber}
                      className={cn(
                        "h-11 w-11 rounded-full text-center font-display text-lg font-bold text-white focus:outline-none focus:ring-2 focus:ring-white/60 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
                        game.currentTeam === "red" ? "bg-gradient-to-br from-rose-400 to-red-700" : "bg-gradient-to-br from-sky-400 to-blue-700"
                      )}
                    />
                    <button type="button" aria-label="Increase clue number" onClick={() => setClueNumber((n) => Math.min(9, n + 1))} className="grid h-8 w-8 cursor-pointer place-items-center rounded-full border border-white/15 bg-white/5 text-slate-200 transition hover:bg-white/15">
                      <Plus className="h-4 w-4" />
                    </button>
                  </span>
                  <Button className="h-11 shrink-0 rounded-full px-5" onClick={() => void submitClue()} disabled={busy || !clueWord.trim()}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {t.giveClue}
                  </Button>
                </div>
              ) : aiSpyTurn ? (
                <div className="glass-panel flex flex-1 items-center justify-center gap-3 rounded-full px-5 py-3">
                  <Bot className="h-5 w-5 text-violet-300" aria-hidden />
                  <p className="text-sm font-semibold text-violet-100">
                    {t.aiSpymaster} — {currentLabel}
                  </p>
                  {aiBusy ? (
                    <span className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Loader2 className="h-4 w-4 animate-spin" /> Groq
                      <span className="think-dot h-1.5 w-1.5 rounded-full bg-violet-300" />
                      <span className="think-dot h-1.5 w-1.5 rounded-full bg-violet-300" style={{ animationDelay: "0.15s" }} />
                      <span className="think-dot h-1.5 w-1.5 rounded-full bg-violet-300" style={{ animationDelay: "0.3s" }} />
                    </span>
                  ) : iCanTriggerAi ? (
                    <Button variant="outline" size="sm" className="rounded-full" onClick={() => void requestAiClue()}>
                      {t.aiClue}
                    </Button>
                  ) : (
                    <span className="text-xs text-slate-500">{t.waitingClue}</span>
                  )}
                </div>
              ) : game.currentClue ? (
                <motion.div
                  key={game.currentClue.id}
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 340, damping: 26 }}
                  className={cn(
                    "glass-panel relative flex flex-1 items-center justify-center gap-3 rounded-full px-5 py-3",
                    game.currentTeam === "red" ? "shadow-[0_0_44px_-12px_rgba(255,70,88,0.5)]" : "shadow-[0_0_44px_-12px_rgba(34,184,240,0.5)]"
                  )}
                >
                  <p className="hidden text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400 sm:block">{t.currentClue}</p>
                  <p className="font-display text-2xl font-bold uppercase tracking-wide text-white sm:text-3xl">
                    {game.currentClue.clue}
                  </p>
                  {game.currentClue.givenBy === "ai" && (
                    <Badge tone="violet">
                      <Bot className="h-3 w-3" /> AI
                    </Badge>
                  )}
                  <span
                    className={cn(
                      "absolute -end-1 -top-2 grid h-9 w-9 place-items-center rounded-full font-display text-base font-bold text-white shadow-lg ring-2 ring-white/40",
                      game.currentTeam === "red" ? "bg-gradient-to-br from-rose-400 to-red-700" : "bg-gradient-to-br from-sky-400 to-blue-700"
                    )}
                  >
                    {game.currentClue.number}
                  </span>
                </motion.div>
              ) : (
                <div className="glass-panel flex flex-1 items-center justify-center gap-2 rounded-full px-5 py-3.5 text-sm text-slate-400">
                  <MessageSquareQuote className="h-4 w-4" aria-hidden /> {t.waitingClue}
                </div>
              )}
              {canGuess && (
                <Button variant="outline" className="h-auto shrink-0 rounded-full px-5" onClick={() => void endTurnNow()} disabled={busy}>
                  {t.endTurn}
                </Button>
              )}
            </div>
          )}

          {/* Quick-game AI controls */}
          {!viewer && game.status === "playing" && (game.mode !== "human-vs-human") && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
                <Bot className="h-3.5 w-3.5 text-violet-300" /> AI
              </span>
              {game.phase === "awaiting-clue" && (game.mode === "ai-spymaster" || game.mode === "solo") && (
                <Button variant="outline" size="sm" className="rounded-full" onClick={() => void requestAiClue()} disabled={aiBusy}>
                  {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {t.aiClue}
                </Button>
              )}
              {game.mode === "human-vs-ai" && (
                <Button variant="outline" size="sm" className="rounded-full" onClick={() => void aiTurn()} disabled={busy || aiBusy}>
                  {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {t.startAiTurn} ({currentLabel})
                </Button>
              )}
              {game.phase === "guessing" && (
                <Button variant="outline" size="sm" className="rounded-full" onClick={() => void aiGuessOnce()} disabled={busy || aiBusy}>
                  {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {t.aiGuess}
                </Button>
              )}
            </div>
          )}

          {/* Dock: key card / victory + game log */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-3">
              {game.status === "finished" && (
                <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 20 }}>
                  <Card className="relative space-y-2 overflow-hidden p-4 text-center">
                    <span className="pointer-events-none absolute inset-0 opacity-60" aria-hidden>
                      <span className="animate-floaty absolute start-6 top-3 h-2 w-2 rounded-full bg-amber-300" />
                      <span className="animate-floaty absolute end-8 top-5 h-2 w-2 rounded-full bg-rose-400" style={{ animationDelay: "0.6s" }} />
                      <span className="animate-floaty absolute bottom-4 start-1/3 h-2 w-2 rounded-full bg-sky-400" style={{ animationDelay: "1.1s" }} />
                    </span>
                    <Trophy className="relative mx-auto h-9 w-9 text-amber-300" />
                    <p className="relative font-display text-lg font-bold uppercase text-white">{winnerLabel} {t.wins}</p>
                    {viewer?.isHost ? (
                      <Button className="relative w-full rounded-full" onClick={() => void rematch()}>
                        <RotateCcw className="h-4 w-4" /> {t.rematch}
                      </Button>
                    ) : viewer ? (
                      <Link href={`/room/${viewer.roomCode}`} className="relative block">
                        <Button variant="outline" className="w-full rounded-full">{t.backToLobby}</Button>
                      </Link>
                    ) : (
                      <Link href="/create-game" className="relative block">
                        <Button className="w-full rounded-full">{t.newGame}</Button>
                      </Link>
                    )}
                  </Card>
                </motion.div>
              )}

              {isSpymasterView && (
                <Card className="p-4">
                  <h3 className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
                    <Eye className="h-3.5 w-3.5" /> {t.keyCard}
                  </h3>
                  <div className="grid grid-cols-5 gap-1">
                    {sortedCards.map((c) => (
                      <span
                        key={c.id}
                        title={`${c.word} — ${c.assignment ?? ""}`}
                        className={cn(
                          "grid aspect-square place-items-center rounded-lg text-[8px] font-black text-white/90",
                          c.assignment ? KEY_COLORS[c.assignment] : "bg-slate-700",
                          c.revealed && "opacity-35"
                        )}
                      >
                        {c.assignment === "assassin" ? <Skull className="h-3 w-3" /> : c.word.slice(0, 2)}
                      </span>
                    ))}
                  </div>
                </Card>
              )}
            </div>

            <Card className={cn("p-4", !isSpymasterView && game.status !== "finished" && "sm:col-span-2")}>
              <h3 className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
                <ScrollText className="h-3.5 w-3.5" /> {t.gameLog}
              </h3>
              <ul className="slim-scroll max-h-52 space-y-1.5 overflow-y-auto pe-1 text-xs text-slate-400">
                <AnimatePresence initial={false}>
                  {[...game.actions].reverse().slice(0, 20).map((a) => (
                    <motion.li
                      key={a.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="border-b border-white/5 pb-1.5"
                    >
                      {a.message}
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </Card>
          </div>

          <p className="text-center text-[11px] text-slate-600">
            {game.categories.join(" · ")} · {game.difficulty} · {game.language.toUpperCase()} · Room {game.roomCode}
          </p>
        </section>

        <TeamRail
          team="red"
          label={t.redTeam}
          operativesLabel={`${t.operative}s`}
          spymastersLabel={`${t.spymaster}s`}
          youLabel={t.you}
          score={game.scores.red}
          active={game.status === "playing" && game.currentTeam === "red"}
          members={redMembers}
          aiSpymaster={viewer?.aiSpymaster.red}
        />
      </div>
    </div>
  );
}
