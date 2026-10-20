import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client.
 * Modern projects use NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (sb_publishable_...).
 * NEXT_PUBLIC_SUPABASE_ANON_KEY is kept as a legacy fallback. Both are safe to
 * expose in the browser because access is constrained by Row Level Security.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !publishableKey) return null; // App runs in local mode without Supabase.
  return createBrowserClient(url, publishableKey);
}

export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
);
