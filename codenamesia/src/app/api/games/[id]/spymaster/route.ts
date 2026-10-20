import { toPublicState } from "@/lib/game-engine/turn-manager";
import { isSpymaster } from "@/lib/store/game-store";
import { authorizeGameView } from "@/lib/multiplayer/service";
import { getOptionalActor } from "@/lib/multiplayer/identity";
import { handleErrorWithHttp, HttpError, loadGameOr404, spymasterToken } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

/**
 * GET /api/games/:id/spymaster — the SECRET key-card view.
 *
 * Room games: caller must be a room member whose role is spymaster.
 * Quick/solo games: caller must present a valid per-team spymaster token.
 * Everyone else gets 403 — unrevealed assignments are never included.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const entry = loadGameOr404(decodeURIComponent(id));
    const actor = await getOptionalActor(req);
    const access = authorizeGameView(entry, actor);

    if (access) {
      if (!access.spymasterView) throw new HttpError(403, "Operatives cannot access the secret board.");
      return Response.json({ game: toPublicState(entry.state, true), version: entry.version });
    }
    const team = isSpymaster(entry, spymasterToken(req));
    if (!team) throw new HttpError(403, "A valid spymaster token is required for the secret board.");
    return Response.json({ game: toPublicState(entry.state, true), spymasterTeam: team, version: entry.version });
  } catch (err) {
    return handleErrorWithHttp(err);
  }
}
