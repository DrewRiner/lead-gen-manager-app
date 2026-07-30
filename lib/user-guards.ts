// ---------------------------------------------------------------------------
// Pure authorization guards for user management. No DB, no session — the caller
// resolves the actor's profile and the active-admin count, then asks these
// functions for a decision. Kept pure so every rule is unit-tested:
//   • only active admins may manage users
//   • an admin can't deactivate their own account
//   • there must ALWAYS be at least one active admin (block the last one from
//     being deactivated or demoted)
// ---------------------------------------------------------------------------

export type Role = "admin" | "member";

export interface Actor {
  id: string;
  role: Role;
  deactivated: boolean;
}

export interface Target {
  id: string;
  role: Role;
  deactivated: boolean;
}

export type GuardResult = { ok: true } | { ok: false; error: string };

const OK: GuardResult = { ok: true };

/** The caller must be an active admin to manage users at all. */
export function authorizeAdmin(actor: Actor | null | undefined): GuardResult {
  if (!actor || actor.deactivated || actor.role !== "admin") {
    return { ok: false, error: "Not authorized: admin access required." };
  }
  return OK;
}

/**
 * Can `actor` deactivate `target`?
 * @param otherActiveAdmins active admins OTHER than the target.
 */
export function canDeactivate(
  actor: Actor,
  target: Target,
  otherActiveAdmins: number,
): GuardResult {
  if (target.id === actor.id) {
    return { ok: false, error: "You can't deactivate your own account." };
  }
  if (target.deactivated) return OK; // already off — no-op
  if (target.role === "admin" && otherActiveAdmins === 0) {
    return {
      ok: false,
      error: "This is the last active admin — there must always be at least one.",
    };
  }
  return OK;
}

/**
 * Can `actor` change `target`'s role to `newRole`?
 * @param otherActiveAdmins active admins OTHER than the target.
 */
export function canChangeRole(
  actor: Actor,
  target: Target,
  newRole: Role,
  otherActiveAdmins: number,
): GuardResult {
  const demotingActiveAdmin =
    target.role === "admin" && newRole === "member" && !target.deactivated;
  if (demotingActiveAdmin && otherActiveAdmins === 0) {
    return {
      ok: false,
      error:
        actor.id === target.id
          ? "You are the last active admin — promote another admin before demoting yourself."
          : "This is the last active admin — there must always be at least one.",
    };
  }
  return OK;
}
