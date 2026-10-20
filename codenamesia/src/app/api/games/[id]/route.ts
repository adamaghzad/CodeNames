import { toPublicState } from "@/lib/game-engine/turn-manager";
import { getVisibleTouches, isSpymaster } from "@/lib/store/game-store";
import { authorizeGameView } from "@/lib/multiplayer/service";
import { getOptionalActor } from "@/lib/multiplayer/identity";
import { handleErrorWithHttp, loadGameOr404, spymasterToken } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

/**
 * GET /api/games/:id — authorized game state (id may also be a room code
 * for quick games).
 *
 * Room games: membership required; spymasters get the key-card serializer,
 * operatives get the public serializer (NO unrevealed assignments).
 * Quick/solo games: legacy per-team spymaster token decides the view.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const entry = loadGameOr404(decodeURIComponent(id));
    const actor = await getOptionalActor(req);
    const access = authorizeGameView(entry, actor);
    if (access) {
      return Response.json({
        game: toPublicState(entry.state, access.spymasterView),
        version: entry.version,
        touches: getVisibleTouches(entry, access.member.team, actor?.userId),
        viewer: {
          team: access.member.team,
          role: access.member.role,
          displayName: access.member.displayName,
          isHost: actor?.userId === access.room.hostId,
          aiSpymaster: access.room.aiSpymaster,
          roomCode: access.room.code,
          roomId: access.room.id,
        },
      });
    }
    const team = isSpymaster(entry, spymasterToken(req));
    return Response.json({
      game: toPublicState(entry.state, Boolean(team)),
      spymasterTeam: team,
      version: entry.version,
      touches: getVisibleTouches(
        entry,
        team ?? entry.state.currentTeam,
        team ? null : `quick:${entry.state.currentTeam}`
      ),
      viewer: null,
    });
  } catch (err) {
    return handleErrorWithHttp(err);
  }
}
