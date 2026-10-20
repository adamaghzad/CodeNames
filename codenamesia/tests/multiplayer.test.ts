import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { applyGuess, giveClue } from "@/lib/game-engine/game-rules";
import { toPublicState } from "@/lib/game-engine/turn-manager";
import { __resetGames, commitGame, getGame } from "@/lib/store/game-store";
import { issueGuestToken } from "@/lib/multiplayer/identity";
import { subscribeRoom } from "@/lib/multiplayer/events";
import { __resetRooms, getRoom } from "@/lib/multiplayer/room-store";
import {
  authorizeClue,
  authorizeGameView,
  authorizeGuess,
  createRoom,
  joinRoom,
  leaveRoom,
  loadRoomOr404,
  setRole,
  setTeam,
  startGame,
} from "@/lib/multiplayer/service";
import type { Actor, RoomEvent } from "@/lib/multiplayer/types";

const actor = (name: string): Actor => ({ userId: randomUUID(), displayName: name, kind: "guest" });

const baseRoom = (overrides = {}) => ({
  categories: [{ name: "Artificial Intelligence" }, { name: "Morocco" }],
  difficulty: "medium" as const,
  language: "en" as const,
  mode: "human-vs-human" as const,
  maxPlayers: 8,
  displayName: "Host",
  ...overrides,
});

beforeEach(() => {
  __resetRooms();
  __resetGames();
});

describe("guest identity", () => {
  it("issues distinct signed identities per player ('two browsers')", () => {
    const a = issueGuestToken("Alice");
    const b = issueGuestToken("Bob");
    expect(a.token).toMatch(/^gst_/);
    expect(a.userId).not.toBe(b.userId);
  });
});

describe("room lifecycle", () => {
  it("two browsers join the same room and see each other (sync payload)", async () => {
    const host = actor("Host");
    const guest = actor("Guest");
    const created = await createRoom(host, baseRoom());
    const events: RoomEvent[] = [];
    const unsub = subscribeRoom(created.id, (e) => events.push(e));

    const joined = await joinRoom(guest, created.code, "Guest");
    unsub();

    expect(joined.members).toHaveLength(2);
    expect(joined.members.map((m) => m.displayName).sort()).toEqual(["Guest", "Host"]);
    expect(joined.you?.userId).toBe(guest.userId);
    // realtime: the first browser is notified, payload carries no secrets
    expect(events.some((e) => e.type === "member-joined")).toBe(true);
    expect(JSON.stringify(events)).not.toContain("assignment");

    // host's next fetch shows the same synchronized roster
    const room = await loadRoomOr404(created.code);
    expect(room.id).toBe(created.id);
  });

  it("duplicate join is idempotent; capacity and bad codes are rejected", async () => {
    const host = actor("H");
    const a = actor("A");
    const b = actor("B");
    const room = await createRoom(host, baseRoom({ maxPlayers: 2 }));
    await joinRoom(a, room.code);
    const again = await joinRoom(a, room.code); // reconnect
    expect(again.members).toHaveLength(2);
    await expect(joinRoom(b, room.code)).rejects.toThrow(/full/);
    await expect(joinRoom(b, "ZZZZ99")).rejects.toThrow(/not found/);
  });

  it("non-members cannot view a room game", async () => {
    const host = actor("H");
    const outsider = actor("Outsider");
    const room = await createRoom(host, baseRoom({ aiSpymasterRed: true, aiSpymasterBlue: true }));
    const blue = actor("Blue");
    await joinRoom(blue, room.code);
    const r = getRoom(room.id)!;
    setTeam(r, blue, "blue");
    const { gameId } = await startGame(host, r);
    const entry = getGame(gameId)!;
    expect(() => authorizeGameView(entry, outsider)).toThrow(/not a member/);
    expect(() => authorizeGameView(entry, null)).toThrow(/Sign in/);
  });
});

