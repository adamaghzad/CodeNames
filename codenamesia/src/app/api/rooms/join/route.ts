import { joinRoom } from "@/lib/multiplayer/service";
import { getActor, sanitizeDisplayName } from "@/lib/multiplayer/identity";
import { joinRoomSchema, parseBody } from "@/lib/validation/schemas";
import { handleErrorWithHttp } from "@/lib/api-helpers";

/** POST /api/rooms/join — join (or rejoin) by invite code. Idempotent per player. */
export async function POST(req: Request) {
  try {
    const actor = await getActor(req);
    const body = parseBody(joinRoomSchema, await req.json());
    const room = await joinRoom(
      actor,
      body.code,
      body.displayName ? sanitizeDisplayName(body.displayName) : undefined
    );
    return Response.json({ room, invitePath: `/room/${room.code}` });
  } catch (err) {
    return handleErrorWithHttp(err);
  }
}
