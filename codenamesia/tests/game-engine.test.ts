import { describe, expect, it } from "vitest";
import { buildAssignments, createBoard, createGameState, secureShuffle } from "@/lib/game-engine/create-board";
import { applyGuess, applyGuesses, endTurn, GameRuleError, giveClue, validateClue } from "@/lib/game-engine/game-rules";
import { toPublicState } from "@/lib/game-engine/turn-manager";
import { __resetGames, getVisibleTouches, saveNewGame, setPlayerSelection } from "@/lib/store/game-store";
import { validateBoardWords } from "@/lib/ai/validation";
import { otherTeam, type GameState, type GeneratedWord } from "@/lib/game-engine/types";

const WORDS: GeneratedWord[] = Array.from({ length: 25 }, (_, i) => ({
  word: `WORD${i + 1}`,
  category: i % 2 ? "AI" : "Data",
}));

function newGame(): GameState {
  return createGameState({
    words: WORDS,
    categories: ["AI", "Data"],
    difficulty: "medium",
    language: "en",
    mode: "human-vs-human",
    roomCode: "TEST01",
  });
}

describe("board creation", () => {
  it("assigns exactly 9/8/7/1 with the starting team getting 9", () => {
    for (const start of ["red", "blue"] as const) {
      const a = buildAssignments(start);
      expect(a).toHaveLength(25);
      expect(a.filter((x) => x === start)).toHaveLength(9);
      expect(a.filter((x) => x === (start === "red" ? "blue" : "red"))).toHaveLength(8);
      expect(a.filter((x) => x === "neutral")).toHaveLength(7);
      expect(a.filter((x) => x === "assassin")).toHaveLength(1);
    }
  });

  it("requires exactly 25 words", () => {
    expect(() => createBoard(WORDS.slice(0, 24))).toThrow(/exactly 25/);
  });

  it("shuffles (order differs from input with overwhelming probability)", () => {
    const input = Array.from({ length: 25 }, (_, i) => i);
    const sameCount = [0, 1, 2, 3, 4].filter((n) =>
      secureShuffle(input).every((v, i) => v === i) ? n >= 0 : false
    ).length;
    expect(sameCount).toBe(0);
  });
});

describe("AI word validation", () => {
  it("accepts 25 clean unique words and uppercases them", () => {
    const raw = { words: WORDS.map((w) => ({ word: w.word.toLowerCase(), category: w.category })) };
    const out = validateBoardWords(raw, ["AI", "Data"]);
    expect(out).toHaveLength(25);
    expect(out.every((w) => w.word === w.word.toUpperCase())).toBe(true);
  });

  it("rejects duplicates / near-duplicates instead of shipping a short board", () => {
    const words = WORDS.map((w) => ({ ...w }));
    words[24] = { word: words[0].word, category: "AI" };
    expect(() => validateBoardWords({ words }, ["AI"])).toThrow(/exactly 25/);
  });
});

describe("clue legality", () => {
  it("rejects multi-word clues and board-word matches", () => {
    const g = newGame();
    expect(() => validateClue(g, "two words", 2)).toThrow(GameRuleError);
    expect(() => validateClue(g, g.cards[0].word, 1)).toThrow(GameRuleError);
    expect(() => validateClue(g, "SIGNAL", 2)).not.toThrow();
  });

  it("rejects clues outside the clue phase", () => {
    const g = giveClue(newGame(), "SIGNAL", 2, "human");
    expect(() => giveClue(g, "OTHER", 1, "human")).toThrow(/not time to give a clue/);
  });
});

