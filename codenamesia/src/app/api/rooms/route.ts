import { rateLimit } from "@/lib/ai/groq";
import { createRoom } from "@/lib/multiplayer/service";
import { getActor, sanitizeDisplayName } from "@/lib/multiplayer/identity";
import { createRoomSchema, parseBody } from "@/lib/validation/schemas";
import { clientIp, handleErrorWithHttp } from "@/lib/api-helpers";

/** POST /api/rooms — create a private multiplayer room (host = caller). */
export async function POST(req: Request) {
  try {
    if (!rateLimit(`create-room:${clientIp(req)}`, 20)) {
      return Response.json({ error: "Too many rooms created. Please wait a minute." }, { status: 429 });
    }
    const actor = await getActor(req);
    const body = parseBody(createRoomSchema, await req.json());
    const room = await createRoom(actor, {
      ...body,
      displayName: sanitizeDisplayName(body.displayName ?? actor.displayName),
    });
    return Response.json({ room, invitePath: `/room/${room.code}` }, { status: 201 });
  } catch (err) {
    return handleErrorWithHttp(err);
  }
}
