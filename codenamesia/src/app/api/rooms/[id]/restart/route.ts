import { loadRoomOr404, restartRoom } from "@/lib/multiplayer/service";
import { getActor } from "@/lib/multiplayer/identity";
import { handleErrorWithHttp } from "@/lib/api-helpers";

/** POST /api/rooms/:id/restart — host returns the room to the lobby (rematch). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getActor(req);
    const room = await loadRoomOr404(decodeURIComponent((await ctx.params).id));
    return Response.json({ room: restartRoom(room, actor) });
  } catch (err) {
    return handleErrorWithHttp(err);
  }
}
