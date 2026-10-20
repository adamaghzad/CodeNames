import { subscribeRoom, trackConnection } from "@/lib/multiplayer/events";
import { loadRoomOr404, requireMember } from "@/lib/multiplayer/service";
import { getActor } from "@/lib/multiplayer/identity";
import { touchMember } from "@/lib/multiplayer/room-store";
import { handleErrorWithHttp } from "@/lib/api-helpers";
import type { RoomEvent } from "@/lib/multiplayer/types";

export const dynamic = "force-dynamic";
// SSE streams are long-lived; run on Node.js runtime.
export const runtime = "nodejs";

/**
 * GET /api/rooms/:id/events — Server-Sent Events realtime channel.
 *
 * Payloads contain ONLY {type, roomVersion, gameId} — never game secrets.
 * Clients react by refetching their authorized room/game state (spec §5).
 * When Supabase is configured, the identical notifications are also written
 * to `room_events` for Supabase Realtime subscribers.
 *
 * Auth: `Authorization: Bearer …` or `?token=…` (EventSource limitation).
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getActor(req);
    const { id } = await ctx.params;
    const room = await loadRoomOr404(decodeURIComponent(id));
    requireMember(room, actor.userId);
    touchMember(room.id, actor.userId);

    const encoder = new TextEncoder();
    let cleanup: () => void = () => {};

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (event: RoomEvent | { type: "connected"; roomId: string; roomVersion: number }) => {
          try {
            controller.enqueue(encoder.encode(`event: sync\ndata: ${JSON.stringify(event)}\n\n`));
          } catch {
            /* client gone */
          }
        };

        send({ type: "connected", roomId: room.id, roomVersion: room.version });
        const unsubscribe = subscribeRoom(room.id, send);
        const untrack = trackConnection(room.id, actor.userId);

        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
            touchMember(room.id, actor.userId);
          } catch {
            /* closed */
          }
        }, 20_000);

        cleanup = () => {
          clearInterval(heartbeat);
          unsubscribe();
          untrack();
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        };
        req.signal.addEventListener("abort", cleanup);
      },
      cancel() {
        cleanup();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    return handleErrorWithHttp(err);
  }
}
