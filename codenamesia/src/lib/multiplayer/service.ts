import { randomUUID } from "crypto";
import { generateBoardWords } from "@/lib/ai/services";
import { createGameState } from "@/lib/game-engine/create-board";
import { saveNewGame, type ServerGame } from "@/lib/store/game-store";
import { HttpError } from "@/lib/api-helpers";
import { isConnected, publishRoomEvent } from "./events";
import { deleteMemberRow, hydrateRoom, persistGame, persistMember, persistRoom, persistRoomEvent } from "./persistence";
import {
  ONLINE_WINDOW_MS,
  ROOM_TTL_MS,
  generateInviteCode,
  getMember,
  getRoom,
  getRoomByGameId,
  linkGame,
  listMembers,
  newMember,
  putMember,
  putRoom,
  removeMember,
} from "./room-store";
import type { Actor, PublicMember, PublicRoom, Room, RoomEventType, RoomMember } from "./types";
import type { Difficulty, GameMode, Language, Team } from "@/lib/game-engine/types";

// ---------------------------------------------------------------- helpers

/** Bump version, persist, and notify every connected client to refetch. */
export function emit(room: Room, type: RoomEventType): void {
  room.version += 1;
  publishRoomEvent({ type, roomId: room.id, roomVersion: room.version, gameId: room.gameId });
  void persistRoomEvent({ type, roomId: room.id, roomVersion: room.version, gameId: room.gameId });
  void persistRoom(room);
}

export function isOnline(roomId: string, member: RoomMember): boolean {
  return isConnected(roomId, member.userId) || Date.now() - Date.parse(member.lastSeenAt) < ONLINE_WINDOW_MS;
}

function toPublicMember(room: Room, m: RoomMember, actorId?: string): PublicMember {
  return { ...m, online: isOnline(room.id, m), isHost: m.userId === room.hostId, isYou: m.userId === actorId };
}

export function computeStartCheck(room: Room, members: RoomMember[]): PublicRoom["startCheck"] {
  const problems: string[] = [];
  const side = (team: Team) => {
    const humanSpy = members.some((m) => m.team === team && m.role === "spymaster");
    const spymaster: "human" | "ai" | "missing" = room.aiSpymaster[team] ? "ai" : humanSpy ? "human" : "missing";
    const operatives = members.filter((m) => m.team === team && m.role === "operative").length;
    if (spymaster === "missing") problems.push(`${team === "red" ? "Red" : "Blue"} needs a spymaster (or enable AI spymaster).`);
    if (operatives < 1) problems.push(`${team === "red" ? "Red" : "Blue"} needs at least one operative.`);
    return { spymaster, operatives };
  };
  const red = side("red");
  const blue = side("blue");
  return { canStart: problems.length === 0, problems, red, blue };
}

export function toPublicRoom(room: Room, actorId?: string): PublicRoom {
  const members = listMembers(room.id);
  const host = members.find((m) => m.userId === room.hostId);
  const pub = members.map((m) => toPublicMember(room, m, actorId));
  return {
    id: room.id,
    code: room.code,
    hostId: room.hostId,
    hostName: host?.displayName ?? "Host",
    categories: room.categories,
    difficulty: room.difficulty,
    language: room.language,
    mode: room.mode,
    status: room.status,
    maxPlayers: room.maxPlayers,
    aiSpymaster: room.aiSpymaster,
    gameId: room.gameId,
    createdAt: room.createdAt,
    version: room.version,
    members: pub,
    you: pub.find((m) => m.isYou) ?? null,
    startCheck: computeStartCheck(room, members),
  };
}

export async function loadRoomOr404(idOrCode: string): Promise<Room> {
  const room = (await hydrateRoom(idOrCode)) ?? getRoom(idOrCode);
  if (!room) throw new HttpError(404, "Room not found. Check the code — rooms expire after 6 hours of inactivity.");
  if (room.status === "closed") throw new HttpError(410, "This room has been closed.");
  sweepHost(room);
  return room;
}

