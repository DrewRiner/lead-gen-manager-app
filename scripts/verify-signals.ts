/**
 * READ-ONLY verification of the producing-health and routing signals against
 * whatever is currently in the connected database. Makes NO writes and does not
 * require the new migrations (0008–0010) to be applied: it selects only columns
 * that already exist and uses the default thresholds (min 4 billable, 2 of 3
 * months). short_code is null pre-migration and never changes routing status.
 *
 *   node --env-file=.env.local --import tsx scripts/verify-signals.ts
 */
import { and, asc, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { appSettings, properties } from "@/lib/db/schema";
import { computeRoutingStatuses } from "@/lib/routing-status";
import { getProducingHealthMap } from "@/lib/queries/producing-health";

async function main() {
  // Org timezone — select ONLY this column so the not-yet-migrated producing_*
  // columns are never referenced.
  const [tzRow] = await db
    .select({ tz: appSettings.orgTimezone })
    .from(appSettings)
    .where(eq(appSettings.id, 1))
    .limit(1);
  const tz = tzRow?.tz ?? "America/New_York";

  const props = await db
    .select({
      id: properties.id,
      name: properties.name,
      status: properties.status,
      ghlLeadSource: properties.ghlLeadSource,
      ghlFormId: properties.ghlFormId,
      domain: properties.domain,
    })
    .from(properties)
    .where(isNull(properties.deletedAt))
    .orderBy(asc(properties.name));

  console.log(`\nTimezone: ${tz}`);
  console.log(`Properties (non-deleted): ${props.length}\n`);

  // -- Routing verification --------------------------------------------------
  const statuses = computeRoutingStatuses(props);
  const buckets = { mapped: [] as string[], missing: [] as string[], duplicate: [] as string[] };
  for (const p of props) {
    const s = statuses.get(p.id)!;
    buckets[s].push(p.name);
  }

  console.log("=== ROUTING STATUS ===");
  console.log(
    `Mapped: ${buckets.mapped.length}  |  Missing: ${buckets.missing.length}  |  Duplicate: ${buckets.duplicate.length}`,
  );
  for (const p of props) {
    const s = statuses.get(p.id)!;
    const src = p.ghlLeadSource ? `"${p.ghlLeadSource}"` : "(none)";
    console.log(`  [${s.toUpperCase().padEnd(9)}] ${p.name} — lead_source ${src}`);
  }

  // -- Producing-health verification ----------------------------------------
  const health = await getProducingHealthMap(tz, {
    minBillableLeads: 4,
    monthsRequired: 2,
  });
  const monthsLabel = health.months.map((m) => m.shortLabel).join(", ");

  const overstated: string[] = [];
  const understated: string[] = [];
  const matched: string[] = [];
  const byId = new Map(props.map((p) => [p.id, p]));

  console.log(`\n=== PRODUCING HEALTH (billable-only; months: ${monthsLabel}) ===`);
  for (const [id, h] of health.map) {
    const p = byId.get(id);
    if (!p) continue;
    const line = `${p.name} [${p.status}] — 30d=${h.billable30d}, months=[${h.monthlyBillable.join(
      "/",
    )}], momentum=${h.health.momentum}`;
    if (h.health.signal === "overstated") overstated.push(`${line} :: ${h.health.reason}`);
    else if (h.health.signal === "understated") understated.push(`${line} :: ${h.health.reason}`);
    else if (h.health.signal === "match") matched.push(line);
  }

  console.log(`\n-- OVERSTATED (marked producing, data disagrees): ${overstated.length}`);
  overstated.forEach((l) => console.log(`  ⚠ ${l}`));
  console.log(`\n-- UNDERSTATED (pre-launch but meets the bar): ${understated.length}`);
  understated.forEach((l) => console.log(`  ◆ ${l}`));
  console.log(`\n-- CONFIRMED producing (green): ${matched.length}`);
  matched.forEach((l) => console.log(`  ✓ ${l}`));

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
