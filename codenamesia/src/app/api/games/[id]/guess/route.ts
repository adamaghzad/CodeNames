import { applyGuesses } from "@/lib/game-engine/game-rules";
import { toPublicState } from "@/lib/game-engine/turn-manager";
import { clearPlayerSelection, commitGame, isSpymaster } from "@/lib/store/game-store";
import { afterGameMutation, authorizeGuess } from "@/lib/multiplayer/service";
import { getOptionalActor } from "@/lib/multiplayer/identity";
import { guessSchema, parseBody } from "@/lib/validation/schemas";
import { handleErrorWithHttp, HttpError, loadGameOr404, spymasterToken } from "@/lib/api-helpers";

/**
 * POST /api/games/:id/guess — server-authoritative card reveal.
 * Room games: only OPERATIVES of the current team. Spymasters and the
 * wrong team are rejected. The version check makes concurrent guesses
 * safe — the loser gets 409 and fresh state, never a double reveal.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const entry = loadGameOr404(decodeURIComponent(id));
    const actor = await getOptionalActor(req);
    const access = authorizeGuess(entry, actor, "guess");
    let spyView = Boolean(access?.spymasterView);
    if (!access) {
      const tokenTeam = isSpymaster(entry, spymasterToken(req));
      if (tokenTeam && tokenTeam === entry.state.currentTeam && entry.state.mode === "human-vs-human") {
        throw new HttpError(403, "The spymaster cannot reveal cards. Switch to the operative view to guess.");
      }
      spyView = Boolean(tokenTeam);
    }
    const guessingTeam = entry.state.currentTeam;
    const selectorId = access?.member.userId ?? `quick:${guessingTeam}`;
    const body = parseBody(guessSchema, await req.json());
    const version = body.version ?? entry.version;
    const cardIds = body.cardIds?.length ? body.cardIds : body.cardId ? [body.cardId] : [];
    const { state: next, results, stoppedReason } = applyGuesses(entry.state, cardIds);
    const last = results[results.length - 1];
    if (!commitGame(entry, next, version))
      throw new HttpError(409, "That card was just touched by someone else — state refreshed.");
    clearPlayerSelection(entry, selectorId);
    afterGameMutation(entry);
    return Response.json({
      game: toPublicState(next, spyView),
      result: last?.result,
      word: last?.word,
      results,
      stoppedReason,
      version: entry.version,
    });
  } catch (err) {
    return handleErrorWithHttp(err);
  }
}