describe("teams & roles", () => {
  it("enforces exactly one human spymaster per team", async () => {
    const host = actor("H");
    const p2 = actor("P2");
    const room = await createRoom(host, baseRoom());
    const r = getRoom(room.id)!;
    await joinRoom(p2, room.code);
    setTeam(r, p2, "red"); // host auto-joined red
    setRole(r, host, "spymaster");
    expect(() => setRole(r, p2, "spymaster")).toThrow(/already the red spymaster/);
    setRole(r, host, "operative");
    expect(setRole(r, p2, "spymaster").you?.role).toBe("spymaster");
  });

  it("an AI spymaster seat cannot be claimed by a human", async () => {
    const host = actor("H");
    const room = await createRoom(host, baseRoom({ aiSpymasterRed: true }));
    const r = getRoom(room.id)!; // host is on red
    expect(() => setRole(r, host, "spymaster")).toThrow(/AI in this room/);
  });

  it("team changes synchronize into the public room state", async () => {
    const host = actor("H");
    const p2 = actor("P2");
    const room = await createRoom(host, baseRoom());
    const r = getRoom(room.id)!;
    await joinRoom(p2, room.code);
    const view = setTeam(r, p2, "blue");
    expect(view.members.find((m) => m.userId === p2.userId)?.team).toBe("blue");
    expect(view.startCheck.blue.operatives).toBe(1);
  });

  it("host leaves -> earliest remaining member becomes host", async () => {
    const host = actor("H");
    const p2 = actor("P2");
    const room = await createRoom(host, baseRoom());
    const r = getRoom(room.id)!;
    await joinRoom(p2, room.code);
    leaveRoom(r, host);
    expect(r.hostId).toBe(p2.userId);
  });
});

describe("starting the game", () => {
  it("only the host can start, and both teams must be valid", async () => {
    const host = actor("H");
    const p2 = actor("P2");
    const room = await createRoom(host, baseRoom());
    const r = getRoom(room.id)!;
    await joinRoom(p2, room.code);
    await expect(startGame(host, r)).rejects.toThrow(/Cannot start yet/); // blue empty
    setTeam(r, p2, "blue");
    await expect(startGame(p2, r)).rejects.toThrow(/Only the host/);
  });

  it("double-start is idempotent (no duplicate board generation)", async () => {
    const host = actor("H");
    const p2 = actor("P2");
    const room = await createRoom(host, baseRoom({ aiSpymasterRed: true, aiSpymasterBlue: true }));
    const r = getRoom(room.id)!;
    await joinRoom(p2, room.code);
    setTeam(r, p2, "blue");
    const first = await startGame(host, r);
    const second = await startGame(host, r);
    expect(second.gameId).toBe(first.gameId);
  });

  it("both clients receive the same 25 words; operatives get no secrets", async () => {
    const host = actor("H");
    const p2 = actor("P2");
    const room = await createRoom(host, baseRoom({ aiSpymasterRed: true, aiSpymasterBlue: true }));
    const r = getRoom(room.id)!;
    await joinRoom(p2, room.code);
    setTeam(r, p2, "blue");
    const { gameId } = await startGame(host, r);
    const entry = getGame(gameId)!;

    const viewA = toPublicState(entry.state, authorizeGameView(entry, host)!.spymasterView);
    const viewB = toPublicState(entry.state, authorizeGameView(entry, p2)!.spymasterView);
    expect(viewA.cards.map((c) => c.word)).toEqual(viewB.cards.map((c) => c.word));
    expect(viewA.cards).toHaveLength(25);
    expect(new Set(viewA.cards.map((c) => c.word)).size).toBe(25);
    for (const c of [...viewA.cards, ...viewB.cards]) expect(c).not.toHaveProperty("assignment");
  });
});

