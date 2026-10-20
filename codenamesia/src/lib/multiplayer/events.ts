import { EventEmitter } from "events";
import type { RoomEvent } from "./types";

/**
 * Realtime notification bus (spec §5).
 *
 * Design rule: events NEVER carry secret data — only "something changed,
 * refetch your authorized state". This makes it impossible to leak card
 * assignments through realtime payloads, whether the transport is our SSE
 * endpoint or Supabase Realtime (postgres_changes on the public-safe
 * `room_events` table, written by persistence.ts).
 *
 * The bus also tracks live SSE connections per room for presence.
 */

const g = globalThis as unknown as {
  __codenamesiaBus?: EventEmitter;
  __codenamesiaConnections?: Map<string, Map<string, number>>;
};

const bus = (g.__codenamesiaBus ??= new EventEmitter());
bus.setMaxListeners(0); // many rooms/players per process

/** roomId -> (userId -> live SSE connection count) */
const connections = (g.__codenamesiaConnections ??= new Map<string, Map<string, number>>());

export function publishRoomEvent(event: Omit<RoomEvent, "at">): void {
  bus.emit(`room:${event.roomId}`, { ...event, at: new Date().toISOString() } satisfies RoomEvent);
}

export function subscribeRoom(roomId: string, listener: (e: RoomEvent) => void): () => void {
  const channel = `room:${roomId}`;
  bus.on(channel, listener);
  return () => bus.off(channel, listener);
}

export function trackConnection(roomId: string, userId: string): () => void {
  let roomConns = connections.get(roomId);
  if (!roomConns) {
    roomConns = new Map();
    connections.set(roomId, roomConns);
  }
  roomConns.set(userId, (roomConns.get(userId) ?? 0) + 1);
  return () => {
    const rc = connections.get(roomId);
    if (!rc) return;
    const next = (rc.get(userId) ?? 1) - 1;
    if (next <= 0) rc.delete(userId);
    else rc.set(userId, next);
    if (rc.size === 0) connections.delete(roomId);
  };
}

export function isConnected(roomId: string, userId: string): boolean {
  return (connections.get(roomId)?.get(userId) ?? 0) > 0;
}
