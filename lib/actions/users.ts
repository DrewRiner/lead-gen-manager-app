"use server";

import { randomBytes } from "node:crypto";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getProfile } from "@/lib/auth";
import { db } from "@/lib/db";
import { profiles, roleEnum } from "@/lib/db/schema";
import { getServiceClient } from "@/lib/supabase/service";
import {
  authorizeAdmin,
  canChangeRole,
  canDeactivate,
  type Actor,
  type Target,
} from "@/lib/user-guards";

// ---------------------------------------------------------------------------
// Admin user management. EVERY action re-checks the caller's role server-side
// (requireAdminCaller) — a member calling an action directly, not just via a
// hidden button, is rejected. All auth-user create/ban operations go through
// the service role, server-side only. Guards enforce that there is always at
// least one active admin and that an admin can't lock themselves out.
// ---------------------------------------------------------------------------

const BAN_FOREVER = "876000h"; // ~100 years; Supabase revokes token validation.

export type UserActionResult =
  | { ok: true; message?: string; tempPassword?: string; email?: string }
  | { ok: false; error: string };

/** The caller must be an active admin. Returns their actor, or throws. */
async function requireAdminCaller(): Promise<Actor> {
  const profile = await getProfile();
  const actor: Actor | null = profile
    ? { id: profile.id, role: profile.role, deactivated: profile.deactivatedAt != null }
    : null;
  const decision = authorizeAdmin(actor);
  if (!decision.ok || !actor) throw new Error("Not authorized: admin access required.");
  return actor;
}

/** Map a profile row to the pure-guard Target shape. */
function toTarget(p: {
  id: string;
  role: "admin" | "member";
  deactivatedAt: Date | null;
}): Target {
  return { id: p.id, role: p.role, deactivated: p.deactivatedAt != null };
}

/** Count of OTHER active admins (excluding `excludeId`). */
async function otherActiveAdminCount(excludeId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(profiles)
    .where(
      and(
        eq(profiles.role, "admin"),
        isNull(profiles.deactivatedAt),
        ne(profiles.id, excludeId),
      ),
    );
  return row?.n ?? 0;
}

// -- Create -----------------------------------------------------------------

const createSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  fullName: z.string().trim().min(1, "Full name is required.").max(120),
  role: z.enum(roleEnum.enumValues),
});

/** Cryptographically strong temporary password (URL-safe, ~24 chars). */
function generateTempPassword(): string {
  return randomBytes(18).toString("base64url");
}

export async function createUserAction(
  formData: FormData,
): Promise<UserActionResult> {
  try {
    await requireAdminCaller();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const parsed = createSchema.safeParse({
    email: formData.get("email"),
    fullName: formData.get("fullName"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }
  const { email, fullName, role } = parsed.data;

  const supabase = getServiceClient();
  const tempPassword = generateTempPassword();

  // Create the auth user (email pre-confirmed so they can sign in immediately
  // with the temporary password). The AFTER INSERT trigger creates the
  // matching profiles row; we then set the chosen role + name on it.
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (error || !data.user) {
    const msg = /already been registered|already exists|duplicate/i.test(
      error?.message ?? "",
    )
      ? "A user with that email already exists."
      : `Could not create user: ${error?.message ?? "unknown error"}`;
    return { ok: false, error: msg };
  }

  const id = data.user.id;
  const updated = await db
    .update(profiles)
    .set({ email, fullName, role, deactivatedAt: null, updatedAt: new Date() })
    .where(eq(profiles.id, id))
    .returning({ id: profiles.id });
  // Defensive: if the trigger hasn't materialized the row yet, insert it.
  if (updated.length === 0) {
    await db.insert(profiles).values({ id, email, fullName, role });
  }

  revalidatePath("/settings/users");
  return {
    ok: true,
    email,
    tempPassword,
    message: `Created ${email}.`,
  };
}

// -- Edit (name + role) ------------------------------------------------------

const updateSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string().trim().min(1, "Full name is required.").max(120),
  role: z.enum(roleEnum.enumValues),
});

export async function updateUserAction(
  formData: FormData,
): Promise<UserActionResult> {
  let caller;
  try {
    caller = await requireAdminCaller();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    fullName: formData.get("fullName"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }
  const { id, fullName, role } = parsed.data;

  const [target] = await db.select().from(profiles).where(eq(profiles.id, id)).limit(1);
  if (!target) return { ok: false, error: "User not found." };

  // Demotion guard (pure): dropping the last active admin to member is blocked.
  const decision = canChangeRole(caller, toTarget(target), role, await otherActiveAdminCount(id));
  if (!decision.ok) return { ok: false, error: decision.error };

  await db
    .update(profiles)
    .set({ fullName, role, updatedAt: new Date() })
    .where(eq(profiles.id, id));

  revalidatePath("/settings/users");
  return { ok: true, message: "User updated." };
}

// -- Deactivate --------------------------------------------------------------

const idSchema = z.object({ id: z.string().uuid() });

export async function deactivateUserAction(
  formData: FormData,
): Promise<UserActionResult> {
  let caller;
  try {
    caller = await requireAdminCaller();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const { id } = parsed.data;

  const [target] = await db.select().from(profiles).where(eq(profiles.id, id)).limit(1);
  if (!target) return { ok: false, error: "User not found." };
  if (target.deactivatedAt) return { ok: true, message: "Already deactivated." };

  // Guards (pure): can't deactivate self; can't remove the last active admin.
  const decision = canDeactivate(caller, toTarget(target), await otherActiveAdminCount(id));
  if (!decision.ok) return { ok: false, error: decision.error };

  await db
    .update(profiles)
    .set({ deactivatedAt: new Date(), updatedAt: new Date() })
    .where(eq(profiles.id, id));

  // Ban the auth user so token validation (getUser) fails immediately — kills
  // any live session on their next request, not at token expiry.
  await getServiceClient().auth.admin.updateUserById(id, {
    ban_duration: BAN_FOREVER,
  });

  revalidatePath("/settings/users");
  return { ok: true, message: "User deactivated." };
}

// -- Reactivate --------------------------------------------------------------

export async function reactivateUserAction(
  formData: FormData,
): Promise<UserActionResult> {
  try {
    await requireAdminCaller();
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const { id } = parsed.data;

  const [target] = await db.select().from(profiles).where(eq(profiles.id, id)).limit(1);
  if (!target) return { ok: false, error: "User not found." };

  await db
    .update(profiles)
    .set({ deactivatedAt: null, updatedAt: new Date() })
    .where(eq(profiles.id, id));

  await getServiceClient().auth.admin.updateUserById(id, {
    ban_duration: "none",
  });

  revalidatePath("/settings/users");
  return { ok: true, message: "User reactivated." };
}