export function requireMember(room: Room, userId: string): RoomMember {
  const member = getMember(room.id, userId);
  if (!member) throw new HttpError(403, "You are not a member of this room. Join with the invite link first.");
  return member;
}

function assertLobby(room: Room, action: string): void {
  if (room.status !== "lobby") throw new HttpError(409, `You can only ${action} while the room is in the lobby.`);
}

/** Host migration: if the host vanished, promote the earliest online member. */
export function sweepHost(room: Room): void {
  const members = listMembers(room.id);
  if (members.length <= 1) return;
  const host = members.find((m) => m.userId === room.hostId);
  const hostGone = !host || (!isConnected(room.id, host.userId) && Date.now() - Date.parse(host.lastSeenAt) > 90_000);
  if (!hostGone) return;
  const successor = members.find((m) => m.userId !== room.hostId && isOnline(room.id, m));
  if (successor) {
    room.hostId = successor.userId;
    emit(room, "room-updated");
  }
}

// ------------------------------------------------------------------- CRUD

export interface CreateRoomInput {
  categories: { name: string; weight?: number }[];
  difficulty: Difficulty;
  language: Language;
  mode: GameMode;
  maxPlayers: number;
  aiSpymasterRed?: boolean;
  aiSpymasterBlue?: boolean;
  displayName: string;
}

export async function createRoom(actor: Actor, input: CreateRoomInput): Promise<PublicRoom> {
  const now = Date.now();
  const room: Room = {
    id: randomUUID(),
    code: generateInviteCode(),
    hostId: actor.userId,
    categories: input.categories,
    difficulty: input.difficulty,
    language: input.language,
    mode: input.mode,
    status: "lobby",
    maxPlayers: input.maxPlayers,
    aiSpymaster: { red: Boolean(input.aiSpymasterRed), blue: Boolean(input.aiSpymasterBlue) },
    gameId: null,
    startInProgress: false,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ROOM_TTL_MS).toISOString(),
    version: 1,
  };
  putRoom(room);
  const host = newMember(room.id, actor.userId, input.displayName || actor.displayName);
  host.team = "red";
  host.ready = true;
  putMember(host);
  await Promise.all([persistRoom(room), persistMember(host)]);
  emit(room, "member-joined");
  return toPublicRoom(room, actor.userId);
}

export async function joinRoom(actor: Actor, code: string, displayName?: string): Promise<PublicRoom> {
  const room = await loadRoomOr404(code.trim().toUpperCase());
  const existing = getMember(room.id, actor.userId);
  if (existing) {
    // Reconnect / duplicate-join: idempotent, just refresh presence + name.
    existing.lastSeenAt = new Date().toISOString();
    if (displayName) existing.displayName = displayName;
    void persistMember(existing);
    emit(room, "presence");
    return toPublicRoom(room, actor.userId);
  }
  if (room.status === "finished") throw new HttpError(410, "This room's game has finished. Ask the host for a new room.");
  const members = listMembers(room.id);
  if (members.length >= room.maxPlayers) throw new HttpError(409, `Room is full (${room.maxPlayers} players max).`);

  const member = newMember(room.id, actor.userId, displayName || actor.displayName);
  putMember(member);
  void persistMember(member);
  emit(room, "member-joined");
  return toPublicRoom(room, actor.userId);
}

export function setTeam(room: Room, actor: Actor, team: Team | null): PublicRoom {
  assertLobby(room, "change teams");
  const member = requireMember(room, actor.userId);
  // Leaving a team vacates its spymaster seat.
  member.team = team;
  if (team === null) member.role = "operative";
  member.ready = member.userId === room.hostId ? member.ready : false;
  void persistMember(member);
  emit(room, "member-updated");
  return toPublicRoom(room, actor.userId);
}

