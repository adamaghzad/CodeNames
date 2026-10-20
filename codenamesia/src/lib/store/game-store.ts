import { randomBytes } from "crypto";
import type { GameState, Team } from "@/lib/game-engine/types";
import type { CardTouchView } from "@/lib/multiplayer/types";

/**
 * Authoritative in-memory game store (server-only).
 *
 * PRODUCTION PATH: when Supabase env vars are present, games should be
 * persisted to Postgres (see supabase/migrations) and synchronized with
 * Supabase Realtime. This store keeps the exact same server-authoritative
 * semantics so the app is fully playable without external services, and the
 * API surface does not change when you switch the persistence layer.
 *
 * Secret assignments live ONLY here (server memory / Postgres) and are
 * exposed exclusively through toPublicState() with a valid spymaster token.
 */
/** An operative's not-yet-confirmed card queue ("touches") for one clue. */
export interface PlayerSelection {
  playerId: string;
  displayName: string;
  team: Team;
  clueId: string;
  cardIds: string[];
  updatedAt: string;
}

export interface ServerGame {
  state: GameState;
  /** Separate tokens per team so each spymaster only unlocks the key card view. */
  spymasterTokens: { red: string; blue: string };
  version: number; // optimistic-concurrency guard against duplicate guesses
  /** Ephemeral pre-confirm selections, keyed by playerId (never persisted as game truth). */
  selections?: Record<string, PlayerSelection>;
}

const globalStore = globalThis as unknown as {
  __codenamesiaGames?: Map<string, ServerGame>;
  __codenamesiaByRoom?: Map<string, string>;
};

const games = (globalStore.__codenamesiaGames ??= new Map<string, ServerGame>());
const byRoom = (globalStore.__codenamesiaByRoom ??= new Map<string, string>());

function newToken(): string {
  return randomBytes(24).toString("base64url");
}

export function saveNewGame(state: GameState): ServerGame {
  const entry: ServerGame = {
    state,
    spymasterTokens: { red: newToken(), blue: newToken() },
    version: 1,
  };
  games.set(state.id, entry);
  byRoom.set(state.roomCode.toUpperCase(), state.id);
  return entry;
}

/**
 * Re-register a game hydrated from Postgres. Fresh spymaster tokens are
 * minted but never distributed for room games (membership is the authority);
 * solo games after a restart require the room/lobby flow instead.
 */
export function restoreGame(state: GameState, version: number): ServerGame {
  const entry: ServerGame = {
    state,
    spymasterTokens: { red: newToken(), blue: newToken() },
    version,
  };
  games.set(state.id, entry);
  byRoom.set(state.roomCode.toUpperCase(), state.id);
  return entry;
}

export function getGame(idOrRoom: string): ServerGame | undefined {
  return games.get(idOrRoom) ?? games.get(byRoom.get(idOrRoom.toUpperCase()) ?? "");
}

/**
 * Atomically replaces state if the expected version matches.
 * Prevents duplicate guesses / race conditions from double-clicks and
 * concurrent operatives (spec §13).
 */
export function commitGame(entry: ServerGame, next: GameState, expectedVersion: number): boolean {
  if (entry.version !== expectedVersion) return false;
  entry.state = next;
  entry.version += 1;
  return true;
}

export function isSpymaster(entry: ServerGame, token: string | null): "red" | "blue" | null {
  if (!token) return null;
  if (token === entry.spymasterTokens.red) return "red";
  if (token === entry.spymasterTokens.blue) return "blue";
  return null;
}


export function setPlayerSelection(entry: ServerGame, selection: PlayerSelection): void {
  entry.selections ??= {};
  if (!selection.cardIds.length) delete entry.selections[selection.playerId];
  else entry.selections[selection.playerId] = selection;
}

export function clearPlayerSelection(entry: ServerGame, playerId: string): void {
  if (entry.selections) delete entry.selections[playerId];
}

/**
 * Touches a viewer may see: only their OWN team's, only while that team is
 * guessing on the current clue, and only on unrevealed cards. Opponents and
 * spectators get [] — selection intent is team-internal table talk.
 */
export function getVisibleTouches(
  entry: ServerGame,
  viewerTeam: Team | null,
  viewerPlayerId?: string | null
): CardTouchView[] {
  const state = entry.state;
  if (
    !viewerTeam ||
    state.status !== "playing" ||
    state.phase !== "guessing" ||
    !state.currentClue ||
    viewerTeam !== state.currentTeam
  ) {
    return [];
  }

  const byId = new Map(state.cards.map((c) => [c.id, c]));
  const touches: CardTouchView[] = [];
  for (const sel of Object.values(entry.selections ?? {})) {
    if (sel.team !== viewerTeam || sel.clueId !== state.currentClue.id) continue;
    const valid = [...new Set(sel.cardIds)].filter((id) => {
      const card = byId.get(id);
      return Boolean(card && !card.revealed);
    });
    valid.forEach((cardId, order) => {
      touches.push({
        cardId,
        playerId: sel.playerId,
        displayName: sel.displayName,
        team: sel.team,
        order,
        isYou: Boolean(viewerPlayerId && sel.playerId === viewerPlayerId),
      });
    });
  }
  touches.sort((a, b) => a.order - b.order || a.displayName.localeCompare(b.displayName));
  return touches;
}

/** Test helper: wipe all games between cases. */
export function __resetGames(): void {
  games.clear();
  byRoom.clear();
}

export function listGames(): GameState[] {
  return [...games.values()].map((g) => g.state).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
