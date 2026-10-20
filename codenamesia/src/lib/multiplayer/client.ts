"use client";

import { createClient as createSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase/client";
import type { CardTouchView, PublicRoom } from "./types";
import type { PublicGameState } from "@/lib/game-engine/types";

/**
 * Browser-side multiplayer client.
 *
 * Identity: Supabase (anonymous/email/Google) when configured, otherwise a
 * server-signed guest token from POST /api/guest. Either way every request
 * carries `Authorization: Bearer …` and the SERVER derives who you are —
 * the client never asserts its own user id or role.
 */

export interface Identity {
  token: string;
  userId: string;
  displayName: string;
  kind: "guest" | "supabase";
}

const KEY = "codenamesia-identity";

export function loadIdentity(): Identity | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Identity) : null;
  } catch {
    return null;
  }
}

function saveIdentity(id: Identity): Identity {
  try {
    localStorage.setItem(KEY, JSON.stringify(id));
  } catch {
    /* private mode */
  }
  return id;
}

export function savedDisplayName(): string {
  return loadIdentity()?.displayName ?? "";
}

/** Returns a verified-server-side identity, creating one on first use. */
export async function ensureIdentity(displayName?: string): Promise<Identity> {
  const name = (displayName || savedDisplayName() || "").trim();

  if (isSupabaseConfigured) {
    const supabase = createSupabaseBrowser();
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      let session = data.session;
      if (!session) {
        const anon = await supabase.auth.signInAnonymously({
          options: { data: { display_name: name || undefined } },
        });
        session = anon.data.session;
      }
      if (session?.user) {
        return saveIdentity({
          token: session.access_token,
          userId: session.user.id,
          displayName:
            name ||
            (session.user.user_metadata?.display_name as string | undefined) ||
            session.user.email?.split("@")[0] ||
            "Player",
          kind: "supabase",
        });
      }
      // Anonymous auth disabled in the Supabase project → guest fallback below.
    }
  }

  const existing = loadIdentity();
  if (existing?.kind === "guest" && (!name || name === existing.displayName)) return existing;

  const res = await fetch("/api/guest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName: name || undefined }),
  });
  const data = (await res.json()) as Identity & { error?: string };
  if (!res.ok) throw new Error(data.error || "Could not create a guest identity.");
  // Keep the same userId across a pure rename when possible: the server
  // issues a fresh id, so only re-issue when there is no identity yet.
  if (existing?.kind === "guest" && name && name !== existing.displayName) {
    return saveIdentity({ ...existing, displayName: name });
  }
  return saveIdentity(data);
}

export async function authHeaders(): Promise<Record<string, string>> {
  const id = loadIdentity() ?? (await ensureIdentity());
  return { Authorization: `Bearer ${id.token}` };
}

async function parse<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export async function apiGet<T>(path: string): Promise<T> {
  return parse<T>(await fetch(path, { headers: await authHeaders(), cache: "no-store" }));
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return parse<T>(
    await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  );
}

// ------------------------------------------------------------- room calls

export const createRoom = (payload: unknown) =>
  apiPost<{ room: PublicRoom; invitePath: string }>("/api/rooms", payload);

export const joinRoom = (code: string, displayName?: string) =>
  apiPost<{ room: PublicRoom; invitePath: string }>("/api/rooms/join", { code, displayName });

export const fetchRoom = (id: string) => apiGet<{ room: PublicRoom }>(`/api/rooms/${encodeURIComponent(id)}`);

export const setTeam = (roomId: string, team: "red" | "blue" | null) =>
  apiPost<{ room: PublicRoom }>(`/api/rooms/${roomId}/team`, { team });

export const setRole = (roomId: string, role: "spymaster" | "operative") =>
  apiPost<{ room: PublicRoom }>(`/api/rooms/${roomId}/role`, { role });

export const setReady = (roomId: string, ready: boolean) =>
  apiPost<{ room: PublicRoom }>(`/api/rooms/${roomId}/ready`, { ready });

export const setAiSpymaster = (roomId: string, team: "red" | "blue", enabled: boolean) =>
  apiPost<{ room: PublicRoom }>(`/api/rooms/${roomId}/ai-spymaster`, { team, enabled });

export const leaveRoom = (roomId: string) => apiPost<{ left: true }>(`/api/rooms/${roomId}/leave`);
export const restartRoom = (roomId: string) => apiPost<{ room: PublicRoom }>(`/api/rooms/${roomId}/restart`);
export const heartbeat = (roomId: string) => apiPost<{ ok: true }>(`/api/rooms/${roomId}/presence`).catch(() => null);
export const startRoomGame = (roomId: string) =>
  apiPost<{ gameId: string; room: PublicRoom }>("/api/games/start", { roomId });

// ------------------------------------------------------------- game calls

export interface GameResponse {
  game: PublicGameState;
  version: number;
  touches?: CardTouchView[];
  spymasterTeam?: "red" | "blue" | null;
  viewer: {
    team: "red" | "blue" | null;
    role: "spymaster" | "operative";
    displayName: string;
    isHost: boolean;
    aiSpymaster: { red: boolean; blue: boolean };
    roomCode: string;
    roomId: string;
  } | null;
}

export async function fetchGameAuthed(gameId: string, spymasterToken?: string | null): Promise<GameResponse> {
  const headers: Record<string, string> = { ...(loadIdentity() ? await authHeaders() : {}) };
  if (spymasterToken) headers["x-spymaster-token"] = spymasterToken;
  return parse<GameResponse>(await fetch(`/api/games/${encodeURIComponent(gameId)}`, { headers, cache: "no-store" }));
}

export async function postGameAuthed<T>(path: string, body?: unknown, spymasterToken?: string | null): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(loadIdentity() ? await authHeaders() : {}),
  };
  if (spymasterToken) headers["x-spymaster-token"] = spymasterToken;
  return parse<T>(await fetch(path, { method: "POST", headers, body: body !== undefined ? JSON.stringify(body) : undefined }));
}

/** SSE URL for a room (token in query because EventSource can't set headers). */
export function roomEventsUrl(roomId: string): string {
  const id = loadIdentity();
  return `/api/rooms/${encodeURIComponent(roomId)}/events${id ? `?token=${encodeURIComponent(id.token)}` : ""}`;
}

export function rememberRoom(room: PublicRoom) {
  try {
    const raw = localStorage.getItem("codenamesia-my-rooms");
    const list = raw ? (JSON.parse(raw) as { code: string; id: string; at: string }[]) : [];
    const next = [{ code: room.code, id: room.id, at: new Date().toISOString() }, ...list.filter((r) => r.code !== room.code)];
    localStorage.setItem("codenamesia-my-rooms", JSON.stringify(next.slice(0, 12)));
  } catch {
    /* ignore */
  }
}
