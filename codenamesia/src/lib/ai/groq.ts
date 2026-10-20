import Groq from "groq-sdk";

/**
 * Groq client — server-only. GROQ_API_KEY is never exposed to the browser.
 * Model defaults to openai/gpt-oss-20b and is overridable via GROQ_MODEL.
 */
export const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
export const hasGroqKey = Boolean(process.env.GROQ_API_KEY);

let client: Groq | null = null;

export function getGroqClient(): Groq {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured. Add it to .env.local (see .env.example).");
  }
  if (!client) {
    client = new Groq({ apiKey: process.env.GROQ_API_KEY, timeout: 30_000, maxRetries: 1 });
  }
  return client;
}

interface ChatJsonOptions {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Calls Groq with JSON mode, a hard timeout, and safe JSON parsing.
 * Never trusts the raw response — callers must validate with Zod.
 *
 * gpt-oss reliability notes (learned from live testing):
 * - `reasoning_effort: "low"` keeps the reasoning model fast and stops it
 *   from burning the whole token budget before emitting JSON.
 * - Groq occasionally returns HTTP 400 `json_validate_failed` with an
 *   empty generation in strict JSON mode. We retry once WITHOUT
 *   response_format and parse defensively instead.
 */
export async function groqChatJson<T = unknown>(opts: ChatJsonOptions): Promise<T> {
  const groq = getGroqClient();
  const started = Date.now();
  const isOss = GROQ_MODEL.includes("gpt-oss");
  const base = {
    model: GROQ_MODEL,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 1500,
    ...(isOss ? { reasoning_effort: "low" as const } : {}),
    messages: [
      { role: "system" as const, content: opts.system },
      { role: "user" as const, content: opts.user },
    ],
  };

  let raw = "";
  try {
    const completion = await groq.chat.completions.create({
      ...base,
      response_format: { type: "json_object" },
    });
    raw = completion.choices?.[0]?.message?.content ?? "";
    logUsage(started, completion.usage);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("json_validate_failed")) throw err;
    console.warn("[groq] JSON mode failed validation — retrying without response_format.");
    const completion = await groq.chat.completions.create(base);
    raw = completion.choices?.[0]?.message?.content ?? "";
    logUsage(started, completion.usage);
  }

  if (!raw.trim()) throw new Error("AI returned an empty response.");
  return safeJsonParse<T>(raw);
}

function logUsage(started: number, usage?: { prompt_tokens?: number; completion_tokens?: number }) {
  // Token usage logging (server logs only — never sent to clients).
  console.info(
    `[groq] model=${GROQ_MODEL} ms=${Date.now() - started} prompt_tokens=${usage?.prompt_tokens ?? "?"} completion_tokens=${usage?.completion_tokens ?? "?"}`
  );
}

export function safeJsonParse<T>(raw: string): T {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // Last resort: extract the outermost JSON object.
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as T;
    }
    throw new Error("AI returned invalid JSON.");
  }
}

function isRateLimited(msg: string): boolean {
  return msg.includes("rate_limit") || msg.includes("429") || msg.toLowerCase().includes("rate limit");
}

/** Maps raw provider errors to messages a player can act on. */
export function friendlyAiError(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err);
  if (isRateLimited(msg)) {
    return new Error(
      "The AI is momentarily rate-limited (Groq free tier allows ~8,000 tokens/minute). Wait about 10 seconds and try again — your room and teams are saved."
    );
  }
  if (msg.includes("401") || msg.toLowerCase().includes("invalid api key")) {
    return new Error("The Groq API key was rejected. Check GROQ_API_KEY in .env.local and restart the server.");
  }
  if (msg.includes("valid unique words")) return err instanceof Error ? err : new Error(msg);
  return new Error("The AI couldn't generate that just now. Please try again in a few seconds.");
}

/**
 * Retry helper for transient AI/validation failures.
 * Rate limits get real backoff (honouring Groq's "try again in Xs" hint);
 * everything else gets a short linear delay.
 */
export async function withRetries<T>(fn: () => Promise<T>, attempts = 3, label = "ai"): Promise<T> {
  let lastError: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[${label}] attempt ${i}/${attempts} failed:`, msg);
      if (i < attempts) {
        let delay = 400 * i;
        if (isRateLimited(msg)) {
          const hinted = msg.match(/try again in ([\d.]+)s/i);
          delay = Math.min(15_000, hinted ? Number(hinted[1]) * 1000 + 600 : 3_000 * i);
          console.warn(`[${label}] rate-limited — backing off ${delay}ms`);
        }
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw friendlyAiError(lastError);
}

// ---------- Minimal in-memory rate limiter (per IP, per route) ----------
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit = 20, windowMs = 60_000): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}
