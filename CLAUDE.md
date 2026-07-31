# LeadGen Property Manager

## What this is
Internal management app for a rank-and-rent lead generation business. We own and rank
lead gen websites ("properties"), generate phone calls and form submissions through
Google organic and Google Business Profile, and rent those leads to local business
owners ("clients").

Each property IS its own brand. There is no separate brand grouping level.

## Stack
- Next.js 15, App Router, TypeScript, React Server Components by default
- Tailwind CSS + shadcn/ui
- Supabase (Postgres + Auth), email/password, server-side sessions
- Drizzle ORM
- Vercel, npm

## Domain model
properties  - lead gen sites we own. One property = one brand.
clients     - business owners renting leads. One client may hold several properties,
              but a property has at most one active client at a time.
leads       - individual call or form leads, tied to a property
profiles    - app users (3-4 internal staff), linked to Supabase auth users

## Non-negotiable rules

1. Lead counts are ALWAYS derived from the leads table via SQL aggregation.
   Never store a denormalized counter on properties.

2. Every lead has occurred_at (when the call/form actually happened) and
   created_at (when we recorded it). ALL dashboard and report date filtering
   uses occurred_at. Never created_at.

3. All timestamps are timestamptz in UTC. There is a single org-wide timezone in
   app_settings. Convert to it only at the presentation layer. "Today" on the
   dashboard means today in the ORG timezone, not UTC and not the browser's.

4. BILLING SNAPSHOT: snapshot the applicable rate onto leads.billed_amount using
   the property's billing config at that moment. Historical revenue is
   SUM(billed_amount). Never recompute revenue by joining to current property
   rates. EXCEPTION for two-delivery call providers (CallRail/Twilio): the
   creating delivery can arrive with duration 0 ("Call Routing Complete"), so its
   snapshot is provisional. When a later delivery merges the real duration, the
   ingest upsert re-snapshots billed_amount/estimated_value from that delivery's
   evaluateLead decision — but ONLY when qualified_by = 'duration_rule' (a manual
   override or any other qualifier is never recomputed). A snapshot computed from
   duration 0 isn't a real snapshot; this makes it one.

5. BILLABLE DECISION: exactly one function, lib/billing/evaluate-lead.ts, decides
   whether a lead is billable. It returns { billableStatus, billableReason,
   qualifiedBy, billedAmount }. Nothing else in the codebase may contain billing
   logic or a hardcoded duration threshold. Phase 1 implements only the duration
   rule; AI scoring plugs into this same function later.

6. The billable call duration threshold is properties.billable_threshold_seconds
   (default 60). Never a constant in code.

7. Manual overrides win. If a user sets a lead's billable status by hand,
   qualified_by = 'manual' and no automated rule may overwrite it.

8. Deletes are soft (deleted_at) everywhere. Historical lead data must survive
   deleting a property or client. Default queries filter out soft-deleted rows.

9. Dashboard metrics aggregate in SQL and render on the server. No client-side
   data fetching for metrics.

10. Server Actions for all mutations, never API routes. Zod validation colocated
    with each action. External webhooks are the only exception (Phase 2).

## Production deployment

Hosted Supabase + Vercel. No local database.

### Connections - non-negotiable
- DATABASE_URL = transaction pooler (6543), all runtime queries
- DIRECT_URL = session pooler (5432), drizzle-kit migrations only
- postgres-js client MUST use { prepare: false, max: 1 }
- Only lib/db/index.ts may read a database URL from env

### Migrations
Drizzle Kit only. Never run supabase db push/diff/migration new.
drizzle.config.ts MUST set schemaFilter: ['public'].
Run migrations manually via npm run db:migrate. Never in the Vercel build.
auth.users is a foreign key reference target only - never migrate it.

### Auth
Public signup is disabled. No signup page, no signup action. Accounts are
created by an admin in the Supabase dashboard.
A trigger on auth.users AFTER INSERT creates the profiles row, shipped as a
Drizzle migration.

### Security
RLS enabled on every public table with NO policies - the anon key grants nothing.
All access is server-side via service role through Server Actions and Server
Components. Safe only because there is no client-side data fetching (rule 9).
SUPABASE_SERVICE_ROLE_KEY never touches a client component or NEXT_PUBLIC_ var.
Middleware protects every route except /login.

### Seed
Seed script aborts unless APP_ENV === 'development'. Never seed production.

## Roadmap - DO NOT BUILD AHEAD
Phase 1 (current): auth, property CRUD, client CRUD, manual lead entry,
                   billing config, dashboard
Phase 2: automatic webhook ingestion (CallRail, Twilio, contact forms),
         tracking numbers table, unmatched lead queue
Phase 3: AI call transcript analysis to replace the duration rule; AI form
         spam/quality scoring
Phase 4: GoHighLevel review generation
Phase 5: client-facing portal, lead delivery, invoicing

## Conventions
- Drizzle migrations committed to /drizzle, never hand-edited after generation
- Money stored as numeric(10,2). Never floats.
- Phone numbers stored E.164 (+15551234567) via libphonenumber-js
- Enums defined in the Drizzle schema, imported everywhere, never string literals

## Estimated lead value (market value vs actual revenue)

Two independent money concepts per lead:
- billed_amount: what we actually charge the client (flat rent or per-lead rate)
- estimated_value: what the lead is worth in that niche and market, regardless
  of what the current client pays

Rules:
1. Estimated rates live on the property: estimated_call_value and
   estimated_form_value. Set per property because value depends on niche + metro.
2. estimated_value is SNAPSHOTTED onto each lead the same as billed_amount —
   at creation, and re-snapshotted on the enrichment merge for two-delivery call
   providers (see rule 4). Changing a property's rate must not rewrite historical
   months.
