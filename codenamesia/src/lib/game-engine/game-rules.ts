import { randomUUID } from "crypto";
import type { GameState } from "./types";
import { otherTeam } from "./types";
import { assassinLoser, checkWinner } from "./win-condition";

export class GameRuleError extends Error {
  status = 422;
  constructor(message: string) {
    super(message);
    this.name = "GameRuleError";
  }
}

export function maxGuessesForClue(clueNumber: number): number {
  // Codenames rule: operatives may guess clue number + 1 cards.
  return clueNumber + 1;
}

/** Normalize for clue legality checks (case/diacritic-insensitive). */
export function normalizeWord(word: string): string {
  return word
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Very small stemmer: strips common EN/FR suffixes to catch morphological variants. */
export function stem(word: string): string {
  return normalizeWord(word).replace(/(ing|edly|edly|ness|ment|tion|sion|ies|es|s|aux|eaux)$/u, "");
}

export function validateClue(state: GameState, clue: string, number: number): void {
  const clean = clue.trim();
  if (!clean) throw new GameRuleError("Clue cannot be empty.");
  if (/\s/.test(clean)) throw new GameRuleError("A clue must be a single word (no spaces).");
  if (!Number.isInteger(number) || number < 0 || number > 9)
    throw new GameRuleError("Clue number must be an integer between 0 and 9.");

  const clueNorm = normalizeWord(clean);
  const clueStem = stem(clean);
  for (const card of state.cards) {
    if (card.revealed) continue;
    const boardNorm = normalizeWord(card.word);
    if (boardNorm === clueNorm)
      throw new GameRuleError(`"${clean}" matches an unrevealed board word and is not a legal clue.`);
    if (clueStem.length >= 3 && stem(card.word) === clueStem)
      throw new GameRuleError(`"${clean}" is a variant of the board word "${card.word}" and is not legal.`);
    // Reject clues contained in multi-token board words and vice-versa.
    if (boardNorm.includes(clueNorm) || clueNorm.includes(boardNorm))
      throw new GameRuleError(`"${clean}" is too close to the board word "${card.word}".`);
  }
}

export function giveClue(state: GameState, clue: string, number: number, givenBy: "human" | "ai"): GameState {
  if (state.status !== "playing") throw new GameRuleError("The game is not in progress.");
  if (state.phase !== "awaiting-clue") throw new GameRuleError("It is not time to give a clue.");
  validateClue(state, clue, number);

  const newClue = {
    id: randomUUID(),
    team: state.currentTeam,
    clue: clue.trim(),
    number,
    createdAt: new Date().toISOString(),
    givenBy,
  };
  return {
    ...state,
    phase: "guessing",
    currentClue: newClue,
    clues: [...state.clues, newClue],
    guessesUsedThisTurn: 0,
    actions: [
      ...state.actions,
      {
        id: randomUUID(),
        type: "clue" as const,
        team: state.currentTeam,
        message: `${state.currentTeam === "red" ? "Red" : "Blue"} spymaster: "${clue.trim()}" × ${number}`,
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

export interface GuessOutcome {
  state: GameState;
  result: "correct" | "opponent" | "neutral" | "assassin";
  word: string;
}

export function applyGuess(state: GameState, cardId: string): GuessOutcome {
  if (state.status !== "playing") throw new GameRuleError("The game is not in progress.");
  if (state.phase !== "guessing" || !state.currentClue)
    throw new GameRuleError("No clue has been given yet — the spymaster must give a clue first.");

  const card = state.cards.find((c) => c.id === cardId);
  if (!card) throw new GameRuleError("Card not found.");
  if (card.revealed) throw new GameRuleError(`"${card.word}" has already been revealed.`);

  const guessingTeam = state.currentTeam;
  const cards = state.cards.map((c) => (c.id === cardId ? { ...c, revealed: true } : c));
  let next: GameState = { ...state, cards, guessesUsedThisTurn: state.guessesUsedThisTurn + 1 };

  const finish = (s: GameState, winner: GameState["winner"], reason: GameState["winReason"]): GameState => ({
    ...s,
    status: "finished",
    phase: "finished",
    winner,
    winReason: reason,
    actions: [
      ...s.actions,
      {
        id: randomUUID(),
        type: "game-finished" as const,
        team: winner ?? undefined,
        message:
          reason === "assassin"
            ? `${guessingTeam} hit the assassin (${card.word}). ${winner} wins!`
            : `${winner} found all their words and wins!`,
        createdAt: new Date().toISOString(),
      },
    ],
  });

  // 1) Assassin = immediate loss for the guessing team.
  if (card.assignment === "assassin") {
    next = finish(next, assassinLoser(guessingTeam), "assassin");
    return { state: next, result: "assassin", word: card.word };
  }

  // 2) Completion check (covers "opponent guessed our last word → we win").
  const winner = checkWinner(next);
  if (winner) {
    next = finish(next, winner, "all-words-found");
    const result = card.assignment === guessingTeam ? "correct" : card.assignment === "neutral" ? "neutral" : "opponent";
    return { state: next, result, word: card.word };
  }

  // 3) Correct guess → may continue until guesses exhausted.
  if (card.assignment === guessingTeam) {
    const max = maxGuessesForClue(state.currentClue.number);
    if (next.guessesUsedThisTurn >= max) next = endTurnInternal(next);
    return { state: next, result: "correct", word: card.word };
  }

  // 4) Neutral or opponent word → turn ends.
  next = endTurnInternal(next);
  return { state: next, result: card.assignment === "neutral" ? "neutral" : "opponent", word: card.word };
}

export interface BatchGuessResult {
  cardId: string;
  result: GuessOutcome["result"];
  word: string;
}

export type BatchGuessStopReason =
  | "completed"
  | "wrong-card"
  | "assassin"
  | "finished"
  | "guesses-exhausted"
  | "invalid-card";

export interface BatchGuessOutcome {
  state: GameState;
  results: BatchGuessResult[];
  stoppedReason: BatchGuessStopReason;
}

/**
 * Multi-select confirm: reveals the operative's queued cards IN ORDER and
 * stops at the first card that ends the turn (neutral / opponent / assassin),
 * when the game finishes, or when the clue's guess budget is exhausted.
 * Cards after the stopping point are never revealed.
 */
export function applyGuesses(state: GameState, cardIds: string[]): BatchGuessOutcome {
  const queue = [...new Set(cardIds.filter(Boolean))];
  if (!queue.length) throw new GameRuleError("Select at least one card to reveal.");

  const initialTeam = state.currentTeam;
  let current = state;
  const results: BatchGuessResult[] = [];

  for (const cardId of queue) {
    let outcome: GuessOutcome;
    try {
      outcome = applyGuess(current, cardId);
    } catch (err) {
      // First card invalid -> behave exactly like a single guess (throw).
      // Later card invalid (e.g. just revealed by a teammate) -> keep the
      // valid reveals already made and report why we stopped.
      if (!results.length) throw err;
      return { state: current, results, stoppedReason: "invalid-card" };
    }

    results.push({ cardId, result: outcome.result, word: outcome.word });
    current = outcome.state;

    if (outcome.result === "assassin") return { state: current, results, stoppedReason: "assassin" };
    if (current.status !== "playing") return { state: current, results, stoppedReason: "finished" };
    if (outcome.result !== "correct") return { state: current, results, stoppedReason: "wrong-card" };
    if (current.phase !== "guessing" || current.currentTeam !== initialTeam) {
      return { state: current, results, stoppedReason: "guesses-exhausted" };
    }
  }

  return { state: current, results, stoppedReason: "completed" };
}

function endTurnInternal(state: GameState): GameState {
  return {
    ...state,
    currentTeam: otherTeam(state.currentTeam),
    phase: "awaiting-clue",
    currentClue: null,
    guessesUsedThisTurn: 0,
  };
}

export function endTurn(state: GameState): GameState {
  if (state.status !== "playing") throw new GameRuleError("The game is not in progress.");
  if (state.phase !== "guessing") throw new GameRuleError("You can only end the turn while guessing.");
  const next = endTurnInternal(state);
  return {
    ...next,
    actions: [
      ...state.actions,
      {
        id: randomUUID(),
        type: "end-turn" as const,
        team: state.currentTeam,
        message: `${state.currentTeam === "red" ? "Red" : "Blue"} ended their turn voluntarily.`,
        createdAt: new Date().toISOString(),
      },
    ],
  };
}
