import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Service-role Supabase client — SERVER ONLY. Bypasses RLS, so it must never be
// imported by a client component or exposed via a NEXT_PUBLIC_ var. Used only
// for Storage (the guide-media bucket); all relational data access is Drizzle.
// The `server-only` import makes a client-side import a build error.
// ---------------------------------------------------------------------------

let cached: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Supabase service client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/** The Storage bucket that holds all guide images and videos. */
export const GUIDE_MEDIA_BUCKET = "guide-media";
