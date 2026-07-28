import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Enums (rule: enums defined here, imported everywhere, never string literals)
// ---------------------------------------------------------------------------

export const roleEnum = pgEnum("role", ["admin", "member"]);

export const clientStatusEnum = pgEnum("client_status", [
  "active",
  "paused",
  "churned",
]);

// Property lifecycle, in order. Meanings:
//   building   = site being built, not live
//   optimizing = live, SEO in progress, not yet producing meaningful leads
//   producing  = ranked and generating leads, NOT rented — sellable inventory
//   trial      = a prospect is on a free trial (follows the trial assignment)
//   rented     = has an active paid assignment (follows the assignment)
//   paused     = shelved
// 'trial' and 'rented' are never set by hand — they follow the assignment.
export const propertyStatusEnum = pgEnum("property_status", [
  "building",
  "optimizing",
  "producing",
  "trial",
  "rented",
  "paused",
]);

export const billingTypeEnum = pgEnum("billing_type", [
  "flat_monthly",
  "per_lead",
  "hybrid",
]);

export const leadTypeEnum = pgEnum("lead_type", ["call", "form"]);

export const leadSourceEnum = pgEnum("lead_source", [
  "organic",
  "gbp",
  "direct",
  "other",
]);

export const billableStatusEnum = pgEnum("billable_status", [
  "billable",
  "not_billable",
  "disputed",
  "pending_review",
  "spam",
]);

export const qualifiedByEnum = pgEnum("qualified_by", [
  "duration_rule",
  "manual",
  "ai",
]);

export const deliveryStatusEnum = pgEnum("delivery_status", [
  "new",
  "delivered",
  "billed",
]);

// ---------------------------------------------------------------------------
// Column helpers
// ---------------------------------------------------------------------------

/** Money is always numeric(10,2). Never a float. Returned/handled as string. */
const money = (name: string) =>
  numeric(name, { precision: 10, scale: 2 });

const createdAt = timestamp("created_at", { withTimezone: true, mode: "date" })
  .notNull()
  .defaultNow();

const updatedAt = timestamp("updated_at", { withTimezone: true, mode: "date" })
  .notNull()
  .defaultNow();

const deletedAt = timestamp("deleted_at", {
  withTimezone: true,
  mode: "date",
});

// ---------------------------------------------------------------------------
// profiles — app users, linked 1:1 to auth.users (FK added in raw SQL migration)
// ---------------------------------------------------------------------------

export const profiles = pgTable("profiles", {
  // id equals auth.users.id. Set by the on-auth-user-created trigger.
  // The FK to auth.users(id) is declared in the RLS/trigger SQL migration,
  // because auth.users lives outside the public schema and is never migrated.
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  fullName: text("full_name"),
  role: roleEnum("role").notNull().default("admin"),
  createdAt,
  updatedAt,
});

// ---------------------------------------------------------------------------
// app_settings — single org-wide settings row (singleton enforced by check)
// ---------------------------------------------------------------------------

export const appSettings = pgTable(
  "app_settings",
  {
    id: integer("id").primaryKey().default(1),
    orgTimezone: text("org_timezone").notNull().default("America/New_York"),
    defaultBillableThresholdSeconds: integer(
      "default_billable_threshold_seconds",
    )
      .notNull()
      .default(60),
    updatedAt,
  },
  (t) => [check("app_settings_singleton", sql`${t.id} = 1`)],
);

// ---------------------------------------------------------------------------
// clients — business owners renting leads
// ---------------------------------------------------------------------------

export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessName: text("business_name").notNull(),
  contactName: text("contact_name"),
  email: text("email"),
  phone: text("phone"),
  status: clientStatusEnum("status").notNull().default("active"),
  notes: text("notes"),
  createdAt,
  updatedAt,
  deletedAt,
});

// ---------------------------------------------------------------------------
// properties — lead gen sites we own. One property = one brand.
// ---------------------------------------------------------------------------

