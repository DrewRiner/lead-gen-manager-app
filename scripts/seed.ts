/**
 * Development seed. Aborts unless APP_ENV === 'development' (never seed prod).
 *
 * Run with:  npm run db:seed
 * The db:seed script loads .env.local via --env-file. To seed despite an
 * .env.local that sets APP_ENV=production, override on the command line:
 *   APP_ENV=development npm run db:seed
 * (a shell-exported var takes precedence over the .env file value)
 *
 * Produces 5 clients, 12 properties across home-service niches, and ~600
 * leads over the last 90 days. Every lead is snapshotted via evaluateLead,
 * exactly as the app does on create.
 */
import { fromZonedTime } from "date-fns-tz";

import { evaluateLead } from "@/lib/billing/evaluate-lead";
import { db } from "@/lib/db";
import {
  clients,
  leads,
  properties,
  type NewLead,
  type NewProperty,
} from "@/lib/db/schema";

// --- Safety gate: never seed anything but a development environment ------
if (process.env.APP_ENV !== "development") {
  console.error(
    `Refusing to seed: APP_ENV is "${process.env.APP_ENV ?? "unset"}", not "development".`,
  );
  process.exit(1);
}

const TZ = "America/New_York";

// Deterministic PRNG (mulberry32) so re-seeds are reproducible.
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260728);

function pick<T>(arr: T[]): T {
  return arr[Math.floor(rnd() * arr.length)];
}
function randInt(min: number, max: number): number {
  return Math.floor(rnd() * (max - min + 1)) + min;
}
function money(n: number): string {
  return n.toFixed(2);
}
function phone(): string {
  let d = "";
  for (let i = 0; i < 10; i++) {
    d += i === 0 ? String(randInt(2, 9)) : String(randInt(0, 9));
  }
  return `+1${d}`;
}

const FIRST = ["James", "Mary", "Robert", "Linda", "Michael", "Patricia", "David", "Jennifer", "William", "Karen", "Chris", "Susan", "Dan", "Nancy", "Paul", "Betty"];
const LAST = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Lopez", "Wilson", "Anderson", "Thomas"];
function personName(): string {
  return `${pick(FIRST)} ${pick(LAST)}`;
}

// --- Niche economics ($ per call / form estimated value) ----------------
interface NicheDef {
  niche: string;
  call: number;
  form: number;
}
const NICHES: Record<string, NicheDef> = {
  plumbing: { niche: "plumbing", call: 85, form: 60 },
  hvac: { niche: "hvac", call: 95, form: 65 },
  roofing: { niche: "roofing", call: 120, form: 90 },
  garage_door: { niche: "garage door", call: 45, form: 30 },
  tree_service: { niche: "tree service", call: 70, form: 50 },
  pest_control: { niche: "pest control", call: 40, form: 28 },
  electrical: { niche: "electrical", call: 75, form: 55 },
  water_damage: { niche: "water damage", call: 110, form: 85 },
};

const CLIENT_DEFS = [
  { businessName: "Apex Home Services", contactName: "Greg Patterson" },
  { businessName: "BlueSky Contracting", contactName: "Maria Delgado" },
  { businessName: "Summit Property Group", contactName: "Tom Nguyen" },
  { businessName: "Ironclad Services LLC", contactName: "Sandra Cole" },
  { businessName: "Frontier Home Pros", contactName: "Derek Shaw" },
];

// 12 properties. billing mix: 6 flat_monthly, 4 per_lead, 2 hybrid.
// clientIndex null => unassigned (2 of them). Roughly weighted volume.
interface PropDef {
  name: string;
  domain: string;
  niche: NicheDef;
  city: string;
  state: string;
  billingType: "flat_monthly" | "per_lead" | "hybrid";
  monthlyRate: number;
  perLeadCall: number;
  perLeadForm: number;
  clientIndex: number | null;
  weight: number;
}

