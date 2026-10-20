import { endTurn } from "@/lib/game-engine/game-rules";
import { toPublicState } from "@/lib/game-engine/turn-manager";
import { commitGame, isSpymaster } from "@/lib/store/game-store";
import { afterGameMutation, authorizeGuess } from "@/lib/multiplayer/service";
import { getOptionalActor } from "@/lib/multiplayer/identity";
import { handleErrorWithHttp, HttpError, loadGameOr404, spymasterToken } from "@/lib/api-helpers";

/** POST /api/games/:id/end-turn — operatives of the current team may pass. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const entry = loadGameOr404(decodeURIComponent(id));
    const actor = await getOptionalActor(req);
    const access = authorizeGuess(entry, actor, "end the turn");
    const spyView = access ? access.spymasterView : Boolean(isSpymaster(entry, spymasterToken(req)));
    const version = entry.version;
    const next = endTurn(entry.state);
    if (!commitGame(entry, next, version)) throw new HttpError(409, "Game changed — refresh and retry.");
    afterGameMutation(entry);
    return Response.json({ game: toPublicState(next, spyView), version: entry.version });
  } catch (err) {
    return handleErrorWithHttp(err);
  }
}
