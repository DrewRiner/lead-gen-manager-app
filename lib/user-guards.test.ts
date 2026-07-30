import { describe, expect, it } from "vitest";

import {
  authorizeAdmin,
  canChangeRole,
  canDeactivate,
  type Actor,
  type Target,
} from "@/lib/user-guards";

const admin: Actor = { id: "a1", role: "admin", deactivated: false };
const member: Actor = { id: "m1", role: "member", deactivated: false };

describe("authorizeAdmin", () => {
  it("allows an active admin", () => {
    expect(authorizeAdmin(admin).ok).toBe(true);
  });
  it("rejects a member", () => {
    expect(authorizeAdmin(member).ok).toBe(false);
  });
  it("rejects a deactivated admin", () => {
    expect(authorizeAdmin({ ...admin, deactivated: true }).ok).toBe(false);
  });
  it("rejects a missing profile", () => {
    expect(authorizeAdmin(null).ok).toBe(false);
  });
});

describe("canDeactivate", () => {
  const otherAdmin: Target = { id: "a2", role: "admin", deactivated: false };

  it("blocks deactivating your own account", () => {
    const self: Target = { id: "a1", role: "admin", deactivated: false };
    const r = canDeactivate(admin, self, 5);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/own account/i);
  });

  it("allows deactivating another admin when other active admins remain", () => {
    expect(canDeactivate(admin, otherAdmin, 1).ok).toBe(true);
  });

  it("blocks deactivating the last active admin (zero others)", () => {
    const r = canDeactivate(admin, otherAdmin, 0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/last active admin/i);
  });

  it("allows deactivating a member regardless of admin count", () => {
    const m: Target = { id: "m2", role: "member", deactivated: false };
    expect(canDeactivate(admin, m, 0).ok).toBe(true);
  });

  it("is a no-op on an already-deactivated user", () => {
    expect(
      canDeactivate(admin, { ...otherAdmin, deactivated: true }, 0).ok,
    ).toBe(true);
  });
});

describe("canChangeRole", () => {
  it("blocks demoting the last active admin (self)", () => {
    const selfAdmin: Target = { id: "a1", role: "admin", deactivated: false };
    const r = canChangeRole(admin, selfAdmin, "member", 0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/last active admin/i);
  });

  it("allows self-demotion when another active admin exists", () => {
    const selfAdmin: Target = { id: "a1", role: "admin", deactivated: false };
    expect(canChangeRole(admin, selfAdmin, "member", 1).ok).toBe(true);
  });

  it("blocks demoting the last active admin (other)", () => {
    const other: Target = { id: "a2", role: "admin", deactivated: false };
    expect(canChangeRole(admin, other, "member", 0).ok).toBe(false);
  });

  it("allows promoting a member to admin", () => {
    const m: Target = { id: "m1", role: "member", deactivated: false };
    expect(canChangeRole(admin, m, "admin", 0).ok).toBe(true);
  });

  it("does not treat a deactivated admin as the last active admin", () => {
    // Demoting an already-deactivated admin isn't demoting an ACTIVE admin.
    const off: Target = { id: "a2", role: "admin", deactivated: true };
    expect(canChangeRole(admin, off, "member", 0).ok).toBe(true);
  });
});