export const properties = pgTable("properties", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  displayName: text("display_name"),
  domain: text("domain"),
  niche: text("niche"),
  city: text("city"),
  state: text("state"),
  status: propertyStatusEnum("status").notNull().default("building"),
  // When the site went live (org-tz calendar date). Null until launched.
  launchedOn: date("launched_on", { mode: "string" }),
  gbpPlaceId: text("gbp_place_id"),
  trackingPhone: text("tracking_phone"),
  clientId: uuid("client_id").references(() => clients.id, {
    onDelete: "set null",
  }),
  billingType: billingTypeEnum("billing_type")
    .notNull()
    .default("flat_monthly"),
  monthlyRate: money("monthly_rate").notNull().default("0"),
  // What we aim to rent it for (independent of any current assignment).
  targetMonthlyRent: money("target_monthly_rent").notNull().default("0"),
  perLeadCallRate: money("per_lead_call_rate").notNull().default("0"),
  perLeadFormRate: money("per_lead_form_rate").notNull().default("0"),
  estimatedCallValue: money("estimated_call_value").notNull().default("0"),
  estimatedFormValue: money("estimated_form_value").notNull().default("0"),
  billableThresholdSeconds: integer("billable_threshold_seconds")
    .notNull()
    .default(60),
  notes: text("notes"),
  createdAt,
  updatedAt,
  deletedAt,
});

// ---------------------------------------------------------------------------
// leads — individual call or form leads, tied to a property
// ---------------------------------------------------------------------------

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "restrict" }),
    clientId: uuid("client_id").references(() => clients.id, {
      onDelete: "set null",
    }),
    type: leadTypeEnum("type").notNull(),
    source: leadSourceEnum("source").notNull().default("organic"),
    callerName: text("caller_name"),
    callerPhone: text("caller_phone"),
    callerEmail: text("caller_email"),
    message: text("message"),
    callDurationSeconds: integer("call_duration_seconds"),
    recordingUrl: text("recording_url"),
    billableStatus: billableStatusEnum("billable_status").notNull(),
    billableReason: text("billable_reason"),
    qualifiedBy: qualifiedByEnum("qualified_by"),
    // Snapshotted at creation. Historical revenue = SUM(billed_amount).
    billedAmount: money("billed_amount").notNull().default("0"),
    // Snapshotted at creation. Market value, independent of billed_amount.
    estimatedValue: money("estimated_value").notNull().default("0"),
    deliveryStatus: deliveryStatusEnum("delivery_status")
      .notNull()
      .default("new"),
    sourceSystem: text("source_system").notNull().default("manual"),
    externalId: text("external_id"),
    rawPayload: jsonb("raw_payload"),
    occurredAt: timestamp("occurred_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (t) => [
    // De-dupe external ingestion. Only enforced when external_id is present.
    uniqueIndex("leads_source_system_external_id_uniq")
      .on(t.sourceSystem, t.externalId)
      .where(sql`${t.externalId} is not null`),
    index("leads_property_id_occurred_at_idx").on(t.propertyId, t.occurredAt),
    index("leads_occurred_at_idx").on(t.occurredAt),
  ],
);

// ---------------------------------------------------------------------------
// property_assignments — source of truth for WHO rented WHAT, WHEN, at WHAT RATE.
// properties.client_id is only "who holds it right now" and must always match
// the single active assignment (ended_on is null).
// ---------------------------------------------------------------------------

export const propertyAssignments = pgTable(
  "property_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "restrict" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    // Calendar dates in the org timezone. ended_on null => currently active.
    startedOn: date("started_on", { mode: "string" }).notNull(),
    endedOn: date("ended_on", { mode: "string" }),
    // Rates SNAPSHOTTED at creation. Changing property rates never rewrites these.
    billingType: billingTypeEnum("billing_type").notNull(),
    monthlyRate: money("monthly_rate").notNull().default("0"),
    perLeadCallRate: money("per_lead_call_rate").notNull().default("0"),
    perLeadFormRate: money("per_lead_form_rate").notNull().default("0"),
    // Free trial: a trial assignment books zero revenue. trial_ends_on is
    // required when is_trial is true (enforced by check + in the actions).
    isTrial: boolean("is_trial").notNull().default(false),
    trialEndsOn: date("trial_ends_on", { mode: "string" }),
    notes: text("notes"),
    createdAt,
    updatedAt,
  },
  (t) => [
    // Exactly one active assignment per property at a time (trial OR paid).
    uniqueIndex("property_assignments_active_uniq")
      .on(t.propertyId)
      .where(sql`${t.endedOn} is null`),
    index("property_assignments_property_id_idx").on(t.propertyId),
    index("property_assignments_client_id_idx").on(t.clientId),
    check(
      "property_assignments_trial_ends_on",
      sql`not ${t.isTrial} or ${t.trialEndsOn} is not null`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type Profile = typeof profiles.$inferSelect;
export type AppSettings = typeof appSettings.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type Property = typeof properties.$inferSelect;
export type NewProperty = typeof properties.$inferInsert;
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type PropertyAssignment = typeof propertyAssignments.$inferSelect;
export type NewPropertyAssignment = typeof propertyAssignments.$inferInsert;
