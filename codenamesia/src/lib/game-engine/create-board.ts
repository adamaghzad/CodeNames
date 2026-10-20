import { randomInt, randomUUID } from "crypto";
import type { Assignment, Card, GameState, GeneratedWord, Team } from "./types";

/** Fisher–Yates shuffle using a cryptographically secure RNG. */
export function secureShuffle<T>(input: readonly T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function randomStartingTeam(): Team {
  return randomInt(0, 2) === 0 ? "red" : "blue";
}

/**
 * Builds the secret key card: 9 starting-team, 8 other-team, 7 neutral, 1 assassin.
 * The AI NEVER decides assignments — this server-side function does.
 */
export function buildAssignments(startingTeam: Team): Assignment[] {
  const other: Team = startingTeam === "red" ? "blue" : "red";
  const assignments: Assignment[] = [
    ...Array<Assignment>(9).fill(startingTeam),
    ...Array<Assignment>(8).fill(other),
    ...Array<Assignment>(7).fill("neutral"),
    "assassin",
  ];
  return secureShuffle(assignments);
}

export function createBoard(words: GeneratedWord[], startingTeam = randomStartingTeam()): Card[] {
  if (words.length !== 25) {
    throw new Error(`A CodenamesIA board requires exactly 25 words, received ${words.length}.`);
  }
  const shuffledWords = secureShuffle(words);
  const assignments = buildAssignments(startingTeam);
  return shuffledWords.map((w, i) => ({
    id: randomUUID(),
    word: w.word,
    category: w.category,
    position: i,
    assignment: assignments[i],
    revealed: false,
  }));
}

export function createGameState(params: {
  words: GeneratedWord[];
  categories: string[];
  difficulty: GameState["difficulty"];
  language: GameState["language"];
  mode: GameState["mode"];
  roomCode: string;
  roomId?: string;
  demoMode?: boolean;
}): GameState {
  const startingTeam = randomStartingTeam();
  return {
    id: randomUUID(),
    roomCode: params.roomCode,
    roomId: params.roomId,
    categories: params.categories,
    difficulty: params.difficulty,
    language: params.language,
    mode: params.mode,
    status: "playing",
    startingTeam,
    currentTeam: startingTeam,
    phase: "awaiting-clue",
    cards: createBoard(params.words, startingTeam),
    clues: [],
    actions: [
      {
        id: randomUUID(),
        type: "game-created",
        message: `Game created. ${startingTeam === "red" ? "Red" : "Blue"} starts (9 words).`,
        createdAt: new Date().toISOString(),
      },
    ],
    currentClue: null,
    guessesUsedThisTurn: 0,
    winner: null,
    winReason: null,
    createdAt: new Date().toISOString(),
    demoMode: params.demoMode ?? false,
  };
}

export function generateRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[randomInt(0, alphabet.length)]).join("");
}