describe("turn flow", () => {
  it("correct guess continues, neutral ends the turn, max guesses = number + 1", () => {
    let g = giveClue(newGame(), "SIGNAL", 1, "human"); // max 2 guesses
    const team = g.currentTeam;
    const friendly = g.cards.filter((c) => c.assignment === team);
    let out = applyGuess(g, friendly[0].id);
    expect(out.result).toBe("correct");
    expect(out.state.phase).toBe("guessing");
    out = applyGuess(out.state, friendly[1].id);
    expect(out.state.currentTeam).not.toBe(team); // guesses exhausted -> turn passed
    expect(out.state.phase).toBe("awaiting-clue");

    g = giveClue(newGame(), "SIGNAL", 3, "human");
    const neutral = g.cards.find((c) => c.assignment === "neutral")!;
    out = applyGuess(g, neutral.id);
    expect(out.result).toBe("neutral");
    expect(out.state.phase).toBe("awaiting-clue");
    expect(out.state.currentTeam).not.toBe(g.currentTeam);
  });

  it("rejects guesses before a clue and on revealed cards", () => {
    const g0 = newGame();
    expect(() => applyGuess(g0, g0.cards[0].id)).toThrow(/spymaster must give a clue/);
    const g = giveClue(g0, "SIGNAL", 3, "human");
    const card = g.cards.find((c) => c.assignment === g.currentTeam)!;
    const out = applyGuess(g, card.id);
    expect(() => applyGuess(out.state, card.id)).toThrow(/already been revealed/);
  });

  it("assassin ends the game immediately with the other team winning", () => {
    const g = giveClue(newGame(), "SIGNAL", 2, "human");
    const assassin = g.cards.find((c) => c.assignment === "assassin")!;
    const out = applyGuess(g, assassin.id);
    expect(out.result).toBe("assassin");
    expect(out.state.status).toBe("finished");
    expect(out.state.winner).not.toBe(g.currentTeam);
    expect(out.state.winReason).toBe("assassin");
  });

  it("multi-select confirm reveals in order and stops at the first turn-ending card", () => {
    const g = giveClue(newGame(), "SIGNAL", 3, "human"); // max 4 guesses
    const team = g.currentTeam;
    const friendly = g.cards.filter((c) => c.assignment === team);
    const neutral = g.cards.find((c) => c.assignment === "neutral")!;

    const out = applyGuesses(g, [friendly[0].id, neutral.id, friendly[1].id]);
    expect(out.results.map((r) => r.result)).toEqual(["correct", "neutral"]);
    expect(out.stoppedReason).toBe("wrong-card");
    expect(out.state.cards.find((c) => c.id === friendly[0].id)?.revealed).toBe(true);
    expect(out.state.cards.find((c) => c.id === neutral.id)?.revealed).toBe(true);
    // The card queued AFTER the turn-ending neutral must stay hidden.
    expect(out.state.cards.find((c) => c.id === friendly[1].id)?.revealed).toBe(false);
    expect(out.state.currentTeam).not.toBe(team);

    // Queue longer than the guess budget: stop when guesses run out.
    const g2 = giveClue(newGame(), "SIGNAL", 1, "human"); // max 2 guesses
    const friendly2 = g2.cards.filter((c) => c.assignment === g2.currentTeam);
    const out2 = applyGuesses(g2, [friendly2[0].id, friendly2[1].id, friendly2[2].id]);
    expect(out2.results).toHaveLength(2);
    expect(out2.stoppedReason).toBe("guesses-exhausted");
    expect(out2.state.cards.find((c) => c.id === friendly2[2].id)?.revealed).toBe(false);
  });

  it("revealing all friendly words wins; endTurn passes play", () => {
    let g = newGame();
    const team = g.currentTeam;
    // Reveal all-but-one friendly cards directly, then guess the last.
    g = { ...g, cards: g.cards.map((c, i) => (c.assignment === team && i !== g.cards.findIndex((x) => x.assignment === team) ? { ...c, revealed: true } : c)) };
    // ensure exactly one unrevealed friendly remains:
    const remaining = g.cards.filter((c) => c.assignment === team && !c.revealed);
    g = giveClue(g, "SIGNAL", 9, "human");
    let state = g;
    for (const c of remaining) state = applyGuess(state, c.id).state;
    expect(state.status).toBe("finished");
    expect(state.winner).toBe(team);

    const g2 = giveClue(newGame(), "SIGNAL", 2, "human");
    expect(endTurn(g2).currentTeam).not.toBe(g2.currentTeam);
  });
});

describe("operative touches (pre-confirm selections)", () => {
  it("are visible in order to the guessing team (incl. spymaster) and hidden from opponents", () => {
    __resetGames();
    const g = giveClue(newGame(), "SIGNAL", 3, "human");
    const entry = saveNewGame(g);
    const team = g.currentTeam;

    setPlayerSelection(entry, {
      playerId: "op-1",
      displayName: "Nadia Operative",
      team,
      clueId: g.currentClue!.id,
      cardIds: [g.cards[2].id, g.cards[0].id],
      updatedAt: new Date().toISOString(),
    });

    const spyView = getVisibleTouches(entry, team, "spy-1");
    expect(spyView.map((t) => [t.cardId, t.order, t.isYou])).toEqual([
      [g.cards[2].id, 0, false],
      [g.cards[0].id, 1, false],
    ]);

    const ownView = getVisibleTouches(entry, team, "op-1");
    expect(ownView).toHaveLength(2);
    expect(ownView.every((t) => t.isYou)).toBe(true);

    // Opponents and spectators never see the other team's intent.
    expect(getVisibleTouches(entry, otherTeam(team), "enemy-1")).toEqual([]);
    expect(getVisibleTouches(entry, null, "spectator")).toEqual([]);
  });
});

describe("secret isolation (serializer)", () => {
  it("operative view contains NO assignment for unrevealed cards", () => {
    const pub = toPublicState(newGame(), false);
    expect(pub.cards).toHaveLength(25);
    for (const c of pub.cards) expect(c).not.toHaveProperty("assignment");
    expect(JSON.stringify(pub)).not.toContain("assassin");
  });

  it("spymaster view contains the full key card", () => {
    const spy = toPublicState(newGame(), true);
    expect(spy.cards.every((c) => c.assignment)).toBe(true);
    expect(spy.cards.filter((c) => c.assignment === "assassin")).toHaveLength(1);
  });

  it("revealed cards expose their assignment publicly", () => {
    const g = giveClue(newGame(), "SIGNAL", 2, "human");
    const card = g.cards[0];
    const out = applyGuess(g, card.id);
    const pub = toPublicState(out.state, false);
    expect(pub.cards.find((c) => c.id === card.id)?.assignment).toBe(card.assignment);
    expect(pub.scores.red.total + pub.scores.blue.total).toBe(17);
  });
});
