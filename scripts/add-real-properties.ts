/**
 * One-off, idempotent loader for real properties (NOT seed data).
 * Matches on domain: inserts when missing, updates when present, skips when
 * already identical. Also applies a targeted fix to an existing record.
 *
 * Run: node --env-file=.env.local --import tsx scripts/add-real-properties.ts
 *
 * Uses the app's Drizzle insert path so schema defaults (timestamps, etc.) and
 * money formatting are consistent. No APP_ENV guard: this writes real data.
 */
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { properties } from "@/lib/db/schema";
import { toMoneyString } from "@/lib/money";

interface Target {
  name: string;
  domain: string;
  niche: string;
  city: string;
  state: string;
  trackingPhone: string | null;
  est: number;
  notes?: string;
}

const TARGETS: Target[] = [
  { name: "Brunswick Tree Service", domain: "brunswicktreeservice.com", niche: "Tree Service", city: "Brunswick", state: "GA", trackingPhone: "+19122740007", est: 25 },
  { name: "Brunswick Painting Pros", domain: "brunswickpaintingpros.com", niche: "Painting", city: "Brunswick", state: "GA", trackingPhone: "+19124552716", est: 25 },
  { name: "Sumter Roofing Company", domain: "sumterroofingcompany.com", niche: "Roofing", city: "Sumter", state: "SC", trackingPhone: "+18033731022", est: 50 },
  { name: "Brunswick Concrete Contractors", domain: "brunswickconcrete.com", niche: "Concrete", city: "Brunswick", state: "GA", trackingPhone: "+19124465758", est: 50 },
  { name: "Brunswick Pavers & Installation", domain: "brunswickpavers.com", niche: "Pavers", city: "Brunswick", state: "GA", trackingPhone: "+19124465765", est: 30 },
  { name: "Arrow Concrete Contractors", domain: "arrowconcretecontractors.com", niche: "Concrete", city: "Auburn", state: "AL", trackingPhone: "+13343609977", est: 50 },
  { name: "Newnan Fence Company", domain: "fencecompanynewnanga.com", niche: "Fence", city: "Newnan", state: "GA", trackingPhone: null, est: 40 },
  { name: "Jackson Appliance Repair Company", domain: "jacksonappliancerepairco.com", niche: "Appliance Repair", city: "Jackson", state: "MS", trackingPhone: "+16012025353", est: 25 },
  { name: "Scottsdale Tow Truck Company", domain: "scottsdaletowtruckcompany.com", niche: "Towing", city: "Scottsdale", state: "AZ", trackingPhone: "+14807393500", est: 20 },
  { name: "Tree Service Surprise", domain: "surprise-tree-services.com", niche: "Tree Service", city: "Surprise", state: "AZ", trackingPhone: "+16233002080", est: 25 },
  { name: "Brunswick Roofing Company", domain: "brunswickroofingcompany.com", niche: "Roofing", city: "Brunswick", state: "GA", trackingPhone: "+19123725860", est: 50 },
  { name: "Window Tinting Yuma", domain: "windowtintingyuma.com", niche: "Window Tinting", city: "Yuma", state: "AZ", trackingPhone: "+19282206070", est: 30, notes: "Physical address: 1102 E 21st St D, Yuma, AZ 85365" },
];

function desiredFields(t: Target) {
  return {
    name: t.name,
    displayName: t.name,
    domain: t.domain,
    niche: t.niche,
    city: t.city,
    state: t.state,
    // Numbers are already E.164, so no normalization is needed (and it keeps
    // this standalone script free of the libphonenumber ESM/CJS loader).
    trackingPhone: t.trackingPhone,
    status: "available" as const,
    billingType: "flat_monthly" as const,
    monthlyRate: toMoneyString(0),
    billableThresholdSeconds: 60,
    estimatedCallValue: toMoneyString(t.est),
    estimatedFormValue: toMoneyString(t.est),
    notes: t.notes ?? null,
  };
}

async function main() {
  const inserted: string[] = [];
  const updated: string[] = [];
  const skipped: string[] = [];
  const warnings: string[] = [];

  for (const t of TARGETS) {
    const desired = desiredFields(t);
    const [existing] = await db
      .select()
      .from(properties)
      .where(eq(properties.domain, t.domain))
      .limit(1);

    if (!existing) {
      // client_id omitted -> defaults null.
      await db.insert(properties).values(desired);
      inserted.push(t.domain);
      continue;
    }

    // Don't force status/client on a property that has since been assigned.
    const patch: Record<string, unknown> = { ...desired };
    if (existing.clientId != null) {
      delete patch.status;
      warnings.push(
        `${t.domain}: has an assigned client; left status as "${existing.status}".`,
      );
    }

    const differs = Object.entries(patch).some(
      ([k, v]) => (existing as Record<string, unknown>)[k] !== v,
    );
    if (!differs) {
      skipped.push(t.domain);
      continue;
    }
    await db
      .update(properties)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(properties.id, existing.id));
    updated.push(t.domain);
  }

  // --- Targeted fix: existing Brunswick Fence Company --------------------
  const fenceDomain = "brunswickfencecompany.com";
  const [fence] = await db
    .select()
    .from(properties)
    .where(eq(properties.domain, fenceDomain))
    .limit(1);
  if (!fence) {
    warnings.push(`${fenceDomain}: not found — nothing to fix.`);
  } else {
    const patch: Record<string, unknown> = {
      city: "Brunswick", // was misspelled "Brusnwick"
      estimatedCallValue: toMoneyString(40),
      estimatedFormValue: toMoneyString(40),
    };
    if (fence.clientId == null) {
      patch.status = "available";
    } else {
      warnings.push(
        `${fenceDomain}: has an assigned client (active assignment) — did NOT set status to "available". Unassign the client first if it should be available.`,
      );
    }
    const differs = Object.entries(patch).some(
      ([k, v]) => (fence as Record<string, unknown>)[k] !== v,
    );
    if (differs) {
      await db
        .update(properties)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(properties.id, fence.id));
      updated.push(fenceDomain);
    } else {
      skipped.push(fenceDomain);
    }
  }

  console.log("=== Result ===");
  console.log(`Inserted (${inserted.length}): ${inserted.join(", ") || "—"}`);
  console.log(`Updated  (${updated.length}): ${updated.join(", ") || "—"}`);
  console.log(`Skipped  (${skipped.length}): ${skipped.join(", ") || "—"}`);
  if (warnings.length) {
    console.log("\n=== Warnings ===");
    for (const w of warnings) console.log(`! ${w}`);
  }

  // --- Verification table ------------------------------------------------
  const all = await db
    .select({
      name: properties.name,
      domain: properties.domain,
      niche: properties.niche,
      city: properties.city,
      state: properties.state,
      status: properties.status,
      estCall: properties.estimatedCallValue,
      deletedAt: properties.deletedAt,
    })
    .from(properties)
    .orderBy(properties.name);

  console.log(`\n=== All properties (${all.length}) ===`);
  const header = ["name", "domain", "niche", "city", "state", "status", "est_call"];
  const rows = all.map((r) => [
    r.name,
    r.domain ?? "",
    r.niche ?? "",
    r.city ?? "",
    r.state ?? "",
    r.status + (r.deletedAt ? " (deleted)" : ""),
    r.estCall,
  ]);
  const widths = header.map((h, i) =>
    Math.max(h.length, ...rows.map((row) => String(row[i]).length)),
  );
  const fmt = (cols: unknown[]) =>
    cols.map((c, i) => String(c).padEnd(widths[i])).join("  ");
  console.log(fmt(header));
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  for (const row of rows) console.log(fmt(row));

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
