import { loadRoomOr404, setTeam } from "@/lib/multiplayer/service";
import { getActor } from "@/lib/multiplayer/identity";
import { parseBody, teamSchema } from "@/lib/validation/schemas";
import { handleErrorWithHttp } from "@/lib/api-helpers";

/** POST /api/rooms/:id/team — join/switch team (lobby only). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getActor(req);
    const room = await loadRoomOr404(decodeURIComponent((await ctx.params).id));
    const { team } = parseBody(teamSchema, await req.json());
    return Response.json({ room: setTeam(room, actor, team) });
  } catch (err) {
    return handleErrorWithHttp(err);
  }
}
