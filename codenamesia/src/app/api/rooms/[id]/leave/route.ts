import { leaveRoom, loadRoomOr404 } from "@/lib/multiplayer/service";
import { getActor } from "@/lib/multiplayer/identity";
import { handleErrorWithHttp } from "@/lib/api-helpers";

/** POST /api/rooms/:id/leave — leave room; host migrates to earliest member. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getActor(req);
    const room = await loadRoomOr404(decodeURIComponent((await ctx.params).id));
    return Response.json(leaveRoom(room, actor));
  } catch (err) {
    return handleErrorWithHttp(err);
  }
}
