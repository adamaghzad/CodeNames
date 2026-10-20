import { getGroqClient, groqChatJson, hasGroqKey, withRetries } from "./groq";
import { boardSystemPrompt, boardUserPrompt, clueSystemPrompt, guessSystemPrompt, LANGUAGE_NAMES } from "./prompts";
import { cleanBoardWords, clueResponseSchema, guessResponseSchema, trimTo25 } from "./validation";
import { fallbackGenerateWords } from "./fallback-words";
import { GameRuleError, normalizeWord, validateClue } from "@/lib/game-engine/game-rules";
import type { Difficulty, GameState, GeneratedWord, Language, Team } from "@/lib/game-engine/types";
import { otherTeam } from "@/lib/game-engine/types";

export interface CategoryInput {
  name: string;
  weight?: number;
}

export interface GenerateBoardResult {
  words: GeneratedWord[];
  demoMode: boolean;
  model: string;
}

/**
 * POST /api/ai/generate-board core (spec §6).
 *
 * Reliability strategy (gpt-oss-20b sometimes returns 24/26 items):
 *  1. Clean + dedupe whatever the model returned.
 *  2. ≥25 → balance-trim to exactly 25.
 *  3. 15–24 → one "top-up" call for the missing words (excluding existing),
 *     merge, re-clean, trim.
 *  4. <15 or hard failure → retry the whole generation (max 3 attempts),
 *     then surface a helpful error (never a silently broken board).
 */
export async function generateBoardWords(params: {
  categories: CategoryInput[];
  difficulty: Difficulty;
  language: Language;
}): Promise<GenerateBoardResult> {
  const names = params.categories.map((c) => c.name);
  if (!hasGroqKey) {
    return { words: fallbackGenerateWords(params.categories, params.language), demoMode: true, model: "demo-fallback (no GROQ_API_KEY)" };
  }
  // Touch client so a missing/invalid key fails fast with a clear message.
  getGroqClient();

  const ask = (count: number, exclude: string[], temperature: number) =>
    groqChatJson({
      system: boardSystemPrompt(),
      user: boardUserPrompt({ ...params, count, exclude }),
      temperature,
      maxTokens: 1800,
    });

  const words = await withRetries(
    async () => {
      let cleaned = cleanBoardWords(await ask(25, [], 0.8), names);

      if (cleaned.length >= 15 && cleaned.length < 25) {
        const need = 25 - cleaned.length;
        console.info(`[generate-board] topping up ${cleaned.length}/25 (+${need} requested with spare)`);
        const extraRaw = await ask(need + 4, cleaned.map((w) => w.word), 0.7);
        cleaned = cleanBoardWords({ words: [...cleaned, ...cleanBoardWords(extraRaw, names)] }, names);
      }

      if (cleaned.length < 25) {
        throw new Error(
          `AI produced ${cleaned.length} valid unique words; exactly 25 are required. Try clearer or broader categories.`
        );
      }
      return trimTo25(cleaned, params.categories);
    },
    3,
    "generate-board"
  );
  return { words, demoMode: false, model: process.env.GROQ_MODEL || "openai/gpt-oss-20b" };
}

export interface AiClue {
  clue: string;
  number: number;
  targetWords: string[];
  riskLevel: "low" | "medium" | "high";
  explanation: string;
  demoMode: boolean;
}

/** AI Spymaster (spec §11). Server-only: receives the SECRET board. */
export async function generateAiClue(state: GameState): Promise<AiClue> {
  const team = state.currentTeam;
  const friendly = state.cards.filter((c) => c.assignment === team && !c.revealed).map((c) => c.word);
  const enemy = state.cards.filter((c) => c.assignment === otherTeam(team) && !c.revealed).map((c) => c.word);
  const neutral = state.cards.filter((c) => c.assignment === "neutral" && !c.revealed).map((c) => c.word);
  const assassin = state.cards.find((c) => c.assignment === "assassin" && !c.revealed)?.word ?? "(revealed)";
  const revealed = state.cards.filter((c) => c.revealed).map((c) => `${c.word}=${c.assignment}`);

  if (!hasGroqKey) return { ...fallbackClue(state, friendly), demoMode: true };

  const clue = await withRetries(
    async () => {
      const raw = await groqChatJson({
        system: clueSystemPrompt(),
        user: `Language: ${LANGUAGE_NAMES[state.language]}. Difficulty: ${state.difficulty}.
Your team (${team}) unrevealed words: ${friendly.join(", ")}
Opponent unrevealed words (AVOID): ${enemy.join(", ")}
Neutral unrevealed words (AVOID): ${neutral.join(", ")}
ASSASSIN word (NEVER hint at this): ${assassin}
Already revealed: ${revealed.join(", ") || "none"}
Previous clues: ${state.clues.map((c) => `${c.team}:${c.clue}×${c.number}`).join("; ") || "none"}

Return the best clue as JSON.`,
        temperature: 0.6,
        maxTokens: 1100, // reasoning shares this budget — 600 truncated to empty content
      });
      const parsed = clueResponseSchema.parse(raw);
      // Hard validation: legal clue + targets must be friendly words.
      validateClue(state, parsed.clue, parsed.number);
      const targets = parsed.targetWords.filter((t) => friendly.some((f) => normalizeWord(f) === normalizeWord(t)));
      if (targets.length === 0) throw new Error("AI clue targets no friendly word.");
      return { ...parsed, number: Math.min(parsed.number, targets.length), targetWords: targets };
    },
    3,
    "generate-clue"
  );
  return { ...clue, demoMode: false };
}

