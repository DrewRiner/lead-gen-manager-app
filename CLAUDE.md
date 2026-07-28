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

4. BILLING SNAPSHOT: when a lead is created, snapshot the applicable rate onto
   leads.billed_amount using the property's billing config at that moment.
   Historical revenue is SUM(billed_amount). Never recompute revenue by joining
   to current property rates.

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
2. estimated_value is SNAPSHOTTED onto each lead at creation, same as
   billed_amount. Changing a property's rate must not rewrite historical months.
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