export function setRole(room: Room, actor: Actor, role: "spymaster" | "operative"): PublicRoom {
  assertLobby(room, "change roles");
  const member = requireMember(room, actor.userId);
  if (role === "spymaster") {
    if (!member.team) throw new HttpError(422, "Join a team before claiming its spymaster seat.");
    if (room.aiSpymaster[member.team])
      throw new HttpError(409, `The ${member.team} spymaster is AI in this room. Ask the host to disable it first.`);
    const taken = listMembers(room.id).find(
      (m) => m.team === member.team && m.role === "spymaster" && m.userId !== actor.userId
    );
    if (taken) throw new HttpError(409, `${taken.displayName} is already the ${member.team} spymaster. Each team has exactly one.`);
  }
  member.role = role;
  void persistMember(member);
  emit(room, "member-updated");
  return toPublicRoom(room, actor.userId);
}

export function setReady(room: Room, actor: Actor, ready: boolean): PublicRoom {
  assertLobby(room, "change ready status");
  const member = requireMember(room, actor.userId);
  member.ready = ready;
  void persistMember(member);
  emit(room, "member-updated");
  return toPublicRoom(room, actor.userId);
}

export function setAiSpymaster(room: Room, actor: Actor, team: Team, enabled: boolean): PublicRoom {
  assertLobby(room, "change AI spymasters");
  if (actor.userId !== room.hostId) throw new HttpError(403, "Only the host can toggle AI spymasters.");
  room.aiSpymaster[team] = enabled;
  if (enabled) {
    // Demote the human spymaster of that team to operative.
    for (const m of listMembers(room.id)) {
      if (m.team === team && m.role === "spymaster") {
        m.role = "operative";
        void persistMember(m);
      }
    }
  }
  emit(room, "room-updated");
  return toPublicRoom(room, actor.userId);
}

export function leaveRoom(room: Room, actor: Actor): { left: true } {
  const member = getMember(room.id, actor.userId);
  if (!member) return { left: true };
  removeMember(room.id, actor.userId);
  void deleteMemberRow(room.id, actor.userId);
  if (actor.userId === room.hostId) {
    const next = listMembers(room.id)[0];
    if (next) room.hostId = next.userId;
  }
  emit(room, "member-left");
  return { left: true };
}

// ------------------------------------------------------------- game start

/**
 * Host-only, idempotent game start (spec §6):
 * validate → lock → Groq words → server key card → persist → notify.
 */
export async function startGame(actor: Actor, room: Room): Promise<{ gameId: string; room: PublicRoom }> {
  if (actor.userId !== room.hostId) throw new HttpError(403, "Only the host can start the game.");
  requireMember(room, actor.userId);
  if (room.status === "playing" && room.gameId) {
    return { gameId: room.gameId, room: toPublicRoom(room, actor.userId) }; // duplicate click → same game
  }
  if (room.startInProgress) throw new HttpError(409, "Game generation is already in progress…");
  assertLobby(room, "start a game");

  const check = computeStartCheck(room, listMembers(room.id));
  if (!check.canStart) throw new HttpError(422, `Cannot start yet: ${check.problems.join(" ")}`);

  room.startInProgress = true;
  room.status = "starting";
  emit(room, "room-updated");
  try {
    const { words, demoMode } = await generateBoardWords({
      categories: room.categories,
      difficulty: room.difficulty,
      language: room.language,
    });
    const state = createGameState({
      words,
      categories: room.categories.map((c) => c.name),
      difficulty: room.difficulty,
      language: room.language,
      mode: room.mode,
      roomCode: room.code,
      roomId: room.id,
      demoMode,
    });
    const entry = saveNewGame(state);
    linkGame(room, state.id);
    room.status = "playing";
    room.startInProgress = false;
    await persistGame(state, room.id, entry.version);
    emit(room, "game-started");
    return { gameId: state.id, room: toPublicRoom(room, actor.userId) };
  } catch (err) {
    room.startInProgress = false;
    room.status = "lobby";
    emit(room, "room-updated");
    throw err;
  }
}

