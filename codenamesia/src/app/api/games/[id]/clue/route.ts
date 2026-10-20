import { giveClue } from "@/lib/game-engine/game-rules";
import { toPublicState } from "@/lib/game-engine/turn-manager";
import { commitGame, isSpymaster } from "@/lib/store/game-store";
import { afterGameMutation, authorizeClue } from "@/lib/multiplayer/service";
import { getOptionalActor } from "@/lib/multiplayer/identity";
import { clueSchema, parseBody } from "@/lib/validation/schemas";
import { handleErrorWithHttp, HttpError, loadGameOr404, spymasterToken } from "@/lib/api-helpers";

/**
 * POST /api/games/:id/clue — server-authoritative clue.
 * Room games: only the CURRENT team's human spymaster (membership-checked).
 * Quick games: only the holder of that team's spymaster token.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const entry = loadGameOr404(decodeURIComponent(id));
    const actor = await getOptionalActor(req);
    const access = authorizeClue(entry, actor); // throws for room games when unauthorized
    let spyView = Boolean(access?.spymasterView);
    if (!access) {
      const team = isSpymaster(entry, spymasterToken(req));
      if (!team) throw new HttpError(403, "Only a spymaster can give a clue. Switch to the spymaster view first.");
      if (team !== entry.state.currentTeam)
        throw new HttpError(403, `It is the ${entry.state.currentTeam} spymaster's turn to give a clue.`);
      spyView = true;
    }
    const body = parseBody(clueSchema, await req.json());
    const version = entry.version;
    const next = giveClue(entry.state, body.clue, body.number, "human");
    if (!commitGame(entry, next, version)) throw new HttpError(409, "Game changed underneath you — refresh and retry.");
    afterGameMutation(entry);
    return Response.json({ game: toPublicState(next, spyView), version: entry.version });
  } catch (err) {
    return handleErrorWithHttp(err);
  }
}