describe("multiplayer gameplay authorization", () => {
  async function startedRoom() {
    const rSpy = actor("RedSpy");
    const rOp = actor("RedOp");
    const bSpy = actor("BlueSpy");
    const bOp = actor("BlueOp");
    const room = await createRoom(rSpy, baseRoom({ displayName: "RedSpy" }));
    const r = getRoom(room.id)!;
    for (const p of [rOp, bSpy, bOp]) await joinRoom(p, room.code);
    // rSpy (host) auto red; arrange full table
    setRole(r, rSpy, "spymaster");
    setTeam(r, rOp, "red");
    setTeam(r, bSpy, "blue");
    setRole(r, bSpy, "spymaster");
    setTeam(r, bOp, "blue");
    const { gameId } = await startGame(rSpy, r);
    return { rSpy, rOp, bSpy, bOp, entry: getGame(gameId)! };
  }

  it("spymasters see the secret board; operatives never do", async () => {
    const { rSpy, rOp, entry } = await startedRoom();
    const spy = toPublicState(entry.state, authorizeGameView(entry, rSpy)!.spymasterView);
    const op = toPublicState(entry.state, authorizeGameView(entry, rOp)!.spymasterView);
    expect(spy.cards.filter((c) => c.assignment === "assassin")).toHaveLength(1);
    expect(spy.scores.red.total + spy.scores.blue.total).toBe(17);
    expect(op.cards.every((c) => c.assignment === undefined)).toBe(true);
  });

  it("wrong-team and spymaster guesses are rejected; correct guess updates score", async () => {
    const { rSpy, rOp, bSpy, bOp, entry } = await startedRoom();
    const current = entry.state.currentTeam;
    const spyOf = current === "red" ? rSpy : bSpy;
    const opOf = current === "red" ? rOp : bOp;
    const wrongOp = current === "red" ? bOp : rOp;
    const wrongSpy = current === "red" ? bSpy : rSpy;

    expect(() => authorizeClue(entry, wrongSpy)).toThrow(/turn/);
    expect(() => authorizeGuess(entry, wrongOp)).toThrow(/turn/);
    expect(() => authorizeGuess(entry, spyOf)).toThrow(/Spymasters give clues/);
    authorizeClue(entry, spyOf); // legal

    // play: clue -> friendly guess -> score visible in public state
    const version = entry.version;
    const withClue = giveClue(entry.state, "SIGNAL", 2, "human");
    expect(commitGame(entry, withClue, version)).toBe(true);
    authorizeGuess(entry, opOf);
    const friendly = entry.state.cards.find((c) => c.assignment === current)!;
    const out = applyGuess(entry.state, friendly.id);
    expect(commitGame(entry, out.state, entry.version)).toBe(true);
    const pub = toPublicState(entry.state, false);
    expect(pub.scores[current].found).toBe(1);
    expect(pub.cards.find((c) => c.id === friendly.id)?.assignment).toBe(current);
  });

  it("concurrent guesses cannot corrupt state (version check)", async () => {
    const { entry } = await startedRoom();
    const withClue = giveClue(entry.state, "SIGNAL", 3, "human");
    commitGame(entry, withClue, entry.version);
    const v = entry.version;
    const unrevealed = entry.state.cards.filter((c) => !c.revealed);
    const guessA = applyGuess(entry.state, unrevealed[0].id).state;
    const guessB = applyGuess(entry.state, unrevealed[1].id).state;
    expect(commitGame(entry, guessA, v)).toBe(true); // first browser wins
    expect(commitGame(entry, guessB, v)).toBe(false); // second gets 409 at the API layer
    expect(entry.state.cards.filter((c) => c.revealed)).toHaveLength(1);
  });

  it("assassin pick in a room ends the game for everyone", async () => {
    const { entry } = await startedRoom();
    commitGame(entry, giveClue(entry.state, "SIGNAL", 2, "human"), entry.version);
    const assassin = entry.state.cards.find((c) => c.assignment === "assassin")!;
    const guessing = entry.state.currentTeam;
    commitGame(entry, applyGuess(entry.state, assassin.id).state, entry.version);
    const pub = toPublicState(entry.state, false);
    expect(pub.status).toBe("finished");
    expect(pub.winner).not.toBe(guessing);
    // post-game review: full board becomes public
    expect(pub.cards.every((c) => c.assignment)).toBe(true);
  });

  it("reconnection restores identical state (rejoin + refetch)", async () => {
    const { rOp, entry } = await startedRoom();
    commitGame(entry, giveClue(entry.state, "SIGNAL", 2, "human"), entry.version);
    // friendly card: turn (and clue) survive the guess
    const card = entry.state.cards.find((c) => c.assignment === entry.state.currentTeam)!;
    commitGame(entry, applyGuess(entry.state, card.id).state, entry.version);

    // simulate a dropped tab: same identity re-joins and refetches
    const room = getRoom(entry.state.roomId!)!;
    const rejoined = await joinRoom(rOp, room.code);
    expect(rejoined.gameId).toBe(entry.state.id);
    const view = toPublicState(entry.state, authorizeGameView(entry, rOp)!.spymasterView);
    expect(view.cards.find((c) => c.id === card.id)?.revealed).toBe(true);
    expect(view.currentClue?.clue).toBe("SIGNAL");
  });
});
