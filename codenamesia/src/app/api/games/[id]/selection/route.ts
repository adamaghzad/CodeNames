import { maxGuessesForClue } from "@/lib/game-engine/game-rules";
import { getVisibleTouches, isSpymaster, setPlayerSelection } from "@/lib/store/game-store";
import { authorizeGuess, notifySelection } from "@/lib/multiplayer/service";
import { getOptionalActor } from "@/lib/multiplayer/identity";
import { parseBody, selectionSchema } from "@/lib/validation/schemas";
import { handleErrorWithHttp, HttpError, loadGameOr404, spymasterToken } from "@/lib/api-helpers";

/**
 * POST /api/games/:id/selection — sync an operative's pre-confirm touches.
 *
 * Selections are team-internal table talk: only operatives of the CURRENT
 * team may set them, and only that team's members (operatives + spymaster)
 * ever receive them in game fetches. This never bumps the game version and
 * never reveals assignments — it only shares intent before the confirm.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const entry = loadGameOr404(decodeURIComponent(id));
    const actor = await getOptionalActor(req);
    const access = authorizeGuess(entry, actor, "select");

    const team = entry.state.currentTeam;
    let playerId: string;
    let displayName: string;
    if (access) {
      playerId = access.member.userId;
      displayName = access.member.displayName;
    } else {
      // Quick/solo game: the operative view (no spymaster token) may select.
      const tokenTeam = isSpymaster(entry, spymasterToken(req));
      if (tokenTeam) {
        throw new HttpError(403, "The spymaster cannot select cards. Switch to the operative view to select.");
      }
      playerId = `quick:${team}`;
      displayName = "Operative";
    }

    const state = entry.state;
    if (state.status !== "playing" || state.phase !== "guessing" || !state.currentClue) {
      throw new HttpError(422, "Cards can only be selected while your team is guessing.");
    }

    const body = parseBody(selectionSchema, await req.json());
    const byId = new Map(state.cards.map((c) => [c.id, c]));
    const left = Math.max(0, maxGuessesForClue(state.currentClue.number) - state.guessesUsedThisTurn);
    const cardIds = [...new Set(body.cardIds)]
      .filter((cardId) => {
        const card = byId.get(cardId);
        return Boolean(card && !card.revealed);
      })
      .slice(0, left);

    setPlayerSelection(entry, {
      playerId,
      displayName,
      team,
      clueId: state.currentClue.id,
      cardIds,
      updatedAt: new Date().toISOString(),
    });
    notifySelection(entry);

    return Response.json({ ok: true, touches: getVisibleTouches(entry, team, playerId) });
  } catch (err) {
    return handleErrorWithHttp(err);
  }
}
