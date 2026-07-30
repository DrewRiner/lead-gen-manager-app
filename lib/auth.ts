import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { profiles, type Profile } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";
import { eq } from "drizzle-orm";

// Server-side auth helpers. Not Server Actions — imported by Server Components.

/** The authenticated Supabase user, or null. */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** The current user's profile row, or null if unauthenticated / no profile. */
export async function getProfile(): Promise<Profile | null> {
  const user = await getUser();
  if (!user) return null;
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);
  return profile ?? null;
}

/**
 * Require an authenticated user in a Server Component. Middleware already
 * gates routes, but this is a defense-in-depth guard and gives us the user.
 */
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Require an ACTIVE, ADMIN profile in a Server Component (the /settings/users
 * page). Non-admins are bounced to the dashboard; deactivated or missing
 * profiles to /login. Server-side gate — never rely on hidden UI alone.
 */
export async function requireAdmin(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile || profile.deactivatedAt) redirect("/login");
  if (profile.role !== "admin") redirect("/");
  return profile;
}
