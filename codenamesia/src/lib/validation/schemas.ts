import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Category must be at least 2 characters.").max(60),
  weight: z.number().int().min(0).max(100).optional(),
});

export const generateBoardSchema = z.object({
  categories: z.array(categorySchema).min(1, "Add at least one category.").max(5, "Maximum 5 categories."),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  language: z.enum(["en", "fr", "ar"]).default("en"),
  boardSize: z.literal(25).optional(),
});

export const createGameSchema = generateBoardSchema.extend({
  mode: z.enum(["human-vs-human", "human-vs-ai", "ai-spymaster", "solo"]).default("human-vs-human"),
});

export const clueSchema = z.object({
  clue: z.string().trim().min(1).max(40),
  number: z.number().int().min(0).max(9),
});

export const guessSchema = z
  .object({
    cardId: z.string().min(1).optional(),
    cardIds: z.array(z.string().min(1)).min(1).max(25).optional(),
    version: z.number().int().optional(),
  })
  .refine((v) => Boolean(v.cardId || v.cardIds?.length), {
    message: "A cardId or cardIds list is required.",
  });

/** Pre-confirm selection sync ("touches"). Empty array = clear my touches. */
export const selectionSchema = z.object({
  cardIds: z.array(z.string().min(1)).max(25),
});

// ------------------------- multiplayer (rooms) -------------------------

export const guestSchema = z.object({
  displayName: z.string().trim().min(1).max(24).optional(),
});

export const createRoomSchema = z.object({
  categories: z.array(categorySchema).min(1, "Add at least one category.").max(5),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  language: z.enum(["en", "fr", "ar"]).default("en"),
  mode: z.enum(["human-vs-human", "human-vs-ai", "ai-spymaster", "solo"]).default("human-vs-human"),
  maxPlayers: z.number().int().min(2).max(16).default(10),
  aiSpymasterRed: z.boolean().default(false),
  aiSpymasterBlue: z.boolean().default(false),
  displayName: z.string().trim().min(1).max(24).optional(),
});

export const joinRoomSchema = z.object({
  code: z.string().trim().min(4).max(10),
  displayName: z.string().trim().min(1).max(24).optional(),
});

export const teamSchema = z.object({ team: z.enum(["red", "blue"]).nullable() });
export const roleSchema = z.object({ role: z.enum(["spymaster", "operative"]) });
export const readySchema = z.object({ ready: z.boolean() });
export const aiSpymasterSchema = z.object({ team: z.enum(["red", "blue"]), enabled: z.boolean() });
export const startGameSchema = z.object({ roomId: z.string().min(1) });

export function errorResponse(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const msg = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new ValidationError(msg);
  }
  return result.data;
}

export class ValidationError extends Error {
  status = 400;
}
