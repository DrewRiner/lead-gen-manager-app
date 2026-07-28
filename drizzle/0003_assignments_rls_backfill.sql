-- Custom migration: RLS on property_assignments + backfill from existing
-- properties.client_id so the "client_id matches the active assignment"
-- invariant holds for pre-existing rows. Idempotent.

-- 1. RLS: enabled, no policies (consistent with every other public table).
ALTER TABLE "public"."property_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- 2. Backfill one active assignment per property that currently has a client,
--    snapshotting the property's current rates. started_on is the property's
--    creation date in the org timezone. Skips properties that already have an
--    active assignment, so re-running is safe.
INSERT INTO "public"."property_assignments" (
  "property_id", "client_id", "started_on", "ended_on",
  "billing_type", "monthly_rate", "per_lead_call_rate", "per_lead_form_rate"
)
SELECT
  p."id",
  p."client_id",
  (p."created_at" AT TIME ZONE COALESCE(
    (SELECT s."org_timezone" FROM "public"."app_settings" s WHERE s."id" = 1),
    'America/New_York'
  ))::date,
  NULL,
  p."billing_type",
  p."monthly_rate",
  p."per_lead_call_rate",
  p."per_lead_form_rate"
FROM "public"."properties" p
WHERE p."client_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "public"."property_assignments" a
    WHERE a."property_id" = p."id" AND a."ended_on" IS NULL
  );
