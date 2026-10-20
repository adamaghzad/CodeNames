import type { Difficulty, GameMode, Language, Team } from "@/lib/game-engine/types";

export type RoomStatus = "lobby" | "starting" | "playing" | "finished" | "closed";
export type MemberTeam = Team | null; // null = unassigned / spectator bench
export type MemberRole = "spymaster" | "operative";

export interface RoomCategory {
  name: string;
  weight?: number;
}

export interface Room {
  id: string;
  code: string;
  hostId: string;
  categories: RoomCategory[];
  difficulty: Difficulty;
  language: Language;
  mode: GameMode;
  status: RoomStatus;
  maxPlayers: number;
  /** When true, that team's spymaster seat is taken by Groq AI (no human may claim it). */
  aiSpymaster: { red: boolean; blue: boolean };
  gameId: string | null;
  /** Idempotency lock for Start Game (spec §6: no duplicate boards on double-click). */
  startInProgress: boolean;
  createdAt: string;
  expiresAt: string;
  version: number;
}

export interface RoomMember {
  id: string;
  roomId: string;
  userId: string;
  displayName: string;
  team: MemberTeam;
  role: MemberRole;
  ready: boolean;
  joinedAt: string;
  lastSeenAt: string;
}

/** Member as other players may see them (presence derived server-side). */
export interface PublicMember extends RoomMember {
  online: boolean;
  isHost: boolean;
  isYou: boolean;
}

export interface PublicRoom {
  id: string;
  code: string;
  hostId: string;
  hostName: string;
  categories: RoomCategory[];
  difficulty: Difficulty;
  language: Language;
  mode: GameMode;
  status: RoomStatus;
  maxPlayers: number;
  aiSpymaster: { red: boolean; blue: boolean };
  gameId: string | null;
  createdAt: string;
  version: number;
  members: PublicMember[];
  you: PublicMember | null;
  /** Server-computed start checklist so every client renders identical truth. */
  startCheck: {
    canStart: boolean;
    problems: string[];
    red: { spymaster: "human" | "ai" | "missing"; operatives: number };
    blue: { spymaster: "human" | "ai" | "missing"; operatives: number };
  };
}

export type RoomEventType =
  | "room-updated"
  | "member-joined"
  | "member-left"
  | "member-updated"
  | "game-started"
  | "game-updated"
  | "game-finished"
  | "presence";

export interface RoomEvent {
  type: RoomEventType;
  roomId: string;
  roomVersion: number;
  gameId?: string | null;
  at: string;
}

export interface Actor {
  userId: string;
  displayName: string;
  kind: "guest" | "supabase";
}

/**
 * One operative's pre-confirm "touch" on a card, as teammates (including the
 * spymaster) are allowed to see it. `order` is the position in that
 * operative's confirm queue. Never contains assignment/secret data.
 */
export interface CardTouchView {
  cardId: string;
  playerId: string;
  displayName: string;
  team: Team;
  order: number;
  isYou: boolean;
}