const PROP_DEFS: PropDef[] = [
  { name: "Austin Plumbing Pros", domain: "austinplumbingpros.com", niche: NICHES.plumbing, city: "Austin", state: "TX", billingType: "flat_monthly", monthlyRate: 1500, perLeadCall: 0, perLeadForm: 0, clientIndex: 0, weight: 10 },
  { name: "Dallas HVAC Experts", domain: "dallashvacexperts.com", niche: NICHES.hvac, city: "Dallas", state: "TX", billingType: "flat_monthly", monthlyRate: 1800, perLeadCall: 0, perLeadForm: 0, clientIndex: 0, weight: 9 },
  { name: "Phoenix Roofing Co", domain: "phoenixroofingco.com", niche: NICHES.roofing, city: "Phoenix", state: "AZ", billingType: "hybrid", monthlyRate: 900, perLeadCall: 45, perLeadForm: 30, clientIndex: 0, weight: 8 },
  { name: "Denver Garage Door", domain: "denvergaragedoor.com", niche: NICHES.garage_door, city: "Denver", state: "CO", billingType: "per_lead", monthlyRate: 0, perLeadCall: 28, perLeadForm: 18, clientIndex: 1, weight: 7 },
  { name: "Tampa Tree Service", domain: "tampatreeservice.com", niche: NICHES.tree_service, city: "Tampa", state: "FL", billingType: "per_lead", monthlyRate: 0, perLeadCall: 40, perLeadForm: 25, clientIndex: 1, weight: 6 },
  { name: "Charlotte Pest Control", domain: "charlottepestcontrol.com", niche: NICHES.pest_control, city: "Charlotte", state: "NC", billingType: "flat_monthly", monthlyRate: 1200, perLeadCall: 0, perLeadForm: 0, clientIndex: 2, weight: 8 },
  { name: "Nashville Electricians", domain: "nashvilleelectricians.com", niche: NICHES.electrical, city: "Nashville", state: "TN", billingType: "flat_monthly", monthlyRate: 1400, perLeadCall: 0, perLeadForm: 0, clientIndex: 2, weight: 7 },
  { name: "Houston Water Damage", domain: "houstonwaterdamage.com", niche: NICHES.water_damage, city: "Houston", state: "TX", billingType: "hybrid", monthlyRate: 1000, perLeadCall: 60, perLeadForm: 40, clientIndex: 3, weight: 9 },
  { name: "Miami Plumbing Now", domain: "miamiplumbingnow.com", niche: NICHES.plumbing, city: "Miami", state: "FL", billingType: "per_lead", monthlyRate: 0, perLeadCall: 42, perLeadForm: 28, clientIndex: 3, weight: 6 },
  { name: "Atlanta AC Repair", domain: "atlantaacrepair.com", niche: NICHES.hvac, city: "Atlanta", state: "GA", billingType: "flat_monthly", monthlyRate: 1650, perLeadCall: 0, perLeadForm: 0, clientIndex: 4, weight: 8 },
  // Two unassigned (available inventory).
  { name: "Seattle Roofing Group", domain: "seattleroofinggroup.com", niche: NICHES.roofing, city: "Seattle", state: "WA", billingType: "flat_monthly", monthlyRate: 1750, perLeadCall: 0, perLeadForm: 0, clientIndex: null, weight: 5 },
  { name: "San Diego Garage Doors", domain: "sandiegogaragedoors.com", niche: NICHES.garage_door, city: "San Diego", state: "CA", billingType: "per_lead", monthlyRate: 0, perLeadCall: 30, perLeadForm: 20, clientIndex: null, weight: 5 },
];

const SOURCES: Array<"organic" | "gbp" | "direct" | "other"> = [
  "organic", "organic", "organic", "organic", "gbp", "gbp", "gbp", "direct", "other",
];