/** Heuristic demo clue: group friendly words by shared category. */
function fallbackClue(state: GameState, friendly: string[]): Omit<AiClue, "demoMode"> {
  const friendlyCards = state.cards.filter((c) => c.assignment === state.currentTeam && !c.revealed);
  const byCategory = new Map<string, string[]>();
  for (const c of friendlyCards) byCategory.set(c.category, [...(byCategory.get(c.category) ?? []), c.word]);
  const best = [...byCategory.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  const targets = (best?.[1] ?? friendly).slice(0, 2);
  const candidates = ["LINK", "GROUP", "THEME", "FAMILY", "BRIDGE", "SIGNAL", "PATTERN", "COMMON"];
  for (const candidate of candidates) {
    try {
      validateClue(state, candidate, targets.length);
      return {
        clue: candidate,
        number: Math.max(1, targets.length),
        targetWords: targets,
        riskLevel: "medium",
        explanation: "Demo-mode heuristic clue (add GROQ_API_KEY for real AI clues).",
      };
    } catch {
      /* try next candidate */
    }
  }
  throw new GameRuleError("Could not generate a legal demo clue.");
}

export interface AiGuess {
  selectedWord: string | null;
  confidence: number;
  reasoning: string;
  demoMode: boolean;
}

/**
 * AI Operative (spec §12). Receives ONLY public information — this function
 * deliberately never reads `assignment` of unrevealed cards.
 */
export async function generateAiGuess(state: GameState): Promise<AiGuess> {
  if (!state.currentClue) throw new GameRuleError("No active clue to guess from.");
  const unrevealed = state.cards.filter((c) => !c.revealed).map((c) => c.word);
  const revealedPublic = state.cards
    .filter((c) => c.revealed)
    .map((c) => `${c.word} (${c.assignment})`);

  if (!hasGroqKey) return { ...fallbackGuess(state, unrevealed), demoMode: true };

  const guess = await withRetries(
    async () => {
      const raw = await groqChatJson({
        system: guessSystemPrompt(),
        user: `Language: ${LANGUAGE_NAMES[state.language]}.
Current clue: "${state.currentClue!.clue}" × ${state.currentClue!.number} (for the ${state.currentTeam} team).
Unrevealed board words: ${unrevealed.join(", ")}
Revealed so far: ${revealedPublic.join(", ") || "none"}
Guesses already used this turn: ${state.guessesUsedThisTurn}.

Return your single best guess as JSON, or selectedWord=null to pass.`,
        temperature: 0.4,
        maxTokens: 900,
      });
      const parsed = guessResponseSchema.parse(raw);
      if (parsed.selectedWord) {
        const match = unrevealed.find((w) => normalizeWord(w) === normalizeWord(parsed.selectedWord!));
        if (!match) throw new Error(`AI guessed "${parsed.selectedWord}" which is not an unrevealed board word.`);
        return { ...parsed, selectedWord: match };
      }
      return parsed;
    },
    2,
    "ai-guess"
  );
  return { ...guess, demoMode: false };
}

/** Demo guesser: letter-overlap similarity with the clue, else first unrevealed. */
function fallbackGuess(state: GameState, unrevealed: string[]): Omit<AiGuess, "demoMode"> {
  const clue = normalizeWord(state.currentClue!.clue);
  const scored = unrevealed
    .map((w) => {
      const n = normalizeWord(w);
      const shared = [...new Set(n)].filter((ch) => clue.includes(ch)).length;
      const prefix = n.startsWith(clue.slice(0, 3)) ? 3 : 0;
      return { w, score: shared + prefix };
    })
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best || state.guessesUsedThisTurn > 0) {
    return { selectedWord: null, confidence: 0.2, reasoning: "Demo AI passes (add GROQ_API_KEY for real AI guesses)." };
  }
  return { selectedWord: best.w, confidence: 0.4, reasoning: "Demo-mode heuristic guess." };
}

export type { Team };
