import { GameRuleError } from "@/lib/game-engine/game-rules";
import { ValidationError } from "@/lib/validation/schemas";
import { getGame, type ServerGame } from "@/lib/store/game-store";

export function handleError(err: unknown): Response {
  if (err instanceof ValidationError) return Response.json({ error: err.message }, { status: 400 });
  if (err instanceof GameRuleError) return Response.json({ error: err.message }, { status: 422 });
  if (err instanceof Error) {
    console.error("[api]", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
  return Response.json({ error: "Unexpected server error." }, { status: 500 });
}

export function loadGameOr404(id: string): ServerGame {
  const game = getGame(id);
  if (!game) throw new HttpError(404, "Game not found. It may have expired (in-memory store) — create a new game.");
  return game;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export function handleErrorWithHttp(err: unknown): Response {
  if (err instanceof HttpError) return Response.json({ error: err.message }, { status: err.status });
  return handleError(err);
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export function spymasterToken(req: Request): string | null {
  return req.headers.get("x-spymaster-token");
}
