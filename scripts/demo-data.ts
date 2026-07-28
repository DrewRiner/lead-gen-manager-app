/**
 * Reversible demo-data system.
 *
 *   npm run demo:seed  -- --confirm
 *   npm run demo:clear -- --confirm
 *
 * NEVER deletes or recreates properties — the real ones stay. It modifies
 * property scalar fields (snapshotting them to scripts/.demo-snapshot.json
 * first) and adds tagged records that teardown removes precisely:
 *   - demo leads:       source_system = 'demo'
 *   - demo clients:     notes begins with '[DEMO]'
 *   - demo assignments: notes begins with '[DEMO]'
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { and, eq, isNull, like, sql } from "drizzle-orm";

import { evaluateLead } from "@/lib/billing/evaluate-lead";
import { db } from "@/lib/db";
import {
  clients,
  leads,
  properties,
  propertyAssignments,
  type NewLead,
  type NewPropertyAssignment,
  type Property,
} from "@/lib/db/schema";

const TZ = "America/New_York";
const SNAPSHOT_PATH = join(process.cwd(), "scripts", ".demo-snapshot.json");
const DEMO_TAG = "[DEMO]";

// -- CLI -------------------------------------------------------------------
const cmd = process.argv[2];
const confirmed = process.argv.includes("--confirm");

if (cmd !== "seed" && cmd !== "clear") {
  console.error("Usage: demo-data.ts <seed|clear> --confirm");
  process.exit(1);
}
if (!confirmed) {
  console.error(
    `\nRefusing to run "${cmd}" without --confirm. This writes to the LIVE database.\n` +
      `Re-run with:  npm run demo:${cmd} -- --confirm\n`,
  );
  process.exit(1);
}

// -- Deterministic helpers -------------------------------------------------
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(424242);
const randInt = (min: number, max: number) => Math.floor(rnd() * (max - min + 1)) + min;
const pick = <T>(a: T[]): T => a[Math.floor(rnd() * a.length)];
const money = (n: number) => n.toFixed(2);

const now = new Date();
const dayStr = (daysAgo: number): string => {
  const d = new Date(now);
  d.setDate(now.getDate() - daysAgo);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const FIRST = ["James", "Mary", "Robert", "Linda", "Michael", "Patricia", "David", "Jennifer", "Chris", "Susan", "Dan", "Karen"];
const LAST = ["Smith", "Johnson", "Williams", "Brown", "Garcia", "Miller", "Davis", "Wilson", "Anderson", "Thomas"];
const personName = () => `${pick(FIRST)} ${pick(LAST)}`;
const phone = () => {
  let d = "";
  for (let i = 0; i < 10; i++) d += i === 0 ? String(randInt(2, 9)) : String(randInt(0, 9));
  return `+1${d}`;
};

// ==========================================================================
async function seed() {
  // Guard: don't stack demo data.
  const existingDemo = await db
    .select({ id: clients.id })
    .from(clients)
    .where(like(clients.notes, `${DEMO_TAG}%`))
    .limit(1);
  if (existingDemo.length > 0) {
    console.error("Demo data already present. Run `npm run demo:clear -- --confirm` first.");
    process.exit(1);
  }

  const allProps = await db
    .select()
    .from(properties)
    .where(isNull(properties.deletedAt))
    .orderBy(properties.name);

  // -- 1. Snapshot every property before modifying anything ---------------
  const snapshot = allProps.map((p) => ({
    id: p.id,
    status: p.status,
    launched_on: p.launchedOn,
    target_monthly_rent: p.targetMonthlyRent,
    monthly_rate: p.monthlyRate,
    per_lead_call_rate: p.perLeadCallRate,
    per_lead_form_rate: p.perLeadFormRate,
    billing_type: p.billingType,
    client_id: p.clientId,
  }));
  writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2));
  console.log(`Snapshot written: ${SNAPSHOT_PATH} (${snapshot.length} properties)`);

  // -- 2. Demo clients ----------------------------------------------------
  const CLIENT_NAMES = [
    "Coastal Roofing Group",
    "Peachtree Home Services",
    "Lowcountry Exteriors",
    "Desert Air Mechanical",
    "Magnolia Property Group",
    "Summit Restoration Co",
  ];
  const insertedClients = await db
    .insert(clients)
    .values(
      CLIENT_NAMES.map((name) => ({
        businessName: name,
        contactName: personName(),
        email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`,
        phone: phone(),
        status: "active" as const,
        notes: `${DEMO_TAG} demo client`,
      })),
    )
    .returning({ id: clients.id });
  const clientId = (i: number) => insertedClients[i % insertedClients.length].id;

  // -- 3. Decide lifecycle for each property ------------------------------
  // Properties with a REAL active assignment keep it (count toward "rented");
  // we never touch real assignments. Everything else is reassigned a state.
  const realActive = await db
    .select({ propertyId: propertyAssignments.propertyId, startedOn: propertyAssignments.startedOn, clientId: propertyAssignments.clientId })
    .from(propertyAssignments)
    .where(and(isNull(propertyAssignments.endedOn), isNull(propertyAssignments.notes)));
  const realRentedIds = new Set(realActive.map((a) => a.propertyId));

  const nonReal = allProps.filter((p) => !realRentedIds.has(p.id));
  const demoRentedCount = Math.max(0, 4 - realRentedIds.size);

  // Slice the non-real properties into buckets.
  const buckets = {
    building: nonReal.slice(0, 2),
    optimizing: nonReal.slice(2, 4),
    producing: nonReal.slice(4, 9),
    rented: nonReal.slice(9, 9 + demoRentedCount),
  };

  // Realistic target rents by niche keyword.
  const targetForNiche = (niche: string | null): number => {
    const n = (niche ?? "").toLowerCase();
    if (n.includes("roof")) return randInt(1600, 2200);
    if (n.includes("water") || n.includes("restoration")) return randInt(1500, 2000);
    if (n.includes("hvac") || n.includes("ac")) return randInt(1300, 1800);
    if (n.includes("concrete") || n.includes("paver")) return randInt(1100, 1500);
    if (n.includes("tree") || n.includes("electric")) return randInt(900, 1300);
    if (n.includes("tow")) return randInt(500, 800);
    return randInt(800, 1200);
  };

  type PropPlan = {
    prop: Property;
    status: "building" | "optimizing" | "producing" | "rented";
    launchedDaysAgo: number | null;
    leadMode: "none" | "trickle" | "steady" | "steady-old" | "hot";
    drift?: "high-lead" | "stale";
  };
  const plans: PropPlan[] = [];

  buckets.building.forEach((prop) =>
    plans.push({ prop, status: "building", launchedDaysAgo: null, leadMode: "none" }),
  );
  buckets.optimizing.forEach((prop, i) =>
    plans.push({
      prop,
      status: "optimizing",
      launchedDaysAgo: randInt(60, 120),
      leadMode: i === 1 ? "hot" : "trickle",
      drift: i === 1 ? "high-lead" : undefined,
    }),
  );
  buckets.producing.forEach((prop, i) =>
    plans.push({
      prop,
      status: "producing",
      launchedDaysAgo: randInt(240, 540),
      leadMode: i === buckets.producing.length - 1 ? "steady-old" : "steady",
      drift: i === buckets.producing.length - 1 ? "stale" : undefined,
    }),
  );
  buckets.rented.forEach((prop) =>
    plans.push({ prop, status: "rented", launchedDaysAgo: randInt(240, 540), leadMode: "steady" }),
  );

  // -- 4. Assignment intervals per property (for lead client stamping) ----
  interface Interval { clientId: string; start: string; end: string | null }
  const intervalsByProperty = new Map<string, Interval[]>();
  const demoAssignments: NewPropertyAssignment[] = [];
  // Track which real-rented props exist so their leads stamp the real client.
  for (const a of realActive) {
    intervalsByProperty.set(a.propertyId, [{ clientId: a.clientId, start: a.startedOn, end: null }]);
  }

  const rentedPlans = plans.filter((p) => p.status === "rented");
  // Billing mix across demo-rented: flat, flat(rate change), hybrid.
  rentedPlans.forEach((plan, idx) => {
    const pid = plan.prop.id;
    const scenario = idx === 0 ? "sequential-gap" : idx === 1 ? "rate-change" : idx === 2 ? "handoff" : "single";
    const baseRate = randInt(900, 1800);
    const mk = (cIdx: number, start: number, end: number | null, rate: number, billing: "flat_monthly" | "hybrid"): void => {
      demoAssignments.push({
        propertyId: pid,
        clientId: clientId(cIdx),
        startedOn: dayStr(start),
        endedOn: end === null ? null : dayStr(end),
        billingType: billing,
        monthlyRate: money(rate),
        perLeadCallRate: billing === "hybrid" ? money(35) : money(0),
        perLeadFormRate: billing === "hybrid" ? money(20) : money(0),
        notes: `${DEMO_TAG} ${scenario}`,
      });
      const list = intervalsByProperty.get(pid) ?? [];
      list.push({ clientId: clientId(cIdx), start: dayStr(start), end: end === null ? null : dayStr(end) });
      intervalsByProperty.set(pid, list);
    };

    if (scenario === "sequential-gap") {
      mk(idx, 420, 270, baseRate, "flat_monthly"); // client A
      // vacant gap 270..210
      mk(idx + 3, 210, null, baseRate + 200, "flat_monthly"); // client B active
    } else if (scenario === "rate-change") {
      mk(idx, 360, 150, baseRate, "flat_monthly"); // same client, old rate
      mk(idx, 149, null, baseRate + 400, "flat_monthly"); // same client, new rate
    } else if (scenario === "handoff") {
      // client C ends mid-month, client D starts same month a few days later.
      mk(idx, 300, 95, baseRate, "hybrid");
      mk(idx + 2, 92, null, baseRate + 150, "hybrid");
    } else {
      mk(idx, randInt(120, 300), null, baseRate, "flat_monthly");
    }
  });

  // -- 5. Apply property field changes ------------------------------------
  for (const plan of plans) {
    const pid = plan.prop.id;
    const active = (intervalsByProperty.get(pid) ?? []).find((iv) => iv.end === null);
    const isRented = plan.status === "rented";
    // Match property billing/rate to the active assignment when rented.
    const activeAssignment = demoAssignments.find((a) => a.propertyId === pid && a.endedOn === null);

    await db
      .update(properties)
      .set({
        status: plan.status,
        launchedOn: plan.launchedDaysAgo != null ? dayStr(plan.launchedDaysAgo) : null,
        targetMonthlyRent: money(targetForNiche(plan.prop.niche)),
        clientId: isRented ? (active?.clientId ?? plan.prop.clientId) : plan.prop.clientId,
        billingType: activeAssignment?.billingType ?? plan.prop.billingType,
        monthlyRate: activeAssignment?.monthlyRate ?? plan.prop.monthlyRate,
        perLeadCallRate: activeAssignment?.perLeadCallRate ?? plan.prop.perLeadCallRate,
        perLeadFormRate: activeAssignment?.perLeadFormRate ?? plan.prop.perLeadFormRate,
        updatedAt: new Date(),
      })
      .where(eq(properties.id, pid));
  }
  if (demoAssignments.length > 0) {
    await db.insert(propertyAssignments).values(demoAssignments);
  }

  // -- 6. Leads (9 months, tagged source_system='demo') -------------------
  const activeClientAt = (pid: string, d: string): string | null => {
    for (const iv of intervalsByProperty.get(pid) ?? []) {
      if (iv.start <= d && (iv.end === null || iv.end >= d)) return iv.clientId;
    }
    return null;
  };
  const monthlyVolume: Record<PropPlan["leadMode"], number> = {
    none: 0, trickle: 4, steady: 22, "steady-old": 18, hot: 36,
  };
  const seasonalMult = (niche: string | null, d: Date): number => {
    const n = (niche ?? "").toLowerCase();
    const zoned = toZonedTime(d, TZ);
    const m = zoned.getMonth(); // 0-11
    let mult = 1;
    // Roofing spikes after a storm ~2 months ago.
    if (n.includes("roof")) {
      const stormMonth = toZonedTime(new Date(now.getTime() - 60 * 86400000), TZ).getMonth();
      if (m === stormMonth) mult *= 2.5;
    }
    // Tree service higher in late summer (Jul-Sep).
    if (n.includes("tree") && (m === 6 || m === 7 || m === 8)) mult *= 1.8;
    return mult;
  };

  const leadRows: NewLead[] = [];
  const HORIZON = 275; // ~9 months
  for (const plan of plans) {
    if (plan.leadMode === "none") continue;
    const prop = plan.prop;
    const perDay = monthlyVolume[plan.leadMode] / 30;
    for (let day = HORIZON; day >= 0; day--) {
      // stale drift: no leads in the last 30 days.
      if (plan.leadMode === "steady-old" && day < 31) continue;
      const d = new Date(now);
      d.setDate(now.getDate() - day);
      const dow = d.getDay();
      const weekday = dow !== 0 && dow !== 6;
      let lambda = perDay * (weekday ? 1.25 : 0.4);
      lambda *= seasonalMult(prop.niche, d);
      // Poisson-ish: expected lambda with variance.
      let count = Math.floor(lambda);
      if (rnd() < lambda - count) count += 1;
      if (weekday && rnd() < 0.12) count += randInt(0, 2); // bursty variance

      for (let i = 0; i < count; i++) {
        const isCall = rnd() < 0.65;
        const type = isCall ? ("call" as const) : ("form" as const);
        let callDurationSeconds: number | null = null;
        if (isCall) {
          const roll = rnd();
          if (roll < 0.04) callDurationSeconds = null; // pending_review
          else if (roll < 0.29) callDurationSeconds = randInt(3, 59); // under threshold
          else callDurationSeconds = randInt(60, 900);
        }
        const isSpam = !isCall && rnd() < 0.06;

        const dayISO = dayStr(day);
        const stampClient = activeClientAt(prop.id, dayISO);
        const decision = evaluateLead(
          { type, callDurationSeconds },
          {
            billingType: prop.billingType,
            perLeadCallRate: prop.perLeadCallRate,
            perLeadFormRate: prop.perLeadFormRate,
            estimatedCallValue: prop.estimatedCallValue,
            estimatedFormValue: prop.estimatedFormValue,
            billableThresholdSeconds: prop.billableThresholdSeconds,
          },
        );
        const occurredAt = fromZonedTime(
          new Date(d.getFullYear(), d.getMonth(), d.getDate(), randInt(7, 19), randInt(0, 59)),
          TZ,
        );
        leadRows.push({
          propertyId: prop.id,
          clientId: stampClient,
          type,
          source: pick(["organic", "organic", "organic", "gbp", "gbp", "direct"] as const),
          callerName: personName(),
          callerPhone: phone(),
          callerEmail: type === "form" ? "lead@example.com" : null,
          message: type === "form" ? (isSpam ? "CHEAP SEO SERVICES!!! visit my site" : "Requesting a quote.") : null,
          callDurationSeconds,
          billableStatus: isSpam ? "spam" : decision.billableStatus,
          billableReason: isSpam ? "manual_spam" : decision.billableReason,
          qualifiedBy: isSpam ? "manual" : decision.qualifiedBy,
          billedAmount: isSpam ? "0.00" : decision.billedAmount,
          estimatedValue: isSpam ? "0.00" : decision.estimatedValue,
          deliveryStatus: "new",
          sourceSystem: "demo",
          occurredAt,
        });
      }
    }
  }
  for (let i = 0; i < leadRows.length; i += 300) {
    await db.insert(leads).values(leadRows.slice(i, i + 300));
  }

  // -- 7. Summary + expected dashboard counts -----------------------------
  const byStatus = { building: 0, optimizing: 0, producing: 0, rented: 0, paused: 0 } as Record<string, number>;
  for (const plan of plans) byStatus[plan.status]++;
  for (const id of realRentedIds) byStatus.rented++; // real rented not in plans

  console.log("\n=== demo:seed summary ===");
  console.table({
    "demo clients": insertedClients.length,
    "demo assignments": demoAssignments.length,
    "demo leads": leadRows.length,
    "properties modified": plans.length,
  });
  console.log("Property statuses now:", byStatus);
  console.log("\n=== Expected on the dashboard ===");
  console.log(
    `Pipeline strip — Building: ${byStatus.building}, Optimizing: ${byStatus.optimizing}, ` +
      `Producing: ${byStatus.producing}, Rented: ${byStatus.rented}`,
  );
  console.log("Status-review flags: expect >= 2 (one optimizing with 30+ leads, one stale producing).");
  console.log(`Total demo leads over ~9 months: ${leadRows.length}`);
  process.exit(0);
}

// ==========================================================================
async function clear() {
  const hasSnapshot = existsSync(SNAPSHOT_PATH);

  const demoLeads = await db.delete(leads).where(eq(leads.sourceSystem, "demo")).returning({ id: leads.id });
  const demoAssignments = await db
    .delete(propertyAssignments)
    .where(like(propertyAssignments.notes, `${DEMO_TAG}%`))
    .returning({ id: propertyAssignments.id });

  let restored = 0;
  if (hasSnapshot) {
    const snap: Array<{
      id: string; status: string; launched_on: string | null; target_monthly_rent: string;
      monthly_rate: string; per_lead_call_rate: string; per_lead_form_rate: string;
      billing_type: string; client_id: string | null;
    }> = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));
    for (const s of snap) {
      await db
        .update(properties)
        .set({
          status: s.status as never,
          launchedOn: s.launched_on,
          targetMonthlyRent: s.target_monthly_rent,
          monthlyRate: s.monthly_rate,
          perLeadCallRate: s.per_lead_call_rate,
          perLeadFormRate: s.per_lead_form_rate,
          billingType: s.billing_type as never,
          clientId: s.client_id,
          updatedAt: new Date(),
        })
        .where(eq(properties.id, s.id));
      restored++;
    }
  } else {
    console.warn(
      "\n!!! No snapshot file (scripts/.demo-snapshot.json). Tagged demo records\n" +
        "!!! were deleted, but PROPERTY FIELDS (status, launched_on, target rent,\n" +
        "!!! rates, billing type, client_id) CANNOT be restored automatically.\n" +
        "!!! Any property currently not 'rented'/matching its assignment likely\n" +
        "!!! was changed by demo:seed — review these manually:",
    );
    const suspects = await db
      .select({ name: properties.name, status: properties.status, launchedOn: properties.launchedOn })
      .from(properties)
      .where(isNull(properties.deletedAt))
      .orderBy(properties.name);
    for (const s of suspects) console.warn(`    - ${s.name}: status=${s.status}, launched_on=${s.launchedOn ?? "null"}`);
  }

  // Demo clients last (assignments referencing them are already gone).
  const demoClients = await db.delete(clients).where(like(clients.notes, `${DEMO_TAG}%`)).returning({ id: clients.id });

  if (hasSnapshot) rmSync(SNAPSHOT_PATH);

  console.log("\n=== demo:clear summary ===");
  console.table({
    "demo leads removed": demoLeads.length,
    "demo assignments removed": demoAssignments.length,
    "demo clients removed": demoClients.length,
    "properties restored": restored,
  });
  const [{ p }] = await db.select({ p: sql<number>`count(*)::int` }).from(properties).where(isNull(properties.deletedAt));
  console.log(`Properties in database: ${p} (unchanged — never deleted).`);
  process.exit(0);
}

// ==========================================================================
(cmd === "seed" ? seed() : clear()).catch((err) => {
  console.error(err);
  process.exit(1);
});
