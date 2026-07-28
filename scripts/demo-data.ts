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
import { recentMonths } from "@/lib/dates";
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
import { getMonthlyReport } from "@/lib/queries/metrics";
import { getAppSettings } from "@/lib/settings";

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
    estimated_call_value: p.estimatedCallValue,
    estimated_form_value: p.estimatedFormValue,
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

  // Flat monthly rent by niche, spread across $500-2500: roofing/concrete top,
  // painting/pavers/fence/tree in the middle, towing/appliance at the bottom.
  const rentForNiche = (niche: string | null): number => {
    const n = (niche ?? "").toLowerCase();
    if (n.includes("roof")) return randInt(2300, 2500);
    if (n.includes("concrete")) return randInt(2100, 2400);
    if (n.includes("water") || n.includes("restoration")) return randInt(1900, 2200);
    if (n.includes("hvac") || n.includes("ac")) return randInt(1600, 1900);
    if (n.includes("electric")) return randInt(1400, 1700);
    if (n.includes("paver")) return randInt(1200, 1500);
    if (n.includes("fence")) return randInt(1100, 1400);
    if (n.includes("tree")) return randInt(1000, 1300);
    if (n.includes("paint")) return randInt(900, 1200);
    if (n.includes("window")) return randInt(800, 1100);
    if (n.includes("appliance")) return randInt(600, 850);
    if (n.includes("tow")) return randInt(500, 750);
    return randInt(1200, 1600);
  };
  const targetForNiche = (niche: string | null): number => rentForNiche(niche) + randInt(150, 450);

  // Estimated market value per lead by niche (higher than the stored real
  // values so the gap is meaningful; snapshotted, so restored on clear).
  const estForNiche = (niche: string | null): { call: number; form: number } => {
    const n = (niche ?? "").toLowerCase();
    if (n.includes("roof")) return { call: 78, form: 58 };
    if (n.includes("water") || n.includes("restoration")) return { call: 72, form: 54 };
    if (n.includes("hvac") || n.includes("ac")) return { call: 62, form: 46 };
    if (n.includes("concrete")) return { call: 56, form: 42 };
    if (n.includes("paver")) return { call: 46, form: 34 };
    if (n.includes("electric")) return { call: 52, form: 38 };
    if (n.includes("tree")) return { call: 44, form: 32 };
    if (n.includes("fence")) return { call: 42, form: 30 };
    if (n.includes("paint")) return { call: 36, form: 26 };
    if (n.includes("window")) return { call: 32, form: 24 };
    if (n.includes("appliance")) return { call: 34, form: 25 };
    if (n.includes("tow")) return { call: 24, form: 18 };
    return { call: 44, form: 33 };
  };
  const perLeadRates = (niche: string | null, hybrid: boolean) => {
    const e = estForNiche(niche);
    // Per-lead charge is a fraction of market value (you charge below market).
    const f = hybrid ? 0.7 : 0.95;
    return { call: Math.round(e.call * f), form: Math.round(e.form * f) };
  };
  // Fixed niche rank (no randomness) for ordering properties into roles.
  const nicheRank = (niche: string | null): number => {
    const n = (niche ?? "").toLowerCase();
    if (n.includes("roof")) return 2400;
    if (n.includes("concrete")) return 2250;
    if (n.includes("water") || n.includes("restoration")) return 2050;
    if (n.includes("hvac") || n.includes("ac")) return 1750;
    if (n.includes("electric")) return 1550;
    if (n.includes("paver")) return 1350;
    if (n.includes("fence")) return 1250;
    if (n.includes("tree")) return 1150;
    if (n.includes("paint")) return 1050;
    if (n.includes("window")) return 950;
    if (n.includes("appliance")) return 725;
    if (n.includes("tow")) return 625;
    return 1400;
  };

  type Billing = "flat_monthly" | "per_lead" | "hybrid";

  // Each interval carries the billing active during it, so a lead bills exactly
  // as its assignment would: a trial interval books zero, an unrented period
  // defaults to flat $0, and a paid per_lead/hybrid interval charges per lead.
  interface Interval {
    clientId: string;
    start: string;
    end: string | null;
    billingType: Billing;
    perLeadCall: string;
    perLeadForm: string;
    isTrial: boolean;
  }
  const intervalsByProperty = new Map<string, Interval[]>();
  const demoAssignments: NewPropertyAssignment[] = [];
  for (const a of realActive) {
    intervalsByProperty.set(a.propertyId, [
      { clientId: a.clientId, start: a.startedOn, end: null, billingType: "flat_monthly", perLeadCall: money(0), perLeadForm: money(0), isTrial: false },
    ]);
  }

  // Lifecycle roles for the 12 non-real properties (name-sorted): 1 building,
  // 1 optimizing, 2 producing, 2 trial, 6 rented.
  type Role =
    | "building" | "optimizing" | "producing-stale" | "producing-ended-trial"
    | "trial-active" | "trial-expired" | "rented-converted" | "rented-seqgap"
    | "rented-ratechange" | "rented-handoff" | "rented-single";
  interface Plan {
    prop: Property;
    status: "building" | "optimizing" | "producing" | "trial" | "rented";
    launchedDaysAgo: number | null;
    monthly: number;
    staleOld?: boolean;
    role: Role;
  }
  // Flat-rented roles first so the highest-value niches become paid rentals;
  // per_lead / trial / producing / building take the lower niches.
  const ROLES: { role: Role; status: Plan["status"]; launched: number | null; monthly: number; staleOld?: boolean }[] = [
    { role: "rented-ratechange", status: "rented", launched: randInt(300, 500), monthly: 56 },
    { role: "rented-converted", status: "rented", launched: randInt(240, 420), monthly: 58 },
    { role: "rented-converted", status: "rented", launched: randInt(240, 420), monthly: 58 },
    { role: "rented-seqgap", status: "rented", launched: randInt(300, 500), monthly: 56 },
    { role: "rented-handoff", status: "rented", launched: randInt(240, 420), monthly: 68 }, // hybrid
    { role: "rented-single", status: "rented", launched: randInt(120, 300), monthly: 98 }, // per_lead
    { role: "producing-stale", status: "producing", launched: randInt(200, 400), monthly: 55, staleOld: true }, // stale drift
    { role: "producing-ended-trial", status: "producing", launched: randInt(140, 280), monthly: 48 },
    { role: "trial-active", status: "trial", launched: randInt(150, 300), monthly: 54 },
    { role: "trial-expired", status: "trial", launched: randInt(150, 300), monthly: 48 },
    { role: "optimizing", status: "optimizing", launched: randInt(60, 110), monthly: 40 }, // high-lead drift
    { role: "building", status: "building", launched: null, monthly: 0 },
  ];
  const ordered = [...nonReal].sort(
    (a, b) => nicheRank(b.niche) - nicheRank(a.niche) || a.name.localeCompare(b.name),
  );
  const plans: Plan[] = ordered.slice(0, ROLES.length).map((prop, i) => ({
    prop, status: ROLES[i].status, launchedDaysAgo: ROLES[i].launched,
    monthly: ROLES[i].monthly, staleOld: ROLES[i].staleOld, role: ROLES[i].role,
  }));

  const pushInterval = (pid: string, cIdx: number, start: number, end: number | null, billing: Billing, pl: { call: number; form: number }, isTrial: boolean) => {
    const list = intervalsByProperty.get(pid) ?? [];
    list.push({ clientId: clientId(cIdx), start: dayStr(start), end: end === null ? null : dayStr(end), billingType: billing, perLeadCall: money(pl.call), perLeadForm: money(pl.form), isTrial });
    intervalsByProperty.set(pid, list);
  };
  const addPaid = (pid: string, cIdx: number, start: number, end: number | null, billing: Billing, rent: number, pl: { call: number; form: number }, note: string) => {
    demoAssignments.push({
      propertyId: pid, clientId: clientId(cIdx), startedOn: dayStr(start), endedOn: end === null ? null : dayStr(end),
      billingType: billing,
      monthlyRate: billing === "per_lead" ? money(0) : money(rent),
      perLeadCallRate: billing === "flat_monthly" ? money(0) : money(pl.call),
      perLeadFormRate: billing === "flat_monthly" ? money(0) : money(pl.form),
      isTrial: false, trialEndsOn: null, notes: `${DEMO_TAG} ${note}`,
    });
    pushInterval(pid, cIdx, start, end, billing, pl, false);
  };
  const addTrial = (pid: string, cIdx: number, start: number, end: number | null, trialEndsDaysAgo: number, note: string) => {
    demoAssignments.push({
      propertyId: pid, clientId: clientId(cIdx), startedOn: dayStr(start), endedOn: end === null ? null : dayStr(end),
      billingType: "flat_monthly", monthlyRate: money(0), perLeadCallRate: money(0), perLeadFormRate: money(0),
      isTrial: true, trialEndsOn: dayStr(trialEndsDaysAgo), notes: `${DEMO_TAG} ${note}`,
    });
    pushInterval(pid, cIdx, start, end, "flat_monthly", { call: 0, form: 0 }, true);
  };

  let convertedSeen = 0;
  for (const plan of plans) {
    const pid = plan.prop.id;
    const rent = rentForNiche(plan.prop.niche);
    const hy = perLeadRates(plan.prop.niche, true);
    const pl = perLeadRates(plan.prop.niche, false);
    switch (plan.role) {
      case "producing-ended-trial":
        addTrial(pid, 5, 70, 45, 45, "trial-ended"); // trial ended without converting
        break;
      case "trial-active":
        addTrial(pid, 0, 5, null, -9, "trial-active"); // day 5 of 14 (ends in 9 days)
        break;
      case "trial-expired":
        addTrial(pid, 1, 17, null, 3, "trial-expired"); // ended 3 days ago, unresolved
        break;
      case "rented-converted": {
        const c = convertedSeen === 0 ? { cl: 2, t0: 130, t1: 100, p: 99 } : { cl: 3, t0: 110, t1: 80, p: 79 };
        convertedSeen++;
        addTrial(pid, c.cl, c.t0, c.t1, c.t1, "trial-converted");
        addPaid(pid, c.cl, c.p, null, "flat_monthly", rent, pl, "converted-paid");
        break;
      }
      case "rented-seqgap":
        addPaid(pid, 4, 400, 250, "flat_monthly", Math.round(rent * 0.85), pl, "sequential-gap");
        addPaid(pid, 0, 200, null, "flat_monthly", rent, pl, "sequential-gap");
        break;
      case "rented-ratechange":
        addPaid(pid, 1, 360, 150, "flat_monthly", Math.round(rent * 0.8), pl, "rate-change");
        addPaid(pid, 1, 149, null, "flat_monthly", rent, pl, "rate-change"); // raised to target
        break;
      case "rented-handoff":
        addPaid(pid, 2, 300, 95, "hybrid", Math.round(rent * 0.9), hy, "handoff");
        addPaid(pid, 4, 92, null, "hybrid", rent, hy, "handoff");
        break;
      case "rented-single":
        addPaid(pid, 5, 200, null, "per_lead", 0, pl, "single");
        break;
      // building / optimizing / producing-stale: unrented, no assignment.
    }
  }

  // -- Apply property field changes --------------------------------------
  for (const plan of plans) {
    const pid = plan.prop.id;
    const active = demoAssignments.find((a) => a.propertyId === pid && a.endedOn === null);
    const e = estForNiche(plan.prop.niche);
    const isEngaged = plan.status === "rented" || plan.status === "trial";
    await db
      .update(properties)
      .set({
        status: plan.status,
        launchedOn: plan.launchedDaysAgo != null ? dayStr(plan.launchedDaysAgo) : null,
        targetMonthlyRent: money(targetForNiche(plan.prop.niche)),
        clientId: isEngaged ? (active?.clientId ?? null) : null,
        billingType: active?.billingType ?? "flat_monthly",
        monthlyRate: active?.monthlyRate ?? money(0),
        perLeadCallRate: active?.perLeadCallRate ?? money(0),
        perLeadFormRate: active?.perLeadFormRate ?? money(0),
        estimatedCallValue: money(e.call),
        estimatedFormValue: money(e.form),
        updatedAt: new Date(),
      })
      .where(eq(properties.id, pid));
  }
  if (demoAssignments.length > 0) {
    await db.insert(propertyAssignments).values(demoAssignments);
  }

  // -- 7. Leads (~9 months, tagged source_system='demo') ------------------
  // The interval active at a lead's date determines who it's stamped to AND how
  // it's billed (trial => $0; unrented => flat $0; paid per_lead/hybrid => rate).
  const billingAt = (pid: string, d: string): Interval | null => {
    for (const iv of intervalsByProperty.get(pid) ?? []) {
      if (iv.start <= d && (iv.end === null || iv.end >= d)) return iv;
    }
    return null;
  };
  const seasonalMult = (niche: string | null, d: Date): number => {
    const n = (niche ?? "").toLowerCase();
    const zoned = toZonedTime(d, TZ);
    const m = zoned.getMonth(); // 0-11
    let mult = 1;
    if (n.includes("roof")) {
      const stormMonth = toZonedTime(new Date(now.getTime() - 60 * 86400000), TZ).getMonth();
      if (m === stormMonth) mult *= 2.5;
    }
    if (n.includes("tree") && (m === 6 || m === 7 || m === 8)) mult *= 1.8;
    return mult;
  };

  // Lead-producing properties: plans with volume + the real-rented ones.
  interface LeadSpec { prop: Property; monthly: number; staleOld: boolean }
  const leadSpecs: LeadSpec[] = [];
  for (const plan of plans) {
    if (plan.monthly <= 0) continue;
    leadSpecs.push({ prop: plan.prop, monthly: plan.monthly, staleOld: !!plan.staleOld });
  }
  for (const pid of realRentedIds) {
    const prop = allProps.find((p) => p.id === pid)!;
    leadSpecs.push({ prop, monthly: 50, staleOld: false });
  }

  const LEAD_SCALE = 1.0; // global volume knob for the estimated-value target
  const HORIZON = 275;
  // Revenue/volume ramp: ~0.55x nine months ago climbing to 1.0x now.
  const ramp = (day: number) => 0.55 + 0.45 * (1 - day / HORIZON);

  const leadRows: NewLead[] = [];
  for (const spec of leadSpecs) {
    const { prop } = spec;
    const est = estForNiche(prop.niche);
    const perDay = (spec.monthly / 30) * LEAD_SCALE;
    for (let day = HORIZON; day >= 0; day--) {
      if (spec.staleOld && day < 31) continue; // stale drift: nothing in 30 days
      const d = new Date(now);
      d.setDate(now.getDate() - day);
      const dow = d.getDay();
      const weekday = dow !== 0 && dow !== 6;
      let lambda = perDay * ramp(day) * (weekday ? 1.3 : 0.4);
      lambda *= seasonalMult(prop.niche, d);
      let count = Math.floor(lambda);
      if (rnd() < lambda - count) count += 1;
      if (weekday && rnd() < 0.1) count += randInt(0, 2); // bursty variance

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
        const iv = billingAt(prop.id, dayISO);
        const stampClient = iv?.clientId ?? null;
        // A trial (or unrented period) bills as flat $0; paid intervals charge.
        const chargePerLead = iv !== null && !iv.isTrial;
        const decision = evaluateLead(
          { type, callDurationSeconds },
          {
            billingType: chargePerLead ? iv.billingType : "flat_monthly",
            perLeadCallRate: chargePerLead ? iv.perLeadCall : "0",
            perLeadFormRate: chargePerLead ? iv.perLeadForm : "0",
            estimatedCallValue: money(est.call),
            estimatedFormValue: money(est.form),
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
  const byStatus = { building: 0, optimizing: 0, producing: 0, trial: 0, rented: 0, paused: 0 } as Record<string, number>;
  for (const plan of plans) byStatus[plan.status]++;
  for (const id of realRentedIds) byStatus.rented++; // real rented not in plans

  const trialStates = { active: 0, expired: 0, converted: 0, ended: 0 };
  for (const a of demoAssignments) {
    if (!a.isTrial) continue;
    const note = a.notes ?? "";
    if (note.includes("trial-active")) trialStates.active++;
    else if (note.includes("trial-expired")) trialStates.expired++;
    else if (note.includes("trial-converted")) trialStates.converted++;
    else if (note.includes("trial-ended")) trialStates.ended++;
  }

  console.log("\n=== demo:seed summary ===");
  console.table({
    "demo clients": insertedClients.length,
    "demo assignments": demoAssignments.length,
    "demo leads": leadRows.length,
    "properties modified": plans.length,
  });
  console.log("Property statuses now:", byStatus);
  console.log(
    `Trials by state — active: ${trialStates.active}, expired: ${trialStates.expired}, ` +
      `converted: ${trialStates.converted}, ended-unconverted: ${trialStates.ended}`,
  );
  console.log("\n=== Expected on the dashboard ===");
  console.log(
    `Pipeline strip — Building: ${byStatus.building}, Optimizing: ${byStatus.optimizing}, ` +
      `Producing: ${byStatus.producing}, Trial: ${byStatus.trial}, Rented: ${byStatus.rented}`,
  );
  console.log("Status-review flags: expect >= 3 (high-lead optimizing, stale producing, expired trial).");
  console.log(`Total demo leads over ~9 months: ${leadRows.length}`);

  // -- 8. Computed monthly revenue + estimated value (last 3 months) ------
  const { orgTimezone: tz } = await getAppSettings();
  const months = recentMonths(tz, 3, now); // most recent first
  console.log("\n=== Computed monthly totals (via getMonthlyReport) ===");
  const rows: Record<string, string> = {};
  for (const m of [...months].reverse()) {
    const rep = await getMonthlyReport(tz, m);
    rows[m.label] =
      `actual $${Number(rep.totals.actualRevenue).toLocaleString()} | ` +
      `estimated $${Number(rep.totals.estimatedValue).toLocaleString()} | ` +
      `gap $${Number(rep.totals.gap).toLocaleString()} | leads ${rep.totals.totalLeads}`;
  }
  for (const [k, v] of Object.entries(rows)) console.log(`  ${k}: ${v}`);
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
      estimated_call_value: string; estimated_form_value: string;
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
          estimatedCallValue: s.estimated_call_value,
          estimatedFormValue: s.estimated_form_value,
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
