import { issueGuestToken, sanitizeDisplayName } from "@/lib/multiplayer/identity";
import { guestSchema, parseBody } from "@/lib/validation/schemas";
import { handleErrorWithHttp } from "@/lib/api-helpers";

/**
 * POST /api/guest — secure anonymous identity (spec §3).
 * Issues an HMAC-signed guest token + stable player id. When Supabase is
 * configured the client may instead use Supabase anonymous auth; both are
 * accepted by every endpoint (see lib/multiplayer/identity.ts).
 */
export async function POST(req: Request) {
  try {
    const body = parseBody(guestSchema, await req.json().catch(() => ({})));
    const displayName = sanitizeDisplayName(body.displayName);
    const { token, userId } = issueGuestToken(displayName);
    return Response.json({ token, userId, displayName, kind: "guest" }, { status: 201 });
  } catch (err) {
    return handleErrorWithHttp(err);
  }
}
