import { loadRoomOr404, setRole } from "@/lib/multiplayer/service";
import { getActor } from "@/lib/multiplayer/identity";
import { parseBody, roleSchema } from "@/lib/validation/schemas";
import { handleErrorWithHttp } from "@/lib/api-helpers";

/** POST /api/rooms/:id/role — claim/release spymaster seat (max 1 human per team). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getActor(req);
    const room = await loadRoomOr404(decodeURIComponent((await ctx.params).id));
    const { role } = parseBody(roleSchema, await req.json());
    return Response.json({ room: setRole(room, actor, role) });
  } catch (err) {
    return handleErrorWithHttp(err);
  }
}
