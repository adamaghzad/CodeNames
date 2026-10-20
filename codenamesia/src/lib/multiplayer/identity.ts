import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";
import type { Actor } from "./types";
import { HttpError } from "@/lib/api-helpers";

/**
 * Player identity (spec §3: secure guest / anonymous auth).
 *
 * Two accepted credential kinds on `Authorization: Bearer …`:
 *  1. Supabase JWT (email/Google/anonymous sign-in) — verified with Supabase.
 *  2. Guest token `gst_<payload>.<hmac>` — issued by POST /api/guest, signed
 *     with a server-only secret. Used when Supabase isn't configured, so
 *     multiplayer still has unforgeable per-player identities.
 *
 * Every room/game endpoint resolves the actor through getActor() and then
 * checks room membership + role. Client-supplied user ids are NEVER trusted.
 */

const globalSecret = globalThis as unknown as { __codenamesiaGuestSecret?: string };

function guestSecret(): string {
  return (
    process.env.GUEST_AUTH_SECRET ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    (globalSecret.__codenamesiaGuestSecret ??= randomBytes(32).toString("hex"))
  );
}

interface GuestPayload {
  sub: string;
  name: string;
  exp: number;
}

const b64 = (s: string) => Buffer.from(s).toString("base64url");

export function issueGuestToken(displayName: string, userId = randomUUID()): { token: string; userId: string } {
  const payload: GuestPayload = {
    sub: userId,
    name: displayName.slice(0, 30),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
  };
  const body = b64(JSON.stringify(payload));
  const sig = createHmac("sha256", guestSecret()).update(body).digest("base64url");
  return { token: `gst_${body}.${sig}`, userId };
}

function verifyGuestToken(token: string): Actor | null {
  const raw = token.slice(4);
  const [body, sig] = raw.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", guestSecret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const e = Buffer.from(expected);
  if (a.length !== e.length || !timingSafeEqual(a, e)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as GuestPayload;
    if (!payload.sub || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { userId: payload.sub, displayName: payload.name || "Guest", kind: "guest" };
  } catch {
    return null;
  }
}

async function verifySupabaseToken(token: string): Promise<Actor | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !publishableKey) return null;
  try {
    const supabase = createClient(url, publishableKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return null;
    const meta = data.user.user_metadata as { display_name?: string; name?: string } | undefined;
    return {
      userId: data.user.id,
      displayName: meta?.display_name || meta?.name || data.user.email?.split("@")[0] || "Player",
      kind: "supabase",
    };
  } catch {
    return null;
  }
}

export function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  // EventSource cannot set headers, so the SSE endpoint accepts ?token= as well.
  try {
    return new URL(req.url).searchParams.get("token");
  } catch {
    return null;
  }
}

/** Resolves (and verifies) the calling player. Throws 401 when unauthenticated. */
export async function getActor(req: Request): Promise<Actor> {
  const token = bearerToken(req);
  if (!token) throw new HttpError(401, "Authentication required. Create a guest identity first (POST /api/guest).");
  const actor = token.startsWith("gst_") ? verifyGuestToken(token) : await verifySupabaseToken(token);
  if (!actor) throw new HttpError(401, "Invalid or expired credentials. Please sign in again.");
  return actor;
}

/** Like getActor but returns null instead of throwing (mixed-auth endpoints). */
export async function getOptionalActor(req: Request): Promise<Actor | null> {
  try {
    return await getActor(req);
  } catch {
    return null;
  }
}

export function sanitizeDisplayName(name: string | undefined): string {
  const clean = (name ?? "").trim().replace(/[<>"'`]/g, "").slice(0, 24);
  return clean || `Player-${randomBytes(2).toString("hex").toUpperCase()}`;
}
