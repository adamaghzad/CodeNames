import type { GameState, Team } from "./types";
import { otherTeam } from "./types";

export function countFound(state: GameState, team: Team): number {
  return state.cards.filter((c) => c.assignment === team && c.revealed).length;
}

export function countTotal(state: GameState, team: Team): number {
  return state.cards.filter((c) => c.assignment === team).length;
}

/**
 * Returns the winning team if the game is decided by card completion.
 * Note: a team can win because the OPPONENT guessed their last word —
 * this is handled naturally here since we check both teams after every reveal.
 */
export function checkWinner(state: GameState): Team | null {
  for (const team of ["red", "blue"] as Team[]) {
    if (countFound(state, team) === countTotal(state, team)) return team;
  }
  return null;
}

export function assassinLoser(guessingTeam: Team): Team {
  return otherTeam(guessingTeam);
}
