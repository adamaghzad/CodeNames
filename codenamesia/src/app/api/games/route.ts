import { generateBoardWords } from "@/lib/ai/services";
import { rateLimit } from "@/lib/ai/groq";
import { createGameState, generateRoomCode } from "@/lib/game-engine/create-board";
import { toPublicState } from "@/lib/game-engine/turn-manager";
import { listGames, saveNewGame } from "@/lib/store/game-store";
import { createGameSchema, parseBody } from "@/lib/validation/schemas";
import { clientIp, handleErrorWithHttp } from "@/lib/api-helpers";

/**
 * POST /api/games — full pipeline:
 * categories → Groq words (validated) → server-side key card → stored game.
 * Returns the PUBLIC board + spymaster tokens to the creator only.
 * (In room multiplayer, tokens are handed to the players who claim the
 * spymaster roles; operatives never receive them.)
 */
export async function POST(req: Request) {
  try {
    if (!rateLimit(`create-game:${clientIp(req)}`, 10)) {
      return Response.json({ error: "Too many game creations. Please wait a minute." }, { status: 429 });
    }
    const body = parseBody(createGameSchema, await req.json());
    const { words, demoMode } = await generateBoardWords(body);

    const state = createGameState({
      words,
      categories: body.categories.map((c) => c.name),
      difficulty: body.difficulty,
      language: body.language,
      mode: body.mode,
      roomCode: generateRoomCode(),
      demoMode,
    });
    const entry = saveNewGame(state);

    return Response.json(
      {
        game: toPublicState(state, false),
        spymasterTokens: entry.spymasterTokens,
        version: entry.version,
      },
      { status: 201 }
    );
  } catch (err) {
    return handleErrorWithHttp(err);
  }
}

/** GET /api/games — recent games (dashboard; public metadata only). */
export async function GET() {
  const games = listGames().slice(0, 20).map((g) => ({
    id: g.id,
    roomCode: g.roomCode,
    categories: g.categories,
    mode: g.mode,
    status: g.status,
    winner: g.winner,
    currentTeam: g.currentTeam,
    createdAt: g.createdAt,
    demoMode: g.demoMode,
  }));
  return Response.json({ games });
}
