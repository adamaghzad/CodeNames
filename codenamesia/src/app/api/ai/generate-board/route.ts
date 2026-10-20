import { generateBoardWords } from "@/lib/ai/services";
import { rateLimit } from "@/lib/ai/groq";
import { generateBoardSchema, parseBody } from "@/lib/validation/schemas";
import { clientIp, handleErrorWithHttp } from "@/lib/api-helpers";

/** POST /api/ai/generate-board — AI generates exactly 25 validated words (no colors). */
export async function POST(req: Request) {
  try {
    if (!rateLimit(`generate-board:${clientIp(req)}`, 10)) {
      return Response.json({ error: "Too many AI requests. Please wait a minute." }, { status: 429 });
    }
    const body = parseBody(generateBoardSchema, await req.json());
    const result = await generateBoardWords(body);
    return Response.json({ words: result.words, demoMode: result.demoMode, model: result.model });
  } catch (err) {
    return handleErrorWithHttp(err);
  }
}