async function main() {
  console.log("Seeding (APP_ENV=development)…");

  // Reset seedable tables (leads -> properties -> clients for FK order).
  await db.delete(leads);
  await db.delete(properties);
  await db.delete(clients);

  // Clients
  const insertedClients = await db
    .insert(clients)
    .values(
      CLIENT_DEFS.map((c) => ({
        businessName: c.businessName,
        contactName: c.contactName,
        email: `${c.businessName.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`,
        phone: phone(),
        status: "active" as const,
      })),
    )
    .returning({ id: clients.id });

  // Properties
  const propValues: NewProperty[] = PROP_DEFS.map((p) => {
    const assigned = p.clientIndex !== null;
    return {
      name: p.name,
      displayName: p.name,
      domain: p.domain,
      niche: p.niche.niche,
      city: p.city,
      state: p.state,
      status: assigned ? ("rented" as const) : ("available" as const),
      trackingPhone: phone(),
      clientId: assigned ? insertedClients[p.clientIndex!].id : null,
      billingType: p.billingType,
      monthlyRate: money(p.monthlyRate),
      perLeadCallRate: money(p.perLeadCall),
      perLeadFormRate: money(p.perLeadForm),
      estimatedCallValue: money(p.niche.call),
      estimatedFormValue: money(p.niche.form),
      billableThresholdSeconds: 60,
    };
  });
  const insertedProps = await db
    .insert(properties)
    .values(propValues)
    .returning();

  // Weighted property picker.
  const weightedPropIndexes: number[] = [];
  PROP_DEFS.forEach((p, i) => {
    for (let w = 0; w < p.weight; w++) weightedPropIndexes.push(i);
  });

  // Build ~90 days of leads, weekday-heavy.
  const now = new Date();
  const leadRows: NewLead[] = [];

  for (let dayOffset = 89; dayOffset >= 0; dayOffset--) {
    const dayDate = new Date(now);
    dayDate.setDate(now.getDate() - dayOffset);
    const dow = dayDate.getDay(); // 0 Sun .. 6 Sat
    const isWeekend = dow === 0 || dow === 6;
    const count = isWeekend ? randInt(1, 4) : randInt(6, 11);

    const y = dayDate.getFullYear();
    const m = dayDate.getMonth();
    const d = dayDate.getDate();

    for (let i = 0; i < count; i++) {
      const propIdx = pick(weightedPropIndexes);
      const prop = insertedProps[propIdx];

      const isCall = rnd() < 0.65;
      const type = isCall ? ("call" as const) : ("form" as const);

      // Call duration: ~25% under threshold, ~2% missing, rest qualifying.
      let callDurationSeconds: number | null = null;
      if (isCall) {
        const roll = rnd();
        if (roll < 0.02) callDurationSeconds = null;
        else if (roll < 0.27) callDurationSeconds = randInt(3, 59);
        else callDurationSeconds = randInt(60, 640);
      }

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

      // Business-hours-weighted local time, converted to a UTC instant.
      const hour = randInt(7, 19);
      const minute = randInt(0, 59);
      const occurredAt = fromZonedTime(
        new Date(y, m, d, hour, minute, randInt(0, 59)),
        TZ,
      );

      // Delivery status: mostly new; some billable leads delivered/billed.
      let deliveryStatus: "new" | "delivered" | "billed" = "new";
      if (decision.billableStatus === "billable") {
        const r = rnd();
        if (r < 0.15) deliveryStatus = "billed";
        else if (r < 0.45) deliveryStatus = "delivered";
      }

      const email =
        rnd() < 0.6
          ? `${pick(FIRST).toLowerCase()}.${pick(LAST).toLowerCase()}@example.com`
          : null;

      leadRows.push({
        propertyId: prop.id,
        clientId: prop.clientId,
        type,
        source: pick(SOURCES),
        callerName: personName(),
        callerPhone: phone(),
        callerEmail: type === "form" ? (email ?? `lead@example.com`) : email,
        message:
          type === "form"
            ? pick([
                "Need a quote for next week.",
                "Water heater is leaking, please call.",
                "Looking for an estimate.",
                "Emergency — can someone come today?",
                "Requesting a callback about pricing.",
              ])
            : null,
        callDurationSeconds,
        billableStatus: decision.billableStatus,
        billableReason: decision.billableReason,
        qualifiedBy: decision.qualifiedBy,
        billedAmount: decision.billedAmount,
        estimatedValue: decision.estimatedValue,
        deliveryStatus,
        sourceSystem: "manual",
        occurredAt,
      });
    }
  }

  // Insert leads in chunks.
  const CHUNK = 200;
  for (let i = 0; i < leadRows.length; i += CHUNK) {
    await db.insert(leads).values(leadRows.slice(i, i + CHUNK));
  }

  console.log(
    `Seeded ${insertedClients.length} clients, ${insertedProps.length} properties, ${leadRows.length} leads.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
