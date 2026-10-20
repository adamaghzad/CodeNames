import { z } from "zod";
import { generateAiGuess } from "@/lib/ai/services";
import { rateLimit } from "@/lib/ai/groq";
import { applyGuess, endTurn, normalizeWord } from "@/lib/game-engine/game-rules";
import { toPublicState } from "@/lib/game-engine/turn-manager";
import { commitGame, isSpymaster } from "@/lib/store/game-store";
import { afterGameMutation } from "@/lib/multiplayer/service";
import { parseBody } from "@/lib/validation/schemas";
import { clientIp, handleErrorWithHttp, HttpError, loadGameOr404, spymasterToken } from "@/lib/api-helpers";

const schema = z.object({ gameId: z.string().min(1), apply: z.boolean().default(true) });

/**
 * POST /api/ai/guess — AI operative (spec §12).
 * The model only ever sees public information; the server verifies legality
 * and applies the guess authoritatively. Low-confidence/pass ends the turn.
 */
export async function POST(req: Request) {
  try {
    if (!rateLimit(`ai-guess:${clientIp(req)}`, 60)) {
      return Response.json({ error: "Too many AI requests. Please wait a minute." }, { status: 429 });
    }
    const { gameId, apply } = parseBody(schema, await req.json());
    const entry = loadGameOr404(gameId);
    const team = isSpymaster(entry, spymasterToken(req));

    const guess = await generateAiGuess(entry.state);
    let state = entry.state;
    let result: string | undefined;

    if (apply) {
      const version = entry.version;
      if (!guess.selectedWord || guess.confidence < 0.35) {
        state = endTurn(entry.state);
        result = "pass";
      } else {
        const card = entry.state.cards.find(
          (c) => !c.revealed && normalizeWord(c.word) === normalizeWord(guess.selectedWord!)
        );
        if (!card) throw new HttpError(422, "AI selected an illegal card.");
        const outcome = applyGuess(entry.state, card.id);
        state = outcome.state;
        result = outcome.result;
      }
      if (!commitGame(entry, state, version)) throw new HttpError(409, "Game changed — refresh and retry.");
      afterGameMutation(entry);
    }

    return Response.json({
      selectedWord: guess.selectedWord,
      confidence: guess.confidence,
      reasoning: guess.reasoning,
      demoMode: guess.demoMode,
      result,
      game: toPublicState(state, Boolean(team)),
      version: entry.version,
    });
  } catch (err) {
    return handleErrorWithHttp(err);
  }
}
