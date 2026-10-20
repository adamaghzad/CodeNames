import { loadRoomOr404, requireMember, toPublicRoom } from "@/lib/multiplayer/service";
import { getActor } from "@/lib/multiplayer/identity";
import { touchMember } from "@/lib/multiplayer/room-store";
import { handleErrorWithHttp } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

/** GET /api/rooms/:id (uuid or invite code) — members-only lobby state. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getActor(req);
    const { id } = await ctx.params;
    const room = await loadRoomOr404(decodeURIComponent(id));
    requireMember(room, actor.userId);
    touchMember(room.id, actor.userId);
    return Response.json({ room: toPublicRoom(room, actor.userId) });
  } catch (err) {
    return handleErrorWithHttp(err);
  }
}
