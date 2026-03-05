import { createClient } from "@supabase/supabase-js";

/**
 * Admin Supabase client for server-side operations that don't require user auth.
 * Uses service role key when available for full access; falls back to anon key.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase URL and anon key are required");
  }

  return createClient(url, serviceKey ?? anonKey, {
    auth: { persistSession: false },
  });
}
