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
  // Ingested lead that couldn't be resolved to a property. Books zero
  // billed/estimated value until an operator assigns it (see /leads).
  "unmatched",
]);

export const qualifiedByEnum = pgEnum("qualified_by", [
  "duration_rule",
  "manual",
  "ai",
  // Automated non-AI spam scorer flagged the lead (lib/spam/score-form-lead.ts).
  "spam_rule",
  // Form leads: contact-info + quality validation (lib/billing/form-quality.ts).
  "form_validation",
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
  // Soft-deactivation: non-null => the user is disabled. Never hard-delete a
  // profile, so historical actions/attribution survive. Enforced server-side.
  deactivatedAt: timestamp("deactivated_at", {
    withTimezone: true,
    mode: "date",
  }),
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
    // Producing-health signal thresholds (advisory only; never mutate status).
    // Min billable leads a property needs — both in the trailing 30 days and in
    // each qualifying calendar month — to count as derived-producing.
    producingMinBillableLeads: integer("producing_min_billable_leads")
      .notNull()
      .default(4),
    // How many of the last 3 complete calendar months must clear that bar.
    producingMonthsRequired: integer("producing_months_required")
      .notNull()
      .default(2),
    // Form-lead spam score at/above which a lead is flagged 'spam' (still saved).
    spamScoreThreshold: integer("spam_score_threshold").notNull().default(70),
    // Shared secret for inbound webhooks (checked against the X-Webhook-Secret
    // header). Nullable so a fresh install has none until one is generated.
    webhookSecret: text("webhook_secret"),
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

export const properties = pgTable(
  "properties",
  {
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
    // Expected provider hosting this property's tracking number / data source,
    // for SETUP GUIDANCE and connection-status display ONLY. Values mirror
    // leads.source_system ('callrail' | 'twilio' | 'ghl'). Nullable: existing
    // properties are unset. NEVER read by ingestion or resolution — calls always
    // resolve by dialed number vs tracking_phone, regardless of this field.
    callProvider: text("call_provider"),
    // Admin override for the connection dot: "marked ready to receive leads".
    // The dot is GREEN if this is true OR a real lead arrived recently; the
    // ghl_lead_source config field is NOT used for the dot anymore.
    connectionReady: boolean("connection_ready").notNull().default(false),
    // GoHighLevel ingestion keys. ghl_lead_source is the exact value the GHL
    // form puts in its Lead Source hidden field; ghl_form_id is the form's id.
    // Either resolves an inbound webhook to this property (see lib/ingestion).
    ghlLeadSource: text("ghl_lead_source"),
    ghlFormId: text("ghl_form_id"),
    // Optional stable routing code. A second key matched (case-insensitive,
    // trimmed) against the incoming Lead Source, so forms can migrate from
    // brand-name matching to a short code without changing ghl_lead_source.
    shortCode: text("short_code"),
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
  },
  (t) => [
    // A lead-source / form-id may belong to at most one property. Partial so
    // the many properties without GHL keys don't collide on NULL.
    uniqueIndex("properties_ghl_lead_source_uniq")
      .on(t.ghlLeadSource)
      .where(sql`${t.ghlLeadSource} is not null`),
    uniqueIndex("properties_ghl_form_id_uniq")
      .on(t.ghlFormId)
      .where(sql`${t.ghlFormId} is not null`),
    // Short code is a routing key too, so it must be unique. Compared
    // case-insensitively at match time, so enforce uniqueness case-folded.
    uniqueIndex("properties_short_code_uniq")
      .on(sql`lower(${t.shortCode})`)
      .where(sql`${t.shortCode} is not null`),
  ],
);

// ---------------------------------------------------------------------------
// leads — individual call or form leads, tied to a property
// ---------------------------------------------------------------------------

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Nullable: an ingested lead that can't be resolved to a property is stored
    // 'unmatched' with a null property until an operator assigns it.
    propertyId: uuid("property_id").references(() => properties.id, {
      onDelete: "restrict",
    }),
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
    // CallRail call-ingestion context (null for forms / manual leads).
    callAnswered: boolean("call_answered"),
    isRepeatCaller: boolean("is_repeat_caller"),
    transcript: text("transcript"),
    callrailCallId: text("callrail_call_id"),
    // Twilio call-ingestion context: CallSid, parallel to callrail_call_id
    // (null for CallRail / form / manual leads).
    twilioCallSid: text("twilio_call_sid"),
    // GoHighLevel form-ingestion context (null for manually-entered leads).
    ghlContactId: text("ghl_contact_id"),
    ghlLocationId: text("ghl_location_id"),
    // Submitter IP (from attributionSource.ip), kept for spam rate signals.
    submitterIp: text("submitter_ip"),
    // The raw Lead Source value as it arrived on the form (before resolution).
    ghlLeadSourceRaw: text("ghl_lead_source_raw"),
    pageUrl: text("page_url"),
    formName: text("form_name"),
    // Swept custom form fields (label -> value) that don't map to a standard
    // column. Composed into `message` for display, kept structured here.
    formAnswers: jsonb("form_answers").$type<Record<string, string>>(),
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
    // Spam rate-signal lookups: same email/phone/ip within a recent window.
    index("leads_caller_email_occurred_at_idx").on(t.callerEmail, t.occurredAt),
    index("leads_caller_phone_occurred_at_idx").on(t.callerPhone, t.occurredAt),
    index("leads_submitter_ip_occurred_at_idx").on(t.submitterIp, t.occurredAt),
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
// webhook_events — append-only audit log of every inbound webhook POST.
// The raw payload + headers are recorded BEFORE any parsing/auth, so a
// malformed or unauthorized request still leaves a durable record. A processed
// event links to the lead it produced. This is the source for the Replay
// button and the ingestion history in Settings.
// ---------------------------------------------------------------------------

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Which integration sent it, e.g. 'ghl'. Kept as text (not an enum) so a
    // new provider adapter needs no migration.
    provider: text("provider").notNull(),
    eventType: text("event_type"),
    rawPayload: jsonb("raw_payload"),
    headers: jsonb("headers"),
    // Whether the shared-secret header matched. Recorded even on rejection.
    authValid: boolean("auth_valid").notNull().default(false),
    // Set once ingestion runs to completion (matched OR unmatched). Null while
    // unprocessed or when processing failed before persisting a lead.
    processedAt: timestamp("processed_at", {
      withTimezone: true,
      mode: "date",
    }),
    leadId: uuid("lead_id").references(() => leads.id, {
      onDelete: "set null",
    }),
    error: text("error"),
    createdAt,
  },
  (t) => [index("webhook_events_created_at_idx").on(t.createdAt)],
);

