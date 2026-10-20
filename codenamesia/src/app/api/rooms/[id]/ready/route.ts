import { loadRoomOr404, setReady } from "@/lib/multiplayer/service";
import { getActor } from "@/lib/multiplayer/identity";
import { parseBody, readySchema } from "@/lib/validation/schemas";
import { handleErrorWithHttp } from "@/lib/api-helpers";

/** POST /api/rooms/:id/ready — toggle ready status (lobby only). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getActor(req);
    const room = await loadRoomOr404(decodeURIComponent((await ctx.params).id));
    const { ready } = parseBody(readySchema, await req.json());
    return Response.json({ room: setReady(room, actor, ready) });
  } catch (err) {
    return handleErrorWithHttp(err);
  }
}
