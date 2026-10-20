import { createServiceRoleClient } from "@/lib/supabase/server";
import { getGame, restoreGame } from "@/lib/store/game-store";
import { getRoom, listMembers, putMember, putRoom } from "./room-store";
import type { Room, RoomEvent, RoomMember } from "./types";
import type { GameState } from "@/lib/game-engine/types";

/**
 * Supabase persistence (active only when env is configured).
 *
 * - Every room/member/game mutation is written through to Postgres with the
 *   service-role client (clients have NO direct write policies — see the
 *   migration). `games.state` (jsonb, service-role-only table access) holds
 *   the full engine state INCLUDING secrets; normalized public columns and
 *   `game_cards` rows (without assignments) are what members may read.
 *   Assignments live in `game_card_secrets` (zero RLS policies).
 * - Every change also inserts a public-safe `room_events` row so Supabase
 *   Realtime (postgres_changes) can notify browsers to refetch.
 * - On a cold start, rooms/games hydrate back from Postgres on first access.
 *
 * Failures here are logged, never thrown into the request path: the game
 * must not break because a telemetry/persistence write hiccuped. (In a
 * multi-instance deployment, run with Supabase configured and treat the DB
 * `state_version` compare-and-swap in persistGame() as the cross-instance
 * concurrency guard.)
 */

type Db = NonNullable<ReturnType<typeof createServiceRoleClient>>;
const db = (): Db | null => createServiceRoleClient();

function logErr(where: string, err: unknown) {
  console.error(`[persistence:${where}]`, err instanceof Error ? err.message : err);
}

export async function persistRoom(room: Room): Promise<void> {
  const client = db();
  if (!client) return;
  try {
    const { error } = await client.from("rooms").upsert({
      id: room.id,
      code: room.code,
      host_id: room.hostId,
      categories: room.categories,
      difficulty: room.difficulty,
      language: room.language,
      mode: room.mode,
      status: room.status === "starting" ? "lobby" : room.status,
      max_players: room.maxPlayers,
      ai_spymaster_red: room.aiSpymaster.red,
      ai_spymaster_blue: room.aiSpymaster.blue,
      game_id: room.gameId,
      version: room.version,
      expires_at: room.expiresAt,
    });
    if (error) logErr("rooms", error);
  } catch (e) {
    logErr("rooms", e);
  }
}

export async function persistMember(member: RoomMember): Promise<void> {
  const client = db();
  if (!client) return;
  try {
    const { error } = await client.from("room_members").upsert(
      {
        id: member.id,
        room_id: member.roomId,
        user_id: member.userId,
        display_name: member.displayName,
        team: member.team,
        role: member.role,
        ready: member.ready,
        last_seen_at: member.lastSeenAt,
      },
      { onConflict: "room_id,user_id" }
    );
    if (error) logErr("room_members", error);
  } catch (e) {
    logErr("room_members", e);
  }
}

export async function deleteMemberRow(roomId: string, userId: string): Promise<void> {
  const client = db();
  if (!client) return;
  try {
    await client.from("room_members").delete().eq("room_id", roomId).eq("user_id", userId);
  } catch (e) {
    logErr("room_members:delete", e);
  }
}

export async function persistGame(state: GameState, roomId: string, version: number): Promise<void> {
  const client = db();
  if (!client) return;
  try {
    const { error } = await client.from("games").upsert({
      id: state.id,
      room_id: roomId,
      status: state.status,
      starting_team: state.startingTeam,
      current_team: state.currentTeam,
      current_phase: state.phase,
      current_clue: state.currentClue,
      guesses_used: state.guessesUsedThisTurn,
      winner: state.winner,
      state_version: version,
      state, // full engine state incl. secrets — table has NO client policies
      demo_mode: state.demoMode,
    });
    if (error) logErr("games", error);

    // Public card rows (NO assignment) + private secret rows.
    const publicCards = state.cards.map((c) => ({
      id: c.id,
      game_id: state.id,
      word: c.word,
      category: c.category,
      position: c.position,
      revealed: c.revealed,
    }));
    const secrets = state.cards.map((c) => ({ card_id: c.id, game_id: state.id, assignment: c.assignment }));
    const cErr = (await client.from("game_cards").upsert(publicCards)).error;
    if (cErr) logErr("game_cards", cErr);
    const sErr = (await client.from("game_card_secrets").upsert(secrets)).error;
    if (sErr) logErr("game_card_secrets", sErr);

    const actions = state.actions.map((a) => ({
      id: a.id,
      game_id: state.id,
      action_type: a.type,
      payload: a,
    }));
    if (actions.length) {
      const aErr = (await client.from("game_actions").upsert(actions)).error;
      if (aErr) logErr("game_actions", aErr);
    }
  } catch (e) {
    logErr("games", e);
  }
}

export async function persistRoomEvent(event: Omit<RoomEvent, "at">): Promise<void> {
  const client = db();
  if (!client) return;
  try {
    await client.from("room_events").insert({
      room_id: event.roomId,
      type: event.type,
      room_version: event.roomVersion,
      game_id: event.gameId ?? null,
    });
  } catch (e) {
    logErr("room_events", e);
  }
}

/**
 * Hydrate a room (and its current game) from Postgres into the runtime
 * stores. Called on cache miss so a server restart doesn't kill live rooms.
 */
export async function hydrateRoom(idOrCode: string): Promise<Room | undefined> {
  const existing = getRoom(idOrCode);
  if (existing) return existing;
  const client = db();
  if (!client) return undefined;
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(idOrCode);
    const { data: row } = await client
      .from("rooms")
      .select("*")
      .eq(isUuid ? "id" : "code", isUuid ? idOrCode : idOrCode.toUpperCase())
      .maybeSingle();
    if (!row) return undefined;

    const room: Room = {
      id: row.id,
      code: row.code,
      hostId: row.host_id,
      categories: row.categories ?? [],
      difficulty: row.difficulty,
      language: row.language,
      mode: row.mode,
      status: row.status,
      maxPlayers: row.max_players,
      aiSpymaster: { red: row.ai_spymaster_red, blue: row.ai_spymaster_blue },
      gameId: row.game_id,
      startInProgress: false,
      createdAt: row.created_at,
      expiresAt: row.expires_at ?? new Date(Date.now() + 6 * 3600_000).toISOString(),
      version: row.version ?? 1,
    };
    putRoom(room);

    const { data: memberRows } = await client.from("room_members").select("*").eq("room_id", room.id);
    for (const m of memberRows ?? []) {
      putMember({
        id: m.id,
        roomId: m.room_id,
        userId: m.user_id,
        displayName: m.display_name,
        team: m.team,
        role: m.role,
        ready: m.ready,
        joinedAt: m.joined_at,
        lastSeenAt: m.last_seen_at ?? m.joined_at,
      });
    }

    if (room.gameId && !getGame(room.gameId)) {
      const { data: gameRow } = await client.from("games").select("state,state_version").eq("id", room.gameId).maybeSingle();
      if (gameRow?.state) restoreGame(gameRow.state as GameState, gameRow.state_version ?? 1);
    }
    void listMembers; // (kept for parity with store API)
    return room;
  } catch (e) {
    logErr("hydrate", e);
    return undefined;
  }
}