export function restartRoom(room: Room, actor: Actor): PublicRoom {
  if (actor.userId !== room.hostId) throw new HttpError(403, "Only the host can return the room to the lobby.");
  room.status = "lobby";
  room.gameId = null;
  for (const m of listMembers(room.id)) {
    m.ready = m.userId === room.hostId;
    void persistMember(m);
  }
  emit(room, "room-updated");
  return toPublicRoom(room, actor.userId);
}

// ------------------------------------------------- game authorization (§7/§8)

export interface GameAccess {
  room: Room;
  member: RoomMember;
  /** Both spymasters share one key card in Codenames — either may view it. */
  spymasterView: boolean;
}

/** For room games: verified membership decides who sees the secret board. */
export function authorizeGameView(entry: ServerGame, actor: Actor | null): GameAccess | null {
  if (!entry.state.roomId) return null; // quick/solo game → legacy token flow
  const room = getRoomByGameId(entry.state.id) ?? getRoom(entry.state.roomId);
  if (!room) throw new HttpError(404, "Room for this game no longer exists.");
  if (!actor) throw new HttpError(401, "Sign in (or continue as guest) to view this game.");
  const member = requireMember(room, actor.userId);
  return { room, member, spymasterView: member.role === "spymaster" && member.team !== null };
}

export function authorizeClue(entry: ServerGame, actor: Actor | null): GameAccess | null {
  const access = authorizeGameView(entry, actor);
  if (!access) return null;
  const { member } = access;
  if (member.role !== "spymaster") throw new HttpError(403, "Only your team's spymaster can give clues.");
  if (member.team !== entry.state.currentTeam)
    throw new HttpError(403, `It is the ${entry.state.currentTeam} team's turn — their spymaster gives the clue.`);
  return access;
}

export function authorizeGuess(entry: ServerGame, actor: Actor | null, action = "guess"): GameAccess | null {
  const access = authorizeGameView(entry, actor);
  if (!access) return null;
  const { member } = access;
  if (member.role === "spymaster") throw new HttpError(403, "Spymasters give clues — they never reveal cards.");
  if (member.team !== entry.state.currentTeam)
    throw new HttpError(403, `It is the ${entry.state.currentTeam} team's turn. Your team cannot ${action} now.`);
  return access;
}

export function authorizeAiClue(entry: ServerGame, actor: Actor | null): GameAccess | null {
  const access = authorizeGameView(entry, actor);
  if (!access) return null;
  const team = entry.state.currentTeam;
  if (!access.room.aiSpymaster[team]) throw new HttpError(422, `The ${team} spymaster is human in this room.`);
  const isTeamMate = access.member.team === team;
  const isHost = actor?.userId === access.room.hostId;
  if (!isTeamMate && !isHost) throw new HttpError(403, "Only the current team (or host) can request the AI clue.");
  return access;
}

/** Notify room clients that ephemeral selection touches changed (no DB write). */
export function notifySelection(entry: ServerGame): void {
  if (!entry.state.roomId) return;
  const room = getRoomByGameId(entry.state.id) ?? getRoom(entry.state.roomId);
  if (!room) return;
  publishRoomEvent({ type: "game-updated", roomId: room.id, roomVersion: room.version, gameId: room.gameId });
}

/** Call after every committed game mutation in a room: persist + notify. */
export function afterGameMutation(entry: ServerGame): void {
  if (!entry.state.roomId) return;
  const room = getRoomByGameId(entry.state.id) ?? getRoom(entry.state.roomId);
  if (!room) return;
  void persistGame(entry.state, room.id, entry.version);
  if (entry.state.status === "finished" && room.status !== "finished") {
    room.status = "finished";
    emit(room, "game-finished");
  } else {
    emit(room, "game-updated");
  }
}
