"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient as createSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase/client";
import { fetchRoom, heartbeat, loadIdentity, roomEventsUrl } from "@/lib/multiplayer/client";
import type { PublicRoom, RoomEvent } from "@/lib/multiplayer/types";

/**
 * Subscribes to a room's realtime notifications and invokes `onSync`
 * (debounced) whenever anything changes. Transports, in parallel:
 *  1. SSE (works everywhere, incl. no-Supabase deployments)
 *  2. Supabase Realtime postgres_changes on public-safe `room_events`
 *     + a Presence channel (when Supabase is configured)
 * Events never carry secrets — they only trigger an authorized refetch.
 * Returns the live connection state for the reconnection banner.
 */
export function useRoomEvents(roomId: string | null, onSync: (e?: RoomEvent) => void): boolean {
  const [connected, setConnected] = useState(false);
  const syncRef = useRef(onSync);
  syncRef.current = onSync;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedule = useCallback((e?: RoomEvent) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => syncRef.current(e), 120);
  }, []);

  useEffect(() => {
    if (!roomId) return;
    let closed = false;

    // --- Transport 1: SSE ---
    const es = new EventSource(roomEventsUrl(roomId));
    es.addEventListener("open", () => {
      if (!closed) {
        setConnected(true);
        schedule();
      }
    });
    es.addEventListener("sync", (msg) => {
      try {
        schedule(JSON.parse((msg as MessageEvent).data) as RoomEvent);
      } catch {
        schedule();
      }
    });
    es.onerror = () => {
      if (!closed) setConnected(false); // EventSource auto-reconnects; onopen refetches.
    };

    // --- Transport 2: Supabase Realtime + Presence (when configured) ---
    let removeChannel: (() => void) | undefined;
    if (isSupabaseConfigured) {
      const supabase = createSupabaseBrowser();
      const me = loadIdentity();
      if (supabase) {
        const channel = supabase
          .channel(`codenamesia-room-${roomId}`, {
            config: { presence: { key: me?.userId ?? "anon" } },
          })
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "room_events", filter: `room_id=eq.${roomId}` },
            () => schedule()
          )
          .on("presence", { event: "sync" }, () => schedule())
          .subscribe(async (status) => {
            if (status === "SUBSCRIBED" && me) {
              await channel.track({ userId: me.userId, displayName: me.displayName, at: new Date().toISOString() });
            }
          });
        removeChannel = () => void supabase.removeChannel(channel);
      }
    }

    // --- Heartbeat + slow poll fallback while disconnected ---
    const beat = setInterval(() => void heartbeat(roomId), 10_000);
    void heartbeat(roomId);
    const poll = setInterval(() => {
      if (es.readyState !== EventSource.OPEN) schedule();
    }, 4_000);

    return () => {
      closed = true;
      es.close();
      removeChannel?.();
      clearInterval(beat);
      clearInterval(poll);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [roomId, schedule]);

  return connected;
}

/** Full lobby state hook: fetch + realtime refetch + connection status. */
export function useRoom(idOrCode: string | null) {
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!idOrCode) return;
    try {
      const { room: fresh } = await fetchRoom(idOrCode);
      setRoom(fresh);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load room.");
    } finally {
      setLoading(false);
    }
  }, [idOrCode]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connected = useRoomEvents(room?.id ?? null, () => void refresh());

  return { room, setRoom, error, loading, connected, refresh };
}
