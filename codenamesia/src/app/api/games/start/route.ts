import { rateLimit } from "@/lib/ai/groq";
import { loadRoomOr404, startGame } from "@/lib/multiplayer/service";
import { getActor } from "@/lib/multiplayer/identity";
import { parseBody, startGameSchema } from "@/lib/validation/schemas";
import { clientIp, handleErrorWithHttp } from "@/lib/api-helpers";

/**
 * POST /api/games/start — host starts the room's game.
 * Groq generates 25 words; the server engine assigns 9/8/7/1. Idempotent.
 */
export async function POST(req: Request) {
  try {
    if (!rateLimit(`start-game:${clientIp(req)}`, 10)) {
      return Response.json({ error: "Too many start attempts. Please wait a minute." }, { status: 429 });
    }
    const actor = await getActor(req);
    const { roomId } = parseBody(startGameSchema, await req.json());
    const room = await loadRoomOr404(roomId);
    const result = await startGame(actor, room);
    return Response.json(result, { status: 201 });
  } catch (err) {
    return handleErrorWithHttp(err);
  }
}