// ---------------------------------------------------------------------------
// guides — in-app how-to guides, authored in a block editor. Media lives in the
// Supabase Storage "guide-media" bucket; blocks reference public URLs.
// ---------------------------------------------------------------------------

export const guideStatusEnum = pgEnum("guide_status", ["draft", "published"]);

export const guideBlockTypeEnum = pgEnum("guide_block_type", [
  "heading",
  "text",
  "image",
  "video",
  "embed",
]);

export const guides = pgTable(
  "guides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    // Auto-derived from the title, unique among live guides.
    slug: text("slug").notNull(),
    category: text("category"),
    summary: text("summary"),
    status: guideStatusEnum("status").notNull().default("draft"),
    // Manual ordering within a category on the index.
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: uuid("created_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (t) => [
    // Slug unique among non-deleted guides (soft-deletes free the slug).
    uniqueIndex("guides_slug_uniq")
      .on(t.slug)
      .where(sql`${t.deletedAt} is null`),
    index("guides_status_idx").on(t.status),
  ],
);

export const guideBlocks = pgTable(
  "guide_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    guideId: uuid("guide_id")
      .notNull()
      .references(() => guides.id, { onDelete: "cascade" }),
    type: guideBlockTypeEnum("type").notNull(),
    // Shape depends on type (heading/text/image/video/embed); see lib/guides.
    content: jsonb("content").notNull(),
    position: integer("position").notNull().default(0),
    createdAt,
    updatedAt,
  },
  (t) => [index("guide_blocks_guide_id_position_idx").on(t.guideId, t.position)],
);

// Per-user "Done" progress on the designed operator guides. A row's PRESENCE
// means that step is checked; toggling off deletes it. Keyed by the app user
// (profile), the guide slug, and a stable step key.
export const guideStepProgress = pgTable(
  "guide_step_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    guideSlug: text("guide_slug").notNull(),
    stepKey: text("step_key").notNull(),
    createdAt,
  },
  (t) => [
    uniqueIndex("guide_step_progress_uniq").on(
      t.profileId,
      t.guideSlug,
      t.stepKey,
    ),
    index("guide_step_progress_user_guide_idx").on(t.profileId, t.guideSlug),
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
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;
export type Guide = typeof guides.$inferSelect;
export type NewGuide = typeof guides.$inferInsert;
export type GuideBlock = typeof guideBlocks.$inferSelect;
export type NewGuideBlock = typeof guideBlocks.$inferInsert;
