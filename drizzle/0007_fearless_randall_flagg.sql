ALTER TYPE "public"."billable_status" ADD VALUE 'unmatched';--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"event_type" text,
	"raw_payload" jsonb,
	"headers" jsonb,
	"auth_valid" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp with time zone,
	"lead_id" uuid,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "property_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "webhook_secret" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "ghl_contact_id" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "ghl_location_id" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "ghl_lead_source_raw" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "page_url" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "form_name" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "ghl_lead_source" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "ghl_form_id" text;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "webhook_events_created_at_idx" ON "webhook_events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "properties_ghl_lead_source_uniq" ON "properties" USING btree ("ghl_lead_source") WHERE "properties"."ghl_lead_source" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "properties_ghl_form_id_uniq" ON "properties" USING btree ("ghl_form_id") WHERE "properties"."ghl_form_id" is not null;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Hand-appended (not from drizzle-kit generate):
--   1. RLS lockdown on the new public table (no policies => anon key gets zero
--      access; all reads/writes go through the server role). Matches 0001.
--   2. Bootstrap a webhook secret on the singleton settings row so inbound
--      webhooks work immediately. Rotatable from Settings. gen_random_uuid()
--      is built-in (no pgcrypto), two of them give a 64-char hex secret.
--   3. Seed every existing property's ghl_lead_source to its name, so the
--      value to drop into each GHL form's Lead Source field is the brand name.
-- ---------------------------------------------------------------------------
ALTER TABLE "public"."webhook_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

UPDATE "public"."app_settings"
  SET "webhook_secret" =
    replace(gen_random_uuid()::text, '-', '') ||
    replace(gen_random_uuid()::text, '-', '')
  WHERE "id" = 1 AND "webhook_secret" IS NULL;--> statement-breakpoint

UPDATE "public"."properties"
  SET "ghl_lead_source" = "name"
  WHERE "ghl_lead_source" IS NULL AND "deleted_at" IS NULL;