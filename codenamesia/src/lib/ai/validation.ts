import { z } from "zod";
import { normalizeWord, stem } from "@/lib/game-engine/game-rules";
import type { GeneratedWord } from "@/lib/game-engine/types";

export const generatedWordsSchema = z.object({
  words: z.array(
    z.object({
      word: z.string().min(1).max(40),
      category: z.string().min(1).max(80),
    })
  ),
});

const BLOCKED = ["", "null", "undefined", "word", "example"];

/**
 * Cleans raw AI output into usable, unique words: uppercases, drops empties,
 * >2-token entries, exact duplicates and near-duplicates (shared stem).
 * Does NOT enforce a count — see validateBoardWords / trimTo25.
 */
export function cleanBoardWords(raw: unknown, requestedCategories: string[]): GeneratedWord[] {
  const parsed = generatedWordsSchema.parse(raw);

  const seen = new Map<string, string>(); // normalized -> original
  const stems = new Map<string, string>();
  const cleaned: GeneratedWord[] = [];

  for (const entry of parsed.words) {
    const word = entry.word.trim().toUpperCase().replace(/\s+/g, " ");
    if (!word || BLOCKED.includes(word.toLowerCase())) continue;
    if (word.split(" ").length > 2) continue; // prefer 1 word, allow max 2

    const norm = normalizeWord(word);
    if (seen.has(norm)) continue; // exact duplicate
    const s = stem(word);
    if (s.length >= 4 && stems.has(s)) continue; // near-duplicate (COMPUTER/COMPUTERS)

    seen.set(norm, word);
    stems.set(s, word);
    // Keep the model's category label if it (roughly) matches a requested one,
    // otherwise attribute to the closest requested category.
    const category =
      requestedCategories.find((c) => normalizeWord(c) === normalizeWord(entry.category)) ??
      requestedCategories.find(
        (c) => normalizeWord(entry.category).includes(normalizeWord(c)) || normalizeWord(c).includes(normalizeWord(entry.category))
      ) ??
      entry.category;
    cleaned.push({ word, category });
  }

  return cleaned;
}

/**
 * Strict board validation: exactly 25 usable unique entries.
 * Throws with a helpful message (spec §4) so callers can retry/top-up or ask
 * the user for clearer categories instead of shipping a bad board.
 */
export function validateBoardWords(raw: unknown, requestedCategories: string[]): GeneratedWord[] {
  const cleaned = cleanBoardWords(raw, requestedCategories);
  if (cleaned.length !== 25) {
    throw new Error(
      `AI produced ${cleaned.length} valid unique words; exactly 25 are required. Try clearer or broader categories.`
    );
  }
  return cleaned;
}

/**
 * Trims an over-long word list to exactly 25, removing extras from the
 * categories that are most above their fair share (by weight, else even),
 * so the requested category balance survives.
 */
export function trimTo25(
  words: GeneratedWord[],
  categories: { name: string; weight?: number }[]
): GeneratedWord[] {
  const result = [...words];
  if (result.length <= 25) return result;
  const totalWeight = categories.reduce((s, c) => s + (c.weight ?? 0), 0);
  const target = new Map(
    categories.map((c) => [
      c.name,
      totalWeight > 0 && c.weight ? (c.weight / totalWeight) * 25 : 25 / Math.max(1, categories.length),
    ])
  );
  while (result.length > 25) {
    const counts = new Map<string, number>();
    for (const w of result) counts.set(w.category, (counts.get(w.category) ?? 0) + 1);
    let worstCat: string | null = null;
    let worstExcess = -Infinity;
    for (const [cat, n] of counts) {
      const excess = n - (target.get(cat) ?? 0);
      if (excess > worstExcess) {
        worstExcess = excess;
        worstCat = cat;
      }
    }
    const idx = result.map((w) => w.category).lastIndexOf(worstCat!);
    result.splice(idx >= 0 ? idx : result.length - 1, 1);
  }
  return result;
}

export const clueResponseSchema = z.object({
  clue: z.string().min(1).max(40),
  number: z.number().int().min(1).max(9),
  targetWords: z.array(z.string()).min(1),
  riskLevel: z.enum(["low", "medium", "high"]).default("medium"),
  explanation: z.string().max(300).default(""),
});

export const guessResponseSchema = z.object({
  selectedWord: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(300).default(""),
});
