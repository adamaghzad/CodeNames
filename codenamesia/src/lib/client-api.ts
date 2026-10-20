"use client";

import type { PublicGameState } from "@/lib/game-engine/types";

export interface CreateGameResponse {
  game: PublicGameState;
  spymasterTokens: { red: string; blue: string };
  version: number;
}

async function parse<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const tokenKey = (gameId: string, team: "red" | "blue") => `codenamesia-spy-${gameId}-${team}`;

export function storeTokens(gameId: string, tokens: { red: string; blue: string }) {
  sessionStorage.setItem(tokenKey(gameId, "red"), tokens.red);
  sessionStorage.setItem(tokenKey(gameId, "blue"), tokens.blue);
}

export function getToken(gameId: string, team: "red" | "blue"): string | null {
  try {
    return sessionStorage.getItem(tokenKey(gameId, team));
  } catch {
    return null;
  }
}

export async function createGame(payload: unknown): Promise<CreateGameResponse> {
  return parse(
    await fetch("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  );
}

export async function fetchGame(id: string, token?: string | null) {
  return parse<{ game: PublicGameState; spymasterTeam: "red" | "blue" | null; version: number }>(
    await fetch(`/api/games/${encodeURIComponent(id)}`, {
      headers: token ? { "x-spymaster-token": token } : {},
      cache: "no-store",
    })
  );
}

export async function postGame<T>(path: string, body?: unknown, token?: string | null): Promise<T> {
  return parse<T>(
    await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "x-spymaster-token": token } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  );
}

export function trackLocalGame(entry: { id: string; roomCode: string; categories: string[]; mode: string; createdAt: string }) {
  try {
    const raw = localStorage.getItem("codenamesia-my-games");
    const list = raw ? (JSON.parse(raw) as (typeof entry)[]) : [];
    localStorage.setItem("codenamesia-my-games", JSON.stringify([entry, ...list].slice(0, 30)));
    const played = Number(localStorage.getItem("codenamesia-played") || "0") + 1;
    localStorage.setItem("codenamesia-played", String(played));
  } catch {
    /* storage unavailable */
  }
}