3. Estimated value applies ONLY to billable leads. Non-billable, spam, and
   pending_review leads get estimated_value = 0.
4. evaluateLead() returns estimatedValue alongside billedAmount. It remains the
   single place this is decided.
5. A manual "Recalculate estimated values" action on a property re-runs the
   current rates across its historical leads. Explicit only, never automatic.
6. Monthly reporting uses CALENDAR months in the org timezone, not rolling
   30-day windows. Month-to-date and prior full months.
7. The gap (estimated_value - billed_amount) is a first-class reported metric.
   It identifies underpriced flat-rate contracts and unrented inventory.

## Rental assignments and lifetime value

property_assignments is the source of truth for WHO rented WHAT, WHEN, and at
WHAT RATE. properties.client_id remains only as "who holds it right now" and
must always match the active assignment.

Rules:
1. An assignment has started_on and ended_on (null = currently active). Exactly
   one active assignment per property at a time. Enforce with a partial unique
   index on (property_id) where ended_on is null.
2. Rates are SNAPSHOTTED onto the assignment at creation: billing_type,
   monthly_rate, per_lead_call_rate, per_lead_form_rate. Changing a property's
   current rates must never rewrite historical assignment revenue.
3. Assigning a client creates an assignment and sets properties.client_id.
   Unassigning sets ended_on and nulls properties.client_id. Both happen in one
   transaction. These are the only ways client_id ever changes.
4. Monthly flat revenue comes from the assignment active during that month, using
   that assignment's snapshotted monthly_rate. Never the property's current rate,
   and never "does it have a client now."
5. Lifetime value of a property = all flat rent across all its assignments, plus
   SUM(billed_amount) of all its leads. Lifetime estimated value =
   SUM(estimated_value) of all its leads, independent of any client.
6. Lifetime value of a client = the same, scoped to that client's assignments and
   the leads stamped with that client_id.
7. Leads keep their own client_id snapshot. Never re-attribute a historical lead
   to a different client.

## Additional lifetime metrics on /properties/[id]

The lifetime cards must combine ALL clients that ever rented this property, plus
all lead revenue regardless of who held it at the time. Add to that section:

- Total clients (how many distinct clients have ever rented it)
- Average tenure per client, in months
- Longest tenure, with the client name
- Revenue per month rented (lifetime revenue / months rented) - the comparable
  earning rate between properties
- Occupancy rate (months rented / months since first assignment or first lead)

In the Client history table, add a "% of lifetime revenue" column so I can see at
a glance whether this property's value came from one anchor client or many short
ones.

Rank properties by revenue per month rented, not raw lifetime revenue, anywhere
properties are compared. A property owned for 6 months earning $2k/mo beats one
owned 3 years earning $500/mo, and raw lifetime totals hide that.

## Free trials

A trial is a relationship with a specific prospect, so it lives on
property_assignments (is_trial = true, trial_ends_on set), not as a standalone
property status. Property status derives from it, exactly as 'rented' does.

1. A trial assignment books ZERO flat revenue and zero per-lead revenue. Trials
   are free by definition. billed_amount on trial leads is 0.
2. Estimated value still books normally on trial leads. That figure is both the
   sales pitch and our cost of running the trial.
3. Leads during a trial ARE stamped with the prospect's client_id, so their lead
   count and value are attributable.
4. Starting a trial sets property status to 'trial'. Converting sets 'rented'.
   Ending without converting sets 'producing'. Status always follows the
   assignment.
5. A trial that passes trial_ends_on without conversion is EXPIRED and must be
   surfaced. An expired trial still books zero revenue — it does not silently
   become a paid rental.
6. Converting a trial ends the trial assignment and starts a new paid assignment
   for the same client, beginning the day after the trial ended. Both records
   persist so the history shows trial then paid.

## Webhook ingestion (GoHighLevel and beyond)

Inbound leads arrive via ONE HTTP endpoint (`POST /api/webhooks/ghl-form`) — the
only API route in the app; everything else stays Server Actions/Components.

1. The pipeline is provider-neutral: an adapter (`lib/ingestion/adapters/*`)
   turns a raw payload into a CanonicalLead; `resolve` matches it to a property;
   `ingest` runs evaluateLead and upserts. Adding CallRail/Twilio later means
   adding ONE adapter file — nothing downstream changes.
2. Every request is logged to `webhook_events` (raw payload + headers) BEFORE
   parsing or auth, so malformed/unauthorized calls still leave a record. The
   secret header is redacted before storage.
3. Auth is a constant-time compare against `app_settings.webhook_secret`. Invalid
   secret ⇒ 401 (after logging). Everything else ⇒ 200, even unresolvable or
   downstream-failed: GHL retries 5xx forever, and the logged event is replayable.
4. Property resolution order: (1) Lead Source vs `properties.ghl_lead_source`
   (case-insensitive, trimmed), (2) `ghl_form_id`, (3) page-url host vs
   `properties.domain` (normalized). No match ⇒ the lead is stored 'unmatched'
   with a null property and ZERO billed/estimated value.
5. De-dupe on (source_system, external_id). Adapters synthesize a deterministic
   external_id (hash of form id + email/phone + timestamp) when the payload has
   none, so replays and retries never double-insert.
6. occurred_at comes from the payload, never server time; if absent it falls back
   to receipt time and that fact is noted in billable_reason.
7. Unmatched leads are assigned from /leads, which re-runs evaluateLead against
   the chosen property and can remember the Lead Source on it for auto-match.
   Resolution/billing math is unit-tested (`lib/ingestion/*.test.ts`); the
   endpoint is verified with curl.
