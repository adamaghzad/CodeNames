import type { GameState, PublicCard, PublicGameState } from "./types";
import { countFound, countTotal } from "./win-condition";
import { maxGuessesForClue } from "./game-rules";

/**
 * SECRET ISOLATION — the single most important security function in the app.
 *
 * - Operative view: unrevealed cards have NO assignment field at all.
 * - Spymaster view: only returned when the caller proved the spymaster token.
 * - Finished games: everything is public (post-game review).
 */
export function toPublicState(state: GameState, isSpymasterView: boolean): PublicGameState {
  const revealAll = isSpymasterView || state.status === "finished";
  const cards: PublicCard[] = state.cards.map((c) => ({
    id: c.id,
    word: c.word,
    category: c.category,
    position: c.position,
    revealed: c.revealed,
    ...(revealAll || c.revealed ? { assignment: c.assignment } : {}),
  }));
  return {
    ...state,
    cards,
    scores: {
      red: { found: countFound(state, "red"), total: countTotal(state, "red") },
      blue: { found: countFound(state, "blue"), total: countTotal(state, "blue") },
    },
    maxGuesses: state.currentClue ? maxGuessesForClue(state.currentClue.number) : 0,
    isSpymasterView,
  };
}

export function remainingWords(state: GameState, team: "red" | "blue"): string[] {
  return state.cards.filter((c) => c.assignment === team && !c.revealed).map((c) => c.word);
}
