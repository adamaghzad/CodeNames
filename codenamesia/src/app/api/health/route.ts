import { hasGroqKey, GROQ_MODEL } from "@/lib/ai/groq";

export async function GET() {
  const hasUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL);
  const hasPublishableKey = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const hasSecretKey = Boolean(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);

  return Response.json({
    ok: true,
    app: "CodenamesIA",
    ai: { provider: "Groq", model: GROQ_MODEL, configured: hasGroqKey, demoMode: !hasGroqKey },
    supabase: {
      configured: hasUrl && hasPublishableKey,
      hasUrl,
      hasPublishableKey,
      hasSecretKey,
      persistenceConfigured: hasUrl && hasSecretKey,
      missing: [
        ...(!hasUrl ? ["NEXT_PUBLIC_SUPABASE_URL"] : []),
        ...(!hasPublishableKey ? ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] : []),
        ...(!hasSecretKey ? ["SUPABASE_SECRET_KEY"] : []),
      ],
    },
    time: new Date().toISOString(),
  });
}
