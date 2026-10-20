export type Team = "red" | "blue";
export type Assignment = "red" | "blue" | "neutral" | "assassin";
export type Role = "spymaster" | "operative";
export type Difficulty = "easy" | "medium" | "hard";
export type Language = "en" | "fr" | "ar";
export type GameMode = "human-vs-human" | "human-vs-ai" | "ai-spymaster" | "solo";
export type GameStatus = "lobby" | "playing" | "finished";
export type TurnPhase = "awaiting-clue" | "guessing" | "finished";

export interface GeneratedWord {
  word: string;
  category: string;
}

export interface Card {
  id: string;
  word: string;
  category: string;
  position: number;
  assignment: Assignment;
  revealed: boolean;
}

/** Card as an operative is allowed to see it: assignment hidden until revealed. */
export interface PublicCard {
  id: string;
  word: string;
  category: string;
  position: number;
  revealed: boolean;
  assignment?: Assignment; // present ONLY if revealed, or in spymaster view
}

export interface Clue {
  id: string;
  team: Team;
  clue: string;
  number: number;
  createdAt: string;
  givenBy: "human" | "ai";
}

export interface GameAction {
  id: string;
  type: "clue" | "guess" | "end-turn" | "game-created" | "game-finished";
  team?: Team;
  cardId?: string;
  word?: string;
  result?: Assignment | "correct" | "wrong";
  message: string;
  createdAt: string;
}

export interface GameState {
  id: string;
  roomCode: string;
  /** Multiplayer room this game belongs to (undefined = quick/solo game). */
  roomId?: string;
  categories: string[];
  difficulty: Difficulty;
  language: Language;
  mode: GameMode;
  status: GameStatus;
  startingTeam: Team;
  currentTeam: Team;
  phase: TurnPhase;
  cards: Card[];
  clues: Clue[];
  actions: GameAction[];
  currentClue: Clue | null;
  guessesUsedThisTurn: number;
  winner: Team | null;
  winReason: "all-words-found" | "assassin" | null;
  createdAt: string;
  demoMode: boolean;
}

export interface PublicGameState extends Omit<GameState, "cards"> {
  cards: PublicCard[];
  scores: { red: { found: number; total: number }; blue: { found: number; total: number } };
  maxGuesses: number;
  isSpymasterView: boolean;
}

export function otherTeam(team: Team): Team {
  return team === "red" ? "blue" : "red";
}

export function teamTotal(state: Pick<GameState, "startingTeam">, team: Team): number {
  return team === state.startingTeam ? 9 : 8;
}
