import { generateAiClue } from "@/lib/ai/services";
import { rateLimit } from "@/lib/ai/groq";
import { giveClue } from "@/lib/game-engine/game-rules";
import { toPublicState } from "@/lib/game-engine/turn-manager";
import { commitGame } from "@/lib/store/game-store";
import { afterGameMutation, authorizeAiClue } from "@/lib/multiplayer/service";
import { getActor } from "@/lib/multiplayer/identity";
import { clientIp, handleErrorWithHttp, HttpError, loadGameOr404 } from "@/lib/api-helpers";

/**
 * POST /api/games/:id/ai-clue — AI spymaster move for room games (spec §9).
 * The secret board is read server-side only; the clue passes through the
 * exact same engine validation as a human clue. Concurrent requests from
 * several teammates collapse via the version check (first one wins).
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    if (!rateLimit(`ai-clue:${clientIp(req)}`, 30)) {
      return Response.json({ error: "Too many AI requests. Please wait a minute." }, { status: 429 });
    }
    const { id } = await ctx.params;
    const entry = loadGameOr404(decodeURIComponent(id));
    const actor = await getActor(req);
    const access = authorizeAiClue(entry, actor);
    if (!access) throw new HttpError(400, "AI clues here require a multiplayer room with an AI spymaster enabled.");

    const version = entry.version;
    const aiClue = await generateAiClue(entry.state);
    const next = giveClue(entry.state, aiClue.clue, aiClue.number, "ai");
    if (!commitGame(entry, next, version)) {
      // A teammate's AI clue landed first — return the current truth.
      return Response.json({ game: toPublicState(entry.state, access.spymasterView), version: entry.version, deduped: true });
    }
    afterGameMutation(entry);
    return Response.json({
      clue: aiClue.clue,
      number: aiClue.number,
      game: toPublicState(next, access.spymasterView),
      version: entry.version,
    });
  } catch (err) {
    return handleErrorWithHttp(err);
  }
}
