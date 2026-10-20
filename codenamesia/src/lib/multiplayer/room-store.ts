import { randomInt, randomUUID } from "crypto";
import type { Room, RoomMember } from "./types";

/**
 * Authoritative room store (server-only).
 *
 * Mirrors the Supabase schema 1:1 (rooms / room_members). When Supabase is
 * configured, persistence.ts writes every mutation through to Postgres and
 * hydrates rooms back from Postgres after a restart, so the database is the
 * durable source of truth and this map is the hot runtime copy.
 */

const g = globalThis as unknown as {
  __codenamesiaRooms?: Map<string, Room>;
  __codenamesiaRoomByCode?: Map<string, string>;
  __codenamesiaMembers?: Map<string, Map<string, RoomMember>>; // roomId -> userId -> member
  __codenamesiaRoomByGame?: Map<string, string>; // gameId -> roomId
};

const rooms = (g.__codenamesiaRooms ??= new Map());
const byCode = (g.__codenamesiaRoomByCode ??= new Map());
const membersByRoom = (g.__codenamesiaMembers ??= new Map());
const roomByGame = (g.__codenamesiaRoomByGame ??= new Map());

export const ROOM_TTL_MS = 6 * 60 * 60 * 1000; // abandoned-room cleanup horizon
export const ONLINE_WINDOW_MS = 20_000;

/** Short but unpredictable invitation code (crypto RNG, unambiguous alphabet). */
export function generateInviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (;;) {
    const code = Array.from({ length: 6 }, () => alphabet[randomInt(0, alphabet.length)]).join("");
    if (!byCode.has(code)) return code;
  }
}

export function putRoom(room: Room): Room {
  rooms.set(room.id, room);
  byCode.set(room.code.toUpperCase(), room.id);
  if (room.gameId) roomByGame.set(room.gameId, room.id);
  if (!membersByRoom.has(room.id)) membersByRoom.set(room.id, new Map());
  return room;
}

export function getRoom(idOrCode: string): Room | undefined {
  const room = rooms.get(idOrCode) ?? rooms.get(byCode.get(idOrCode.toUpperCase()) ?? "");
  if (!room) return undefined;
  if (Date.parse(room.expiresAt) < Date.now() && room.status !== "playing") {
    deleteRoom(room.id);
    return undefined;
  }
  return room;
}

export function getRoomByGameId(gameId: string): Room | undefined {
  const roomId = roomByGame.get(gameId);
  return roomId ? rooms.get(roomId) : undefined;
}

export function linkGame(room: Room, gameId: string): void {
  room.gameId = gameId;
  roomByGame.set(gameId, room.id);
}

export function deleteRoom(roomId: string): void {
  const room = rooms.get(roomId);
  if (!room) return;
  byCode.delete(room.code.toUpperCase());
  if (room.gameId) roomByGame.delete(room.gameId);
  membersByRoom.delete(roomId);
  rooms.delete(roomId);
}

// ---------------- members ----------------

export function putMember(member: RoomMember): RoomMember {
  let map = membersByRoom.get(member.roomId);
  if (!map) {
    map = new Map();
    membersByRoom.set(member.roomId, map);
  }
  map.set(member.userId, member);
  return member;
}

export function newMember(roomId: string, userId: string, displayName: string): RoomMember {
  return {
    id: randomUUID(),
    roomId,
    userId,
    displayName,
    team: null,
    role: "operative",
    ready: false,
    joinedAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
  };
}

export function getMember(roomId: string, userId: string): RoomMember | undefined {
  return membersByRoom.get(roomId)?.get(userId);
}

export function listMembers(roomId: string): RoomMember[] {
  return [...(membersByRoom.get(roomId)?.values() ?? [])].sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
}

export function removeMember(roomId: string, userId: string): void {
  membersByRoom.get(roomId)?.delete(userId);
}

export function touchMember(roomId: string, userId: string): void {
  const m = getMember(roomId, userId);
  if (m) m.lastSeenAt = new Date().toISOString();
}

/** Test helper / admin: wipe all rooms (used by the test-suite between cases). */
export function __resetRooms(): void {
  rooms.clear();
  byCode.clear();
  membersByRoom.clear();
  roomByGame.clear();
}
