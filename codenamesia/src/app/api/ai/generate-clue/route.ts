import { z } from "zod";
import { generateAiClue } from "@/lib/ai/services";
import { rateLimit } from "@/lib/ai/groq";
import { giveClue } from "@/lib/game-engine/game-rules";
import { toPublicState } from "@/lib/game-engine/turn-manager";
import { commitGame, isSpymaster } from "@/lib/store/game-store";
import { afterGameMutation } from "@/lib/multiplayer/service";
import { parseBody } from "@/lib/validation/schemas";
import { clientIp, handleErrorWithHttp, HttpError, loadGameOr404, spymasterToken } from "@/lib/api-helpers";

const schema = z.object({ gameId: z.string().min(1), apply: z.boolean().default(true) });

/**
 * POST /api/ai/generate-clue — AI spymaster (spec §11).
 * The secret board is read server-side only. targetWords/explanation are
 * returned ONLY to a caller holding a spymaster token (training modes);
 * operatives receive just the applied public clue.
 */
export async function POST(req: Request) {
  try {
    if (!rateLimit(`ai-clue:${clientIp(req)}`, 30)) {
      return Response.json({ error: "Too many AI requests. Please wait a minute." }, { status: 429 });
    }
    const { gameId, apply } = parseBody(schema, await req.json());
    const entry = loadGameOr404(gameId);
    const team = isSpymaster(entry, spymasterToken(req));
    const aiModes = ["ai-spymaster", "solo", "human-vs-ai"];
    if (!team && !aiModes.includes(entry.state.mode)) {
      throw new HttpError(403, "AI clues require a spymaster token or an AI game mode.");
    }

    const aiClue = await generateAiClue(entry.state);
    let state = entry.state;
    if (apply) {
      const version = entry.version;
      state = giveClue(entry.state, aiClue.clue, aiClue.number, "ai");
      if (!commitGame(entry, state, version)) throw new HttpError(409, "Game changed — refresh and retry.");
      afterGameMutation(entry);
    }
    return Response.json({
      clue: aiClue.clue,
      number: aiClue.number,
      riskLevel: aiClue.riskLevel,
      demoMode: aiClue.demoMode,
      ...(team ? { targetWords: aiClue.targetWords, explanation: aiClue.explanation } : {}),
      game: toPublicState(state, Boolean(team)),
      version: entry.version,
    });
  } catch (err) {
    return handleErrorWithHttp(err);
  }
}
