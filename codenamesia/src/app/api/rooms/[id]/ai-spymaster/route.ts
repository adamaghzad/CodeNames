import { loadRoomOr404, setAiSpymaster } from "@/lib/multiplayer/service";
import { getActor } from "@/lib/multiplayer/identity";
import { aiSpymasterSchema, parseBody } from "@/lib/validation/schemas";
import { handleErrorWithHttp } from "@/lib/api-helpers";

/** POST /api/rooms/:id/ai-spymaster — host toggles Groq AI spymaster per team. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getActor(req);
    const room = await loadRoomOr404(decodeURIComponent((await ctx.params).id));
    const { team, enabled } = parseBody(aiSpymasterSchema, await req.json());
    return Response.json({ room: setAiSpymaster(room, actor, team, enabled) });
  } catch (err) {
    return handleErrorWithHttp(err);
  }
}
