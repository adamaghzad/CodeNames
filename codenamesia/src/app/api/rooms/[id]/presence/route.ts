import { emit, loadRoomOr404, requireMember } from "@/lib/multiplayer/service";
import { getActor } from "@/lib/multiplayer/identity";
import { touchMember } from "@/lib/multiplayer/room-store";
import { handleErrorWithHttp } from "@/lib/api-helpers";

/** POST /api/rooms/:id/presence — heartbeat (durable last-seen; SSE tracks live sockets). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getActor(req);
    const room = await loadRoomOr404(decodeURIComponent((await ctx.params).id));
    requireMember(room, actor.userId);
    touchMember(room.id, actor.userId);
    emit(room, "presence");
    return Response.json({ ok: true });
  } catch (err) {
    return handleErrorWithHttp(err);
  }
}
