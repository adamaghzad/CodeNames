import { createServerClient } from "@supabase/ssr";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { cookies } from "next/headers";

function supabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
}

function supabasePublishableKey(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

function supabaseSecretKey(): string | undefined {
  // Modern: SUPABASE_SECRET_KEY (sb_secret_...). Legacy fallback: service_role JWT.
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
}

/** Server Supabase client bound to the user's session (RLS applies). */
export async function createServerSupabase() {
  const url = supabaseUrl();
  const publishableKey = supabasePublishableKey();
  if (!url || !publishableKey) return null;
  const cookieStore = await cookies();
  return createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          /* called from a Server Component — middleware refreshes sessions */
        }
      },
    },
  });
}

/**
 * Secret/service client — SERVER ONLY. Bypasses RLS; used exclusively by
 * trusted route handlers to read/write SECRET game-card rows.
 * NEVER import this from client code and never prefix its env name with NEXT_PUBLIC_.
 */
export function createServiceRoleClient() {
  const url = supabaseUrl();
  const key = supabaseSecretKey();
  if (!url || !key) return null;
  return createAdmin(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
