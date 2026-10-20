import { generateAiClue, generateAiGuess } from "@/lib/ai/services";
import { applyGuess, endTurn, giveClue, normalizeWord } from "@/lib/game-engine/game-rules";
import { toPublicState } from "@/lib/game-engine/turn-manager";
import { commitGame, isSpymaster } from "@/lib/store/game-store";
import { afterGameMutation } from "@/lib/multiplayer/service";
import { handleErrorWithHttp, HttpError, loadGameOr404, spymasterToken } from "@/lib/api-helpers";

/**
 * POST /api/games/:id/ai-turn — plays a COMPLETE AI turn:
 * AI spymaster gives a clue, then the AI operative guesses until it should
 * stop (wrong card, pass, or guesses exhausted). Used by Human-vs-AI mode.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const entry = loadGameOr404(decodeURIComponent(id));
    const team = isSpymaster(entry, spymasterToken(req));
    const startVersion = entry.version;
    const log: string[] = [];
    let state = entry.state;

    if (state.status !== "playing") throw new HttpError(422, "Game is already finished.");

    if (state.phase === "awaiting-clue") {
      const aiClue = await generateAiClue(state);
      state = giveClue(state, aiClue.clue, aiClue.number, "ai");
      log.push(`AI spymaster (${state.currentTeam}): "${aiClue.clue}" × ${aiClue.number}`);
    }

    // Guess loop — bounded by the clue's max guesses inside the engine.
    while (state.status === "playing" && state.phase === "guessing") {
      const guess = await generateAiGuess(state);
      if (!guess.selectedWord || guess.confidence < 0.35) {
        log.push(`AI operative passes (confidence ${guess.confidence.toFixed(2)}).`);
        state = endTurn(state);
        break;
      }
      const card = state.cards.find(
        (c) => !c.revealed && normalizeWord(c.word) === normalizeWord(guess.selectedWord!)
      );
      if (!card) {
        log.push("AI operative picked an illegal card — turn ended.");
        state = endTurn(state);
        break;
      }
      const outcome = applyGuess(state, card.id);
      state = outcome.state;
      log.push(`AI guessed ${outcome.word} → ${outcome.result} (confidence ${guess.confidence.toFixed(2)}).`);
    }

    if (!commitGame(entry, state, startVersion)) throw new HttpError(409, "Game changed — refresh.");
    afterGameMutation(entry);
    return Response.json({ game: toPublicState(state, Boolean(team)), log, version: entry.version });
  } catch (err) {
    return handleErrorWithHttp(err);
  }
}
