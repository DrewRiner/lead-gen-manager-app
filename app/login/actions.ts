"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";

const signInSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
  redirectedFrom: z.string().optional(),
});

export type SignInState = { error: string } | undefined;

export async function signInAction(formData: FormData): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    redirectedFrom: formData.get("redirectedFrom") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    return { error: "Invalid email or password." };
  }

  // Deactivated users are blocked even if they somehow authenticate: end the
  // session immediately and refuse. (A banned auth user can't reach here.)
  const [profile] = await db
    .select({ deactivatedAt: profiles.deactivatedAt })
    .from(profiles)
    .where(eq(profiles.id, data.user.id))
    .limit(1);
  if (profile?.deactivatedAt) {
    await supabase.auth.signOut();
    return { error: "This account has been deactivated. Contact an administrator." };
  }

  const dest = parsed.data.redirectedFrom;
  redirect(dest && dest.startsWith("/") && dest !== "/login" ? dest : "/");
}
